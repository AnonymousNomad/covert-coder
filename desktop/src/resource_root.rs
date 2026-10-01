use std::path::{Path, PathBuf};

fn node_compatible_root(root: &Path) -> Result<PathBuf, String> {
    // Tauri canonicalizes the executable path on Windows. Node 22.20.0's
    // entrypoint resolver rejects verbatim paths before the launcher runs.
    // Simplify only where legacy Windows path semantics preserve identity.
    let root = dunce::simplified(root);
    #[cfg(windows)]
    if matches!(root.components().next(), Some(std::path::Component::Prefix(prefix))
        if matches!(prefix.kind(), std::path::Prefix::Verbatim(_)
            | std::path::Prefix::VerbatimDisk(_)
            | std::path::Prefix::VerbatimUNC(_, _)))
    {
        return Err(
            "desktop resource path requires Windows verbatim semantics unsupported by bundled Node"
                .into(),
        );
    }
    Ok(root.to_path_buf())
}

pub(super) fn resolve_resource_root(
    resource_dir: &Path,
    node_name: &str,
) -> Result<PathBuf, String> {
    let candidates = [resource_dir.to_path_buf(), resource_dir.join("resources")];
    let mut matching = candidates
        .into_iter()
        .filter(|root| {
            root.join("runtime").join(node_name).is_file()
                && root.join("stack-launcher.mjs").is_file()
        })
        .collect::<Vec<_>>();
    match matching.len() {
        0 => Err("required desktop runtime resources are missing".into()),
        1 => node_compatible_root(&matching.remove(0)),
        _ => Err("ambiguous desktop runtime resource roots".into()),
    }
}

#[cfg(test)]
mod tests {
    #[cfg(windows)]
    use super::node_compatible_root;
    use super::resolve_resource_root;
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::sync::atomic::{AtomicU64, Ordering};

    static NEXT_FIXTURE: AtomicU64 = AtomicU64::new(0);

    struct Fixture(PathBuf);

    impl Fixture {
        fn new() -> Self {
            let root = std::env::temp_dir().join(format!(
                "covert-desktop-resource-root-{}-{}",
                std::process::id(),
                NEXT_FIXTURE.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir_all(&root).expect("create resource-root fixture");
            Self(root)
        }

        fn add_complete_layout(&self, relative_root: &str, node_name: &str) {
            let root = self.0.join(relative_root);
            fs::create_dir_all(root.join("runtime")).expect("create runtime fixture directory");
            fs::write(root.join("runtime").join(node_name), b"node fixture")
                .expect("write node fixture");
            fs::write(root.join("stack-launcher.mjs"), b"launcher fixture")
                .expect("write launcher fixture");
        }

        fn add_node_only(&self, relative_root: &str, node_name: &str) {
            let root = self.0.join(relative_root).join("runtime");
            fs::create_dir_all(&root).expect("create partial runtime fixture directory");
            fs::write(root.join(node_name), b"node fixture").expect("write node fixture");
        }

        fn path(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn accepts_direct_resource_layout() {
        let fixture = Fixture::new();
        fixture.add_complete_layout(".", "node.exe");
        let resolved = resolve_resource_root(fixture.path(), "node.exe").unwrap();
        assert_eq!(resolved.as_path(), fixture.path());
    }

    #[test]
    fn accepts_nested_bundle_resource_layout() {
        let fixture = Fixture::new();
        fixture.add_complete_layout("resources", "node.exe");
        let resolved = resolve_resource_root(fixture.path(), "node.exe").unwrap();
        assert_eq!(resolved, fixture.path().join("resources"));
    }

    #[cfg(windows)]
    #[test]
    fn canonical_windows_resource_root_is_safe_for_node_entrypoints() {
        let fixture = Fixture::new();
        fixture.add_complete_layout("resources with spaces", "node.exe");
        let canonical = fixture
            .path()
            .join("resources with spaces")
            .canonicalize()
            .unwrap();
        let resolved = resolve_resource_root(&canonical, "node.exe").unwrap();
        assert!(
            !resolved.as_os_str().to_string_lossy().starts_with(r"\\?\"),
            "Node 22 cannot resolve a namespaced entrypoint"
        );
        assert_eq!(
            resolved.canonicalize().unwrap(),
            canonical,
            "same resource identity"
        );
    }

    #[cfg(windows)]
    #[test]
    fn unconvertible_verbatim_paths_fail_without_changing_their_semantics() {
        for root in [
            PathBuf::from(r"\\?\C:\resource with trailing space "),
            PathBuf::from(r"\\?\C:\CON\resources"),
            PathBuf::from(r"\\?\UNC\server\share\resources"),
            PathBuf::from(format!(r"\\?\C:\{}", "x".repeat(270))),
        ] {
            let error = node_compatible_root(&root).unwrap_err();
            assert!(error.contains("unsupported by bundled Node"));
            assert!(
                !error.contains(root.to_str().unwrap()),
                "no path data in classification"
            );
        }
    }

    #[cfg(windows)]
    #[test]
    fn bundled_node_executes_the_same_launcher_from_a_canonical_resource_path() {
        use std::process::{Command, Stdio};
        let node = Path::new(env!("CARGO_MANIFEST_DIR")).join("resources/runtime/node.exe");
        assert!(
            node.is_file(),
            "desktop:verify must stage the actual bundled Node first"
        );
        let fixture = Fixture::new();
        fixture.add_complete_layout("resources with spaces", "node.exe");
        let root = fixture.path().join("resources with spaces");
        fs::write(
            root.join("stack-launcher.mjs"),
            "process.stdout.write('NATIVE_PATH_CANARY\\n');",
        )
        .unwrap();
        let canonical = root.canonicalize().unwrap();
        let resolved = resolve_resource_root(&canonical, "node.exe").unwrap();
        let output = Command::new(node)
            .arg(resolved.join("stack-launcher.mjs"))
            .current_dir(&resolved)
            .stdin(Stdio::null())
            .output()
            .expect("start bundled Node entrypoint");
        assert!(
            output.status.success(),
            "bundled Node must initialize the launcher"
        );
        assert_eq!(output.stdout, b"NATIVE_PATH_CANARY\n");
        assert!(output.stderr.is_empty());
        assert_eq!(resolved.canonicalize().unwrap(), canonical);
    }

    #[test]
    fn rejects_missing_or_incomplete_resource_layout() {
        let fixture = Fixture::new();
        assert!(resolve_resource_root(fixture.path(), "node.exe").is_err());
        fixture.add_node_only(".", "node.exe");
        assert!(resolve_resource_root(fixture.path(), "node.exe").is_err());
    }

    #[test]
    fn rejects_ambiguous_resource_layout() {
        let fixture = Fixture::new();
        fixture.add_complete_layout(".", "node.exe");
        fixture.add_complete_layout("resources", "node.exe");
        let error = resolve_resource_root(fixture.path(), "node.exe").unwrap_err();
        assert!(error.contains("ambiguous"));
    }
}
