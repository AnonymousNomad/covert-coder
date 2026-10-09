#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs::OpenOptions;
use std::io::{self, BufRead, BufReader, Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{mpsc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::Manager;

mod resource_root;
#[cfg(windows)]
mod runtime_job;

struct DaemonProcess(Mutex<Option<Child>>);
struct PairingProof(Mutex<Option<(String, String)>>);

const STARTUP_DIAGNOSTIC_ENV: &str = "COVERT_DESKTOP_STARTUP_DIAGNOSTIC_ID";
const STARTUP_DIAGNOSTIC_MAX_CHARS: usize = 2048;

fn startup_diagnostic_path(id: &str, process_id: u32) -> Option<PathBuf> {
    if id.len() != 32 || !id.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return None;
    }
    Some(std::env::temp_dir().join(format!("covert-desktop-startup-{id}-{process_id}.log")))
}

fn redact_startup_diagnostic(input: &str) -> String {
    const MARKER: &str = "COVERT_PAIRING_V1 ";
    let mut output = String::with_capacity(input.len());
    let mut cursor = 0;
    while let Some(relative_marker) = input[cursor..].find(MARKER) {
        let marker_start = cursor + relative_marker;
        let proof_start = marker_start + MARKER.len();
        output.push_str(&input[cursor..proof_start]);
        let proof_end = input[proof_start..]
            .find(char::is_whitespace)
            .map(|relative_end| proof_start + relative_end)
            .unwrap_or(input.len());
        output.push_str("[redacted]");
        cursor = proof_end;
    }
    output.push_str(&input[cursor..]);
    output
}

fn bound_startup_diagnostic(input: &str) -> String {
    let mut characters = input.chars();
    let mut output = characters
        .by_ref()
        .take(STARTUP_DIAGNOSTIC_MAX_CHARS)
        .collect::<String>();
    if characters.next().is_some() {
        output.push_str(" [truncated]");
    }
    output
}

fn write_startup_diagnostic(path: &Path, message: &str) -> std::io::Result<()> {
    let mut file = OpenOptions::new().write(true).create_new(true).open(path)?;
    let safe_message = bound_startup_diagnostic(&redact_startup_diagnostic(message));
    writeln!(file, "{safe_message}")
}

fn install_startup_panic_diagnostics() {
    let diagnostic_id = std::env::var(STARTUP_DIAGNOSTIC_ENV).ok();
    std::env::remove_var(STARTUP_DIAGNOSTIC_ENV);
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |panic_info| {
        let recorded = diagnostic_id
            .as_deref()
            .and_then(|id| startup_diagnostic_path(id, std::process::id()))
            .map(|path| write_startup_diagnostic(&path, &panic_info.to_string()).is_ok())
            .unwrap_or(false);
        if !recorded {
            default_hook(panic_info);
        }
    }));
}

fn validate_pairing_response(line: &str, read_result: &io::Result<usize>) -> Result<String, String> {
    const PREFIX: &str = "COVERT_PAIRING_V1 ";
    let read_bytes = match read_result {
        Ok(bytes) => *bytes,
        Err(error) => {
            return Err(format!(
                "invalid private bootstrap response (read_error={:?}, line_bytes={})",
                error.kind(),
                line.len()
            ));
        }
    };
    let candidate = line.trim();
    let Some(proof) = candidate.strip_prefix(PREFIX) else {
        return Err(format!(
            "invalid private bootstrap response (read_bytes={read_bytes}, prefix_match=false, marker_present={}, utf8_bom={})",
            line.contains(PREFIX),
            line.starts_with('\u{feff}')
        ));
    };
    let charset_valid = proof
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_');
    if proof.len() != 43 || !charset_valid {
        return Err(format!(
            "invalid private bootstrap response (read_bytes={read_bytes}, prefix_match=true, proof_bytes={}, charset_valid={charset_valid})",
            proof.len()
        ));
    }
    Ok(proof.to_owned())
}

#[cfg(test)]
mod startup_diagnostic_tests {
    use super::{
        bound_startup_diagnostic, redact_startup_diagnostic, startup_diagnostic_path,
        bootstrap_child_state_metadata, validate_pairing_response, write_startup_diagnostic,
        STARTUP_DIAGNOSTIC_MAX_CHARS,
    };
    use std::fs;
    use std::process::Command;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn diagnostic_id_rejects_path_components() {
        assert!(startup_diagnostic_path("0123456789abcdef0123456789abcdef", 7).is_some());
        assert!(startup_diagnostic_path("../not-a-diagnostic-id", 7).is_none());
    }

    #[test]
    fn panic_message_redacts_pairing_proofs_and_is_bounded() {
        let proof = "P".repeat(43);
        let input = format!(
            "setup failed: COVERT_PAIRING_V1 {proof} {}",
            "x".repeat(3000)
        );
        let safe = bound_startup_diagnostic(&redact_startup_diagnostic(&input));
        assert!(!safe.contains(&proof));
        assert!(safe.contains("COVERT_PAIRING_V1 [redacted]"));
        assert!(safe.chars().count() <= STARTUP_DIAGNOSTIC_MAX_CHARS + " [truncated]".len());
    }

    #[test]
    fn diagnostic_file_is_created_once_and_contains_only_redacted_text() {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock is after Unix epoch")
            .as_nanos();
        let id = format!("{:032x}", nanos ^ ((std::process::id() as u128) << 96));
        let path = startup_diagnostic_path(&id, std::process::id()).expect("valid diagnostic id");
        let proof = "S".repeat(43);
        write_startup_diagnostic(
            &path,
            &format!("native startup panic: COVERT_PAIRING_V1 {proof}"),
        )
        .expect("create diagnostic record");
        let contents = fs::read_to_string(&path);
        let duplicate = write_startup_diagnostic(&path, "second write");
        let cleanup = fs::remove_file(&path);
        let contents = contents.expect("read diagnostic record");
        cleanup.expect("remove temporary diagnostic record");
        assert!(duplicate.is_err(), "diagnostic file must not be overwritten");
        assert!(!contents.contains(&proof));
        assert!(contents.contains("COVERT_PAIRING_V1 [redacted]"));
    }

    #[test]
    fn valid_private_bootstrap_frame_is_accepted_without_changing_the_proof() {
        let proof = "A".repeat(43);
        let line = format!("COVERT_PAIRING_V1 {proof}\r\n");
        assert_eq!(validate_pairing_response(&line, &Ok(line.len())).as_deref(), Ok(proof.as_str()));
    }

    #[test]
    fn invalid_private_bootstrap_frame_reports_only_safe_shape_metadata() {
        let line = "unexpected launcher response: sensitive detail";
        let error = validate_pairing_response(line, &Ok(line.len())).unwrap_err();
        assert!(error.contains("prefix_match=false"));
        assert!(error.contains("marker_present=false"));
        assert!(!error.contains("unexpected launcher response"));
        assert!(!error.contains("sensitive detail"));
    }

    #[test]
    fn malformed_private_bootstrap_proof_reports_length_and_charset_only() {
        let proof = "A".repeat(42);
        let line = format!("COVERT_PAIRING_V1 {proof}");
        let error = validate_pairing_response(&line, &Ok(line.len())).unwrap_err();
        assert!(error.contains("proof_bytes=42"));
        assert!(error.contains("charset_valid=true"));
        assert!(!error.contains(&proof));
    }

    #[test]
    fn byte_order_mark_is_identified_without_recording_the_pairing_proof() {
        let proof = "A".repeat(43);
        let line = format!("\u{feff}COVERT_PAIRING_V1 {proof}");
        let error = validate_pairing_response(&line, &Ok(line.len())).unwrap_err();
        assert!(error.contains("marker_present=true"));
        assert!(error.contains("utf8_bom=true"));
        assert!(!error.contains(&proof));
    }

    #[test]
    fn bootstrap_failure_can_report_child_exit_code_without_child_output() {
        let mut command = if cfg!(windows) {
            let mut command = Command::new("cmd.exe");
            command.args(["/d", "/c", "exit", "/b", "23"]);
            command
        } else {
            let mut command = Command::new("sh");
            command.args(["-c", "exit 23"]);
            command
        };
        let mut child = command.spawn().expect("spawn short-lived child");
        let status = child.wait().expect("wait for short-lived child");
        assert_eq!(status.code(), Some(23));
        assert_eq!(bootstrap_child_state_metadata(&mut child), "child_exited=true, child_exit_code=23");
    }
}

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
        let _ = tx.send(validate_pairing_response(&line, &result));
    });
    rx.recv_timeout(Duration::from_secs(60)).map_err(|_| "private bootstrap timed out".to_string())?
}

fn bootstrap_child_state_metadata(child: &mut Child) -> String {
    match child.try_wait() {
        Ok(Some(status)) => match status.code() {
            Some(code) => format!("child_exited=true, child_exit_code={code}"),
            None => "child_exited=true, child_exit_code=unavailable".to_string(),
        },
        Ok(None) => "child_exited=false".to_string(),
        Err(error) => format!("child_wait_error={:?}", error.kind()),
    }
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

fn main() {
    install_startup_panic_diagnostics();
    #[cfg(windows)]
    runtime_job::bind_current_process()
        .expect("required Windows desktop runtime containment unavailable");
    tauri::Builder::default()
        .manage(DaemonProcess(Mutex::new(None)))
        .manage(PairingProof(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![authority_pairing])
        .setup(|app| {
            let node_name = if cfg!(windows) { "node.exe" } else { "node" };
            let resource_dir = app.path().resource_dir().map_err(|error| error.to_string())?;
            let resource_root = resource_root::resolve_resource_root(&resource_dir, node_name)?;
            let node = resource_root.join("runtime").join(node_name);
            let launcher = resource_root.join("stack-launcher.mjs");
            if node.exists() && launcher.exists() {
                let origin = if cfg!(debug_assertions) { "http://127.0.0.1:5173" }
                    else if cfg!(windows) { "http://tauri.localhost" } else { "tauri://localhost" };
                let mut child = Command::new(node)
                    .arg(&launcher)
                    .arg("--native-bootstrap")
                    .arg(format!("--pair-origin={origin}"))
                    .stdin(Stdio::null())
                    .stdout(Stdio::piped())
                    .current_dir(&resource_root)
                    .env("AIDE_WORKSPACE", &resource_root)
                    .env("AIDE_ARCH_PORT", "4778")
                    .env("AIDE_LEGACY_PORT", "4779")
                    .env("AIDE_FACADE_PORT", "4777")
                    .env("AIDE_LLAMA_SERVER", resource_root.join("runtime").join(if cfg!(windows) { "llama-server.exe" } else { "llama-server" }))
                    .spawn()
                    .map_err(|error| error.to_string())?;
                let proof = match read_pairing(&mut child) {
                    Ok(proof) => proof,
                    Err(error) => {
                        let child_state = bootstrap_child_state_metadata(&mut child);
                        terminate_tree(&mut child);
                        return Err(format!("{error} ({child_state})").into());
                    }
                };
                if let Err(error) = wait_for_facade(&mut child) {
                    terminate_tree(&mut child);
                    return Err(error.into());
                }
                let state = app.state::<DaemonProcess>();
                *state.0.lock().map_err(|error| error.to_string())? = Some(child);
                *app.state::<PairingProof>().0.lock().map_err(|_| "bootstrap lock unavailable")? = Some((proof, origin.to_string()));
            } else {
                return Err("required desktop runtime resources are missing".into());
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
