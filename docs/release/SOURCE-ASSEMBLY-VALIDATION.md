# Source assembly validation

The exact source candidate was exercised in a separate clean-install assembly
worktree. No candidate object was edited.

- `npm ci --ignore-scripts`: PASS; 127 packages added and npm reported zero
  vulnerabilities.
- `npm run doctor`: PASS, 10/10 checks; warnings correctly remained for the
  absent local llama-server, absent model artifact, and absent debugpy.
- `npm audit --package-lock-only --json`: PASS; zero vulnerabilities were
  reported by that audit database at generation time. This is not a universal
  security guarantee.
- `npm run check`: PASS; 691 tests, 680 passed, 0 failed, 11 documented skips.
- `npm run build:frontend`: PASS; the existing large-chunk warning remains a
  performance note, not a false failure.
- `npm start`: PASS; the typed UI and facade became reachable on ports 4173 and
  4777. `/` and `/api/health` both returned HTTP 200.
- Shutdown: PASS; the owned stack tree was terminated, all product ports were
  released, and no assembly-worktree Node processes remained.
- Source archive integrity: PASS; the archive contains 1,417 file entries and
  its `package-lock.json` hash matches the certified lockfile hash.

Interactive browser pairing was not repeated in this non-PTY assembly probe;
it is not promoted to a pass from startup alone. Pairing is covered by the
independent candidate certification record.
