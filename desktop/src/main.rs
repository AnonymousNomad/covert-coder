#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{BufRead, BufReader, Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::process::{Child, Command, Stdio};
use std::sync::{mpsc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::Manager;

struct DaemonProcess(Mutex<Option<Child>>);
struct PairingProof(Mutex<Option<(String, String)>>);

#[tauri::command]
fn authority_pairing(window: tauri::WebviewWindow, state: tauri::State<'_, PairingProof>) -> Result<String, String> {
    if window.label() != "main" { return Err("untrusted bootstrap window".into()); }
    let origin = window.url().map_err(|_| "window origin unavailable")?.origin().ascii_serialization();
    let mut pending = state.0.lock().map_err(|_| "bootstrap unavailable")?;
    let Some((_, expected_origin)) = pending.as_ref() else { return Err("pairing already consumed or unavailable".into()); };
    if &origin != expected_origin { return Err("bootstrap origin mismatch".into()); }
    pending.take().map(|(proof, _)| proof).ok_or_else(|| "bootstrap unavailable".into())
}

fn read_pairing(child: &mut Child) -> Result<String, String> {
    let stdout = child.stdout.take().ok_or("private bootstrap pipe unavailable")?;
    let (tx, rx) = mpsc::sync_channel(1);
    thread::spawn(move || {
        let mut line = String::new();
        let result = BufReader::new(stdout).take(128).read_line(&mut line);
        let proof = line.trim().strip_prefix("COVERT_PAIRING_V1 ").unwrap_or("");
        let valid = result.is_ok() && proof.len() == 43 && proof.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_');
        let _ = tx.send(if valid { Ok(proof.to_owned()) } else { Err("invalid private bootstrap response".to_string()) });
    });
    rx.recv_timeout(Duration::from_secs(60)).map_err(|_| "private bootstrap timed out".to_string())?
}

fn facade_ready() -> bool {
    let address = SocketAddr::from(([127, 0, 0, 1], 4777));
    let Ok(mut stream) = TcpStream::connect_timeout(&address, Duration::from_millis(300)) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_secs(1)));
    let request = b"GET /api/health HTTP/1.1\r\nHost: 127.0.0.1:4777\r\nConnection: close\r\n\r\n";
    if stream.write_all(request).is_err() {
        return false;
    }
    let mut response = [0_u8; 64];
    let Ok(read) = stream.read(&mut response) else {
        return false;
    };
    String::from_utf8_lossy(&response[..read]).starts_with("HTTP/1.1 200")
}

fn wait_for_facade(child: &mut Child) -> Result<(), String> {
    let deadline = Instant::now() + Duration::from_secs(30);
    while Instant::now() < deadline {
        if let Some(status) = child.try_wait().map_err(|error| error.to_string())? {
            return Err(format!("desktop stack exited before facade readiness: {status}"));
        }
        if facade_ready() {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(200));
    }
    Err("desktop facade did not become healthy within 30 seconds".to_string())
}

fn terminate_tree(child: &mut Child) {
    #[cfg(windows)]
    {
        let _ = Command::new("taskkill.exe")
            .args(["/PID", &child.id().to_string(), "/T", "/F"])
            .status();
    }
    #[cfg(not(windows))]
    {
        let _ = child.kill();
    }
    let _ = child.wait();
}

/// Minimal JSON string escaping for the spawn record (no external crates).
fn json_string(value: &str) -> String {
    let mut out = String::with_capacity(value.len() + 2);
    out.push('"');
    for character in value.chars() {
        match character {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            control if (control as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", control as u32)),
            other => out.push(other),
        }
    }
    out.push('"');
    out
}

/// Node cannot resolve a `\\?\`-prefixed script path as its main module
/// (verified crash: EISDIR lstat 'E:' in resolveMainPath). Tauri's
/// `resource_dir()` returns Windows extended-length paths; normalize them to
/// plain drive (or UNC) paths for the child invocation.
fn plain_path(path: &std::path::Path) -> std::path::PathBuf {
    let text = path.display().to_string();
    if let Some(rest) = text.strip_prefix("\\\\?\\UNC\\") {
        return std::path::PathBuf::from(format!("\\\\{rest}"));
    }
    if let Some(rest) = text.strip_prefix("\\\\?\\") {
        return std::path::PathBuf::from(rest);
    }
    path.to_path_buf()
}

/// Resolve one application-owned packaged runtime resource.
///
/// Tauri array-form `bundle.resources` preserves the `resources/` prefix under
/// the resource dir, while object-map staging places files directly beneath it.
/// Probe both deterministic layouts and fail with every probed location (P1 fix
/// for the packaged backend that never spawned: 4777 never bound).
///
/// Only constant, application-owned relative paths are accepted here; no
/// user-controlled input reaches this resolver.
fn resolve_resource(resource_dir: &std::path::Path, relative: &str) -> Result<std::path::PathBuf, String> {
    let candidates = [
        resource_dir.join(relative),
        resource_dir.join("resources").join(relative),
    ];
    for candidate in &candidates {
        if candidate.exists() {
            return Ok(candidate.clone());
        }
    }
    Err(format!(
        "required desktop runtime resource '{relative}' not found; probed: {}",
        candidates
            .iter()
            .map(|candidate| candidate.display().to_string())
            .collect::<Vec<_>>()
            .join(", ")
    ))
}

#[cfg(test)]
mod resource_resolution_tests {
    use super::resolve_resource;

    #[test]
    fn resolves_nested_tauri_layout() {
        let root = std::env::temp_dir().join(format!("covert-res-rs-{}", std::process::id()));
        let nested = root.join("resources").join("runtime");
        std::fs::create_dir_all(&nested).unwrap();
        std::fs::write(nested.join("node.exe"), b"stub").unwrap();
        let resolved = resolve_resource(&root, "runtime/node.exe").unwrap();
        assert_eq!(resolved, nested.join("node.exe"));
        std::fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn resolves_direct_layout_and_fails_deterministically_when_absent() {
        let root = std::env::temp_dir().join(format!("covert-res-direct-{}", std::process::id()));
        std::fs::create_dir_all(root.join("runtime")).unwrap();
        std::fs::write(root.join("stack-launcher.mjs"), b"stub").unwrap();
        assert_eq!(
            resolve_resource(&root, "stack-launcher.mjs").unwrap(),
            root.join("stack-launcher.mjs")
        );
        let error = resolve_resource(&root, "runtime/node.exe").unwrap_err();
        assert!(error.contains("probed:"), "error must name the probed locations: {error}");
        std::fs::remove_dir_all(&root).unwrap();
    }
}

fn main() {
    tauri::Builder::default()
        .manage(DaemonProcess(Mutex::new(None)))
        .manage(PairingProof(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![authority_pairing])
        .setup(|app| {
            let resource_dir = plain_path(&app.path().resource_dir().map_err(|error| error.to_string())?);
            let node_name = if cfg!(windows) { "node.exe" } else { "node" };
            let node = resolve_resource(&resource_dir, &format!("runtime/{node_name}"))?;
            let launcher = resolve_resource(&resource_dir, "stack-launcher.mjs")?;
            {
                let origin = if cfg!(debug_assertions) { "http://127.0.0.1:5173" }
                    else if cfg!(windows) { "http://tauri.localhost" } else { "tauri://localhost" };
                // Ghost-compatible spawn record + bounded stderr capture. The
                // windows-subsystem shell has no valid stderr handle; leaving
                // stderr inherited let the child die silently (first
                // divergence vs the known-good manual run). The record stores
                // only allowlisted AIDE_* values — never the full environment.
                let log_dir = resource_dir.join(".aide").join("logs");
                let _ = std::fs::create_dir_all(&log_dir);
                let spawn_record = format!(
                    "{{\n  \"executable\": {},\n  \"argv\": [{}, \"--native-bootstrap\", \"--pair-origin={}\"],\n  \"cwd\": {},\n  \"env_allowlist\": {{\"AIDE_WORKSPACE\": {}, \"AIDE_MODEL_DIR\": {}, \"AIDE_ARCH_PORT\": \"4778\", \"AIDE_LEGACY_PORT\": \"4779\", \"AIDE_FACADE_PORT\": \"4777\", \"AIDE_LLAMA_SERVER\": {}}},\n  \"spawned_at_unix_ms\": {}\n}}\n",
                    json_string(&node.display().to_string()),
                    json_string(&launcher.display().to_string()),
                    origin,
                    json_string(&resource_dir.display().to_string()),
                    json_string(&resource_dir.display().to_string()),
                    json_string(&resource_dir.join("models").display().to_string()),
                    json_string(&resource_dir.join("runtime").join(if cfg!(windows) { "llama-server.exe" } else { "llama-server" }).display().to_string()),
                    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0)
                );
                let _ = std::fs::write(log_dir.join("desktop-launcher.spawn.json"), spawn_record);
                let stderr_handle = std::fs::File::create(log_dir.join("desktop-launcher.err.log")).ok().map(Stdio::from).unwrap_or_else(Stdio::null);
                let mut child = Command::new(node)
                    .arg(&launcher)
                    .arg("--native-bootstrap")
                    .arg(format!("--pair-origin={origin}"))
                    .stdin(Stdio::null())
                    .stdout(Stdio::piped())
                    .stderr(stderr_handle)
                    .current_dir(&resource_dir)
                    .env("AIDE_WORKSPACE", &resource_dir)
                    .env("AIDE_MODEL_DIR", resource_dir.join("models"))
                    .env("AIDE_ARCH_PORT", "4778")
                    .env("AIDE_LEGACY_PORT", "4779")
                    .env("AIDE_FACADE_PORT", "4777")
                    .env("AIDE_LLAMA_SERVER", resource_dir.join("runtime").join(if cfg!(windows) { "llama-server.exe" } else { "llama-server" }))
                    .spawn()
                    .map_err(|error| error.to_string())?;
                let proof = match read_pairing(&mut child) {
                    Ok(proof) => proof,
                    Err(error) => { terminate_tree(&mut child); return Err(error.into()); }
                };
                if let Err(error) = wait_for_facade(&mut child) {
                    terminate_tree(&mut child);
                    return Err(error.into());
                }
                let state = app.state::<DaemonProcess>();
                *state.0.lock().map_err(|error| error.to_string())? = Some(child);
                *app.state::<PairingProof>().0.lock().map_err(|_| "bootstrap lock unavailable")? = Some((proof, origin.to_string()));
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building AIDE desktop shell")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(mut child) = app.state::<DaemonProcess>().0.lock().ok().and_then(|mut state| state.take()) {
                    terminate_tree(&mut child);
                }
            }
        });
}
