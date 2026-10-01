use std::path::{Path, PathBuf};

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
        1 => Ok(matching.remove(0)),
        _ => Err("ambiguous desktop runtime resource roots".into()),
    }
}

#[cfg(test)]
mod tests {
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
