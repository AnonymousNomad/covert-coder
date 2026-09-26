#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{BufRead, BufReader, Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{mpsc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::Manager;

struct DaemonProcess(Mutex<Option<Child>>);
struct PairingProof(Mutex<Option<(String, String)>>);

fn contains_desktop_runtime(root: &Path, node_name: &str) -> bool {
    root.join("runtime").join(node_name).is_file() && root.join("stack-launcher.mjs").is_file()
}

fn strip_verbatim_prefix(path: &Path) -> PathBuf {
    let text = path.as_os_str().to_string_lossy();
    if let Some(rest) = text.strip_prefix(r"\\?\UNC\") {
        return PathBuf::from(format!(r"\\{rest}"));
    }
    if let Some(rest) = text.strip_prefix(r"\\?\") {
        return PathBuf::from(rest);
    }
    path.to_path_buf()
}

fn resolve_desktop_resource_root(resource_dir: &Path, node_name: &str) -> Result<PathBuf, String> {
    let nested_resources = resource_dir.join("resources");
    match (
        contains_desktop_runtime(resource_dir, node_name),
        contains_desktop_runtime(&nested_resources, node_name),
    ) {
        (true, false) => Ok(resource_dir.to_path_buf()),
        (false, true) => Ok(nested_resources),
        (false, false) => Err("required desktop runtime resources are missing".into()),
        (true, true) => Err("desktop runtime resource root is ambiguous".into()),
    }
}

fn startup_trace(message: &str) {
    if std::env::var_os("COVERT_DESKTOP_BOOT_TRACE").is_some() {
        eprintln!("[COVERT_DESKTOP_BOOT] {message}");
    }
}

#[tauri::command]
fn authority_pairing(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, PairingProof>,
) -> Result<String, String> {
    if window.label() != "main" {
        return Err("untrusted bootstrap window".into());
    }
    let origin = window
        .url()
        .map_err(|_| "window origin unavailable")?
        .origin()
        .ascii_serialization();
    let mut pending = state.0.lock().map_err(|_| "bootstrap unavailable")?;
    let Some((_, expected_origin)) = pending.as_ref() else {
        return Err("pairing already consumed or unavailable".into());
    };
    if &origin != expected_origin {
        return Err("bootstrap origin mismatch".into());
    }
    pending
        .take()
        .map(|(proof, _)| proof)
        .ok_or_else(|| "bootstrap unavailable".into())
}

fn read_pairing(child: &mut Child) -> Result<String, String> {
    let stdout = child
        .stdout
        .take()
        .ok_or("private bootstrap pipe unavailable")?;
    let (tx, rx) = mpsc::sync_channel(1);
    thread::spawn(move || {
        let mut line = String::new();
        let result = BufReader::new(stdout).take(128).read_line(&mut line);
        let proof = line.trim().strip_prefix("COVERT_PAIRING_V1 ").unwrap_or("");
        let valid = result.is_ok()
            && proof.len() == 43
            && proof
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_');
        let _ = tx.send(if valid {
            Ok(proof.to_owned())
        } else {
            Err("invalid private bootstrap response".to_string())
        });
    });
    rx.recv_timeout(Duration::from_secs(60))
        .map_err(|_| "private bootstrap timed out".to_string())?
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
            return Err(format!(
                "desktop stack exited before facade readiness: {status}"
            ));
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

fn main() {
    tauri::Builder::default()
        .manage(DaemonProcess(Mutex::new(None)))
        .manage(PairingProof(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![authority_pairing])
        .setup(|app| {
            let resource_dir = strip_verbatim_prefix(
                &app.path()
                    .resource_dir()
                    .map_err(|error| error.to_string())?,
            );
            let node_name = if cfg!(windows) { "node.exe" } else { "node" };
            let resource_root = resolve_desktop_resource_root(&resource_dir, node_name)?;
            let node = resource_root.join("runtime").join(node_name);
            let launcher = resource_root.join("stack-launcher.mjs");
            startup_trace(&format!("resource_dir={resource_dir:?}; resource_root={resource_root:?}; node={node:?}; launcher={launcher:?}"));
            let origin = if cfg!(debug_assertions) {
                "http://127.0.0.1:5173"
            } else if cfg!(windows) {
                "http://tauri.localhost"
            } else {
                "tauri://localhost"
            };
            let mut child = Command::new(node)
                .arg(&launcher)
                .arg("--native-bootstrap")
                .arg(format!("--pair-origin={origin}"))
                .stdin(Stdio::null())
                .stdout(Stdio::piped())
                .current_dir(&resource_root)
                .env("AIDE_WORKSPACE", &resource_root)
                .env("AIDE_MODEL_DIR", resource_root.join("models"))
                .env("AIDE_ARCH_PORT", "4778")
                .env("AIDE_LEGACY_PORT", "4779")
                .env("AIDE_FACADE_PORT", "4777")
                .env(
                    "AIDE_LLAMA_SERVER",
                    resource_root.join("runtime").join(if cfg!(windows) {
                        "llama-server.exe"
                    } else {
                        "llama-server"
                    }),
                )
                .spawn()
                .map_err(|error| error.to_string())?;
            startup_trace(&format!("stack process spawned pid={}", child.id()));
            let proof = match read_pairing(&mut child) {
                Ok(proof) => proof,
                Err(error) => {
                    startup_trace(&format!("private pairing failed: {error}"));
                    terminate_tree(&mut child);
                    return Err(error.into());
                }
            };
            startup_trace("private pairing received");
            if let Err(error) = wait_for_facade(&mut child) {
                startup_trace(&format!("facade readiness failed: {error}"));
                terminate_tree(&mut child);
                return Err(error.into());
            }
            startup_trace("facade readiness passed");
            let state = app.state::<DaemonProcess>();
            *state.0.lock().map_err(|error| error.to_string())? = Some(child);
            *app.state::<PairingProof>()
                .0
                .lock()
                .map_err(|_| "bootstrap lock unavailable")? = Some((proof, origin.to_string()));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building AIDE desktop shell")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(mut child) = app
                    .state::<DaemonProcess>()
                    .0
                    .lock()
                    .ok()
                    .and_then(|mut state| state.take())
                {
                    terminate_tree(&mut child);
                }
            }
        });
}

#[cfg(test)]
mod resource_root_tests {
    use super::{resolve_desktop_resource_root, strip_verbatim_prefix};
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};

    struct TempRoot(PathBuf);

    impl TempRoot {
        fn new() -> Self {
            let nonce = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let path = std::env::temp_dir().join(format!(
                "covert-resource-root-{}-{nonce}",
                std::process::id()
            ));
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }
    }

    impl Drop for TempRoot {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn stage_runtime(root: &Path) {
        fs::create_dir_all(root.join("runtime")).unwrap();
        fs::write(root.join("runtime").join("node.exe"), b"fixture runtime").unwrap();
        fs::write(root.join("stack-launcher.mjs"), b"fixture launcher").unwrap();
    }

    #[test]
    fn resolves_nested_tauri_resources_directory() {
        let temp = TempRoot::new();
        let nested = temp.0.join("resources");
        stage_runtime(&nested);
        assert_eq!(
            resolve_desktop_resource_root(&temp.0, "node.exe").unwrap(),
            nested
        );
    }

    #[test]
    fn resolves_direct_resource_directory() {
        let temp = TempRoot::new();
        stage_runtime(&temp.0);
        assert_eq!(
            resolve_desktop_resource_root(&temp.0, "node.exe").unwrap(),
            temp.0
        );
    }

    #[test]
    fn refuses_missing_resource_layout() {
        let temp = TempRoot::new();
        assert_eq!(
            resolve_desktop_resource_root(&temp.0, "node.exe").unwrap_err(),
            "required desktop runtime resources are missing"
        );
    }

    #[test]
    fn refuses_ambiguous_resource_layout() {
        let temp = TempRoot::new();
        stage_runtime(&temp.0);
        stage_runtime(&temp.0.join("resources"));
        assert_eq!(
            resolve_desktop_resource_root(&temp.0, "node.exe").unwrap_err(),
            "desktop runtime resource root is ambiguous"
        );
    }

    #[test]
    fn strips_verbatim_drive_prefix_for_process_spawning() {
        assert_eq!(
            strip_verbatim_prefix(Path::new(r"\\?\E:\root\resources")),
            PathBuf::from(r"E:\root\resources")
        );
    }

    #[test]
    fn strips_verbatim_unc_prefix_for_process_spawning() {
        assert_eq!(
            strip_verbatim_prefix(Path::new(r"\\?\UNC\server\share\root")),
            PathBuf::from(r"\\server\share\root")
        );
    }

    #[test]
    fn preserves_already_plain_paths() {
        assert_eq!(
            strip_verbatim_prefix(Path::new(r"E:\root\resources")),
            PathBuf::from(r"E:\root\resources")
        );
    }
}
