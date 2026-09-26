import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const STALE_AIDE_HASHES = new Set([
  'C6A3E9840F40EB13ED2499FF9393E291658834328D3BDA8A8694D1456A28C416',
  'B860C258ADD7F7793DA687E646F98003C3A0CF0EC698F703BC295C393E23A753',
  '039151F0685069DC7120FACC26AAF8EF3CE2A7C554F7319171E384143E54FF61'
]);

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const status = (value, detail) => ({ value, status: value === undefined || value === null || value === '' ? 'NOT CONFIGURED' : 'PRESENT + UNVERIFIED', ...(detail ? { detail } : {}) });
const parseCargoValue = (text, key) => {
  const match = text.match(new RegExp('^' + key + '\\s*=\\s*"([^"]+)"', 'm'));
  return match?.[1] ?? null;
};

export async function inspectIdentity(root) {
  const packageJson = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  const tauri = JSON.parse(await fs.readFile(path.join(root, 'desktop', 'tauri.conf.json'), 'utf8'));
  const cargo = await fs.readFile(path.join(root, 'desktop', 'Cargo.toml'), 'utf8');
  const cargoName = parseCargoValue(cargo, 'name');
  const cargoVersion = parseCargoValue(cargo, 'version');
  const tauriVersion = tauri.version ?? null;
  const packageVersion = packageJson.version ?? null;
  const icons = [];
  for (const configured of tauri.bundle?.icon ?? []) {
    const absolute = path.resolve(root, 'desktop', configured);
    try {
      const bytes = await fs.readFile(absolute);
      const digest = sha256(bytes);
      icons.push({
        configured_path: path.relative(root, absolute).replaceAll(path.sep, '/'),
        exists: true,
        size_bytes: bytes.byteLength,
        sha256: digest,
        classification: STALE_AIDE_HASHES.has(digest) ? 'KNOWN STALE AIDE IDENTITY' : 'UNVERIFIED ASSET'
      });
    } catch {
      icons.push({
        configured_path: path.relative(root, absolute).replaceAll(path.sep, '/'),
        exists: false,
        size_bytes: null,
        sha256: null,
        classification: 'MISSING ASSET'
      });
    }
  }
  const bundle = tauri.bundle ?? {};
  const windows = bundle.windows ?? {};
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  const updaterConfigured = Object.keys(dependencies).some(name => name.includes('updater'))
    || bundle.createUpdaterArtifacts === true
    || typeof tauri.plugins?.updater === 'object';
  return {
    schema_version: 1,
    status: 'INSPECTED',
    product_name: status(tauri.productName),
    window_title: status(tauri.app?.windows?.[0]?.title),
    tauri_identifier: status(tauri.identifier),
    main_binary: status(cargoName ? cargoName + '.exe' : null, 'Derived from desktop/Cargo.toml package name; no explicit [[bin]] entry was found by this validator.'),
    package_name: status(packageJson.name),
    versions: {
      package_json: status(packageVersion),
      cargo: status(cargoVersion),
      tauri: status(tauriVersion),
      values_agree: new Set([packageVersion, cargoVersion, tauriVersion]).size === 1 ? 'YES' : 'NO'
    },
    bundle_targets: status(bundle.targets, 'Tauri target selection; actual artifacts require a build record.'),
    publisher: {
      configured: status(bundle.publisher),
      inferred_from_identifier: tauri.identifier?.split('.')[1] ?? null,
      verified_signing_publisher: 'UNVERIFIED'
    },
    windows: {
      target_formats: bundle.targets === 'all' || bundle.targets?.includes?.('all')
        ? ['NSIS', 'MSI/WiX (default Tauri Windows formats)']
        : Array.isArray(bundle.targets) ? bundle.targets : [bundle.targets].filter(Boolean),
      wix_upgrade_code: status(windows.wix?.upgradeCode),
      nsis: windows.nsis ? 'CONFIGURED' : 'NOT CONFIGURED',
      wix: windows.wix ? 'CONFIGURED' : 'NOT CONFIGURED',
      allow_downgrades: status(windows.allowDowngrades),
      config_present: Object.keys(windows).length > 0
    },
    icons,
    updater: updaterConfigured ? 'PRESENT + UNVERIFIED' : 'NOT CONFIGURED',
    source_files: ['package.json', 'desktop/Cargo.toml', 'desktop/tauri.conf.json']
  };
}

export function evaluateVersionConsistency({ sources, canonical_source, source_policy }) {
  if (!canonical_source) {
    return {
      status: 'BLOCKED — VERSION OWNER UNRESOLVED',
      canonical_source: null,
      versions: sources,
      mapped_sources: [],
      mismatches: []
    };
  }
  const canonical = sources[canonical_source];
  if (typeof canonical !== 'string' || canonical.length === 0) {
    return {
      status: 'FAIL — CANONICAL SOURCE MISSING',
      canonical_source,
      versions: sources,
      mapped_sources: [],
      mismatches: Object.keys(sources)
    };
  }
  if (!source_policy || typeof source_policy !== 'object') {
    return {
      status: 'BLOCKED — VERSION SOURCE SEMANTICS UNRESOLVED',
      canonical_source,
      versions: sources,
      mapped_sources: [],
      mismatches: []
    };
  }
  const unmapped = Object.keys(sources).filter(name => !source_policy[name]);
  if (unmapped.length) {
    return {
      status: 'BLOCKED — VERSION SOURCE SEMANTICS UNRESOLVED',
      canonical_source,
      versions: sources,
      mapped_sources: Object.keys(sources).filter(name => source_policy[name]),
      mismatches: [],
      unmapped_sources: unmapped
    };
  }
  if (source_policy[canonical_source].relationship !== 'canonical') {
    return {
      status: 'FAIL — CANONICAL ROLE MISMATCH',
      canonical_source,
      versions: sources,
      mapped_sources: Object.keys(sources),
      mismatches: [{ source: canonical_source, reason: 'canonical source is not assigned the canonical relationship' }]
    };
  }
  const unsupported = Object.entries(source_policy).filter(([name, policy]) =>
    !Object.hasOwn(sources, name)
    || (name !== canonical_source && policy.relationship === 'derived' && policy.rule !== 'exact')
    || (name !== canonical_source && !['derived', 'independent'].includes(policy.relationship))
    || (policy.relationship === 'independent' && !policy.rationale)
  );
  if (unsupported.length) {
    return {
      status: 'BLOCKED — UNSUPPORTED OR UNJUSTIFIED VERSION MAPPING',
      canonical_source,
      versions: sources,
      mapped_sources: Object.keys(sources),
      mismatches: unsupported.map(([source]) => ({ source, reason: 'version mapping lacks an accepted rule or rationale' }))
    };
  }
  const mismatches = Object.entries(sources)
    .filter(([name, value]) => source_policy[name].relationship === 'derived' && value !== canonical)
    .map(([name, value]) => ({ source: name, expected: canonical, actual: value }));
  return {
    status: mismatches.length === 0 ? 'PASS' : 'FAIL — VERSION MISMATCH',
    canonical_source,
    versions: sources,
    mapped_sources: Object.keys(sources),
    independent_sources: Object.entries(source_policy)
      .filter(([, policy]) => policy.relationship === 'independent')
      .map(([name]) => name),
    mismatches
  };
}

export async function inspectVersionConsistency(root) {
  const identity = await inspectIdentity(root);
  const sources = {
    package_json: identity.versions.package_json.value,
    cargo: identity.versions.cargo.value,
    tauri: identity.versions.tauri.value
  };
  const policyPath = path.join(root, 'docs', 'v1', 'packaging', 'VERSION-OWNER.json');
  let canonicalSource = null;
  let sourcePolicy = null;
  let policyStatus = 'MISSING — VERSION OWNER UNRESOLVED';
  try {
    const policy = JSON.parse(await fs.readFile(policyPath, 'utf8'));
    if (policy.schema_version === 1
      && policy.approved === true
      && Object.hasOwn(sources, policy.canonical_source)
      && policy.source_policy
      && policy.approved_by
      && policy.rationale) {
      canonicalSource = policy.canonical_source;
      sourcePolicy = policy.source_policy;
      policyStatus = 'APPROVED POLICY PRESENT';
    } else policyStatus = 'INVALID OR UNAPPROVED VERSION OWNER POLICY';
  } catch (error) {
    if (error.code !== 'ENOENT') policyStatus = 'INVALID VERSION OWNER POLICY';
  }
  const result = evaluateVersionConsistency({ sources, canonical_source: canonicalSource, source_policy: sourcePolicy });
  if (policyStatus.startsWith('INVALID')) result.status = 'FAIL — INVALID VERSION OWNER POLICY';
  return { ...result, owner_policy: { path: 'docs/v1/packaging/VERSION-OWNER.json', status: policyStatus } };
}

export function evaluateBrandingAssets(configuredAssets, candidateAssets = []) {
  const missing = configuredAssets.filter(asset => !asset.exists);
  const stale = configuredAssets.filter(asset => asset.sha256 && STALE_AIDE_HASHES.has(asset.sha256.toUpperCase()));
  const surfaces = new Map();
  for (const asset of configuredAssets.filter(item => item.surface && item.exists && item.sha256)) {
    const group = surfaces.get(asset.surface) ?? [];
    group.push(asset);
    surfaces.set(asset.surface, group);
  }
  const conflictingSurfaces = [...surfaces.entries()]
    .filter(([, group]) => new Set(group.map(item => item.sha256.toUpperCase())).size > 1)
    .map(([surface, assets]) => ({ surface, assets }));
  const byDigest = new Map();
  for (const asset of configuredAssets.filter(item => item.exists && item.sha256)) {
    const group = byDigest.get(asset.sha256.toUpperCase()) ?? [];
    group.push(asset.path);
    byDigest.set(asset.sha256.toUpperCase(), group);
  }
  const duplicateGroups = [...byDigest.values()].filter(group => group.length > 1);
  return {
    status: missing.length ? 'FAIL — MISSING ASSET' : stale.length ? 'FAIL — STALE AIDE ASSET' : conflictingSurfaces.length ? 'FAIL — CONFLICTING SURFACE ASSET' : 'UNVERIFIED — CANONICAL COVERT BRANDING NOT APPROVED',
    configured_assets: configuredAssets,
    missing,
    stale,
    duplicate_groups: duplicateGroups,
    conflicting_surfaces: conflictingSurfaces,
    unreferenced_candidates: candidateAssets.filter(asset => !asset.referenced_by_config),
    canonical_current_covert_asset: 'BRANDING INPUT REQUIRED',
    identity_surfaces: {
      window_icon: { source: 'desktop/icons/icon.png and desktop/icons/icon.ico via Tauri bundle.icon', status: 'CONFIGURED + NOT BUILT/RENDER VERIFIED' },
      taskbar_icon: { source: 'expected executable/window icon inheritance', status: 'UNVERIFIED' },
      executable_icon: { source: 'generated by Tauri from configured bundle icons', status: 'SOURCE INPUT FOUND; OUTPUT NOT BUILT IN THIS LANE' },
      installer_icon: { source: 'Tauri bundle icon input', status: 'OUTPUT NOT INSPECTED' },
      start_menu_and_desktop_shortcuts: { source: 'installer/executable icon inheritance', status: 'LEGACY SHORTCUTS OBSERVED; CURRENT CANDIDATE NOT BUILT' },
      apps_and_features_icon: { source: 'uninstall registration/executable icon', status: 'LEGACY EXECUTABLE DISPLAY ICON OBSERVED; CURRENT CANDIDATE NOT BUILT' },
      splash_and_about: { source: null, status: 'NO CANONICAL SOURCE IDENTIFIED IN FROZEN PREFLIGHT' },
      public_shared_logo: { source: 'docs/assets/branding/covert-coder-emblem.png', status: 'REFERENCE ONLY; NOT AN APPROVED PACKAGED LOGO' }
    }
  };
}

export async function inspectBranding(root) {
  const identity = await inspectIdentity(root);
  const candidatePaths = ['desktop/icons/icon.svg', 'docs/assets/branding/covert-coder-emblem.png'];
  const candidateAssets = [];
  for (const relativePath of candidatePaths) {
    const absolute = path.join(root, relativePath);
    try {
      const bytes = await fs.readFile(absolute);
      const digest = sha256(bytes);
      candidateAssets.push({
        path: relativePath,
        exists: true,
        size_bytes: bytes.byteLength,
        sha256: digest,
        classification: STALE_AIDE_HASHES.has(digest) ? 'KNOWN STALE AIDE IDENTITY' : 'UNAPPROVED CANDIDATE',
        referenced_by_config: identity.icons.some(icon => icon.configured_path === relativePath)
      });
    } catch {
      candidateAssets.push({ path: relativePath, exists: false, size_bytes: null, sha256: null, classification: 'MISSING CANDIDATE', referenced_by_config: false });
    }
  }
  const configured = identity.icons.map(icon => ({
    path: icon.configured_path,
    exists: icon.exists,
    sha256: icon.sha256,
    surface: path.extname(icon.configured_path).slice(1).toUpperCase() + ' bundle input'
  }));
  return evaluateBrandingAssets(configured, candidateAssets);
}

export async function generateArtifactManifest({
  directory,
  sourceSha = null,
  buildVersion = null,
  productIdentity = null,
  buildTimestamp = null
}) {
  const absoluteRoot = await fs.realpath(directory);
  const paths = [];
  async function visit(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) paths.push(absolute);
      else throw new Error('unsupported non-file artifact entry: ' + path.relative(absoluteRoot, absolute));
    }
  }
  await visit(absoluteRoot);
  const artifacts = [];
  for (const absolute of paths) {
    const bytes = await fs.readFile(absolute);
    artifacts.push({
      relative_path: path.relative(absoluteRoot, absolute).replaceAll(path.sep, '/'),
      size_bytes: bytes.byteLength,
      sha256: sha256(bytes),
      bundle_type: path.extname(absolute).slice(1).toUpperCase() || 'UNKNOWN'
    });
  }
  return {
    schema_version: 1,
    generated_at: buildTimestamp,
    generated_at_status: buildTimestamp ? 'SUPPLIED BY CALLER' : 'UNVERIFIED',
    source_sha: sourceSha,
    source_provenance_status: sourceSha ? 'SUPPLIED BY CALLER — NOT INDEPENDENTLY VERIFIED' : 'UNVERIFIED',
    build_version: buildVersion,
    build_version_status: buildVersion ? 'SUPPLIED BY CALLER — NOT INSPECTED' : 'UNVERIFIED',
    product_identity: productIdentity,
    product_identity_status: productIdentity ? 'SUPPLIED BY CALLER — NOT INSPECTED' : 'UNVERIFIED',
    signing_status: 'UNVERIFIED',
    sbom_status: 'UNVERIFIED',
    artifacts
  };
}

export async function verifyArtifactManifest(manifest, directory) {
  if (manifest?.schema_version !== 1 || !Array.isArray(manifest.artifacts)) {
    return { status: 'FAIL — INVALID MANIFEST SCHEMA', verified: [], failures: ['schema_version or artifacts invalid'] };
  }
  const root = await fs.realpath(directory);
  const verified = [];
  const failures = [];
  const seen = new Set();
  const listed = new Set();
  for (const record of manifest.artifacts) {
    if (typeof record.relative_path !== 'string' || path.isAbsolute(record.relative_path) || record.relative_path.split(/[\\/]/).includes('..')) {
      failures.push({ relative_path: record.relative_path ?? null, reason: 'unsafe relative path' });
      continue;
    }
    const normalized = record.relative_path.replaceAll('\\', '/');
    if (seen.has(normalized)) {
      failures.push({ relative_path: normalized, reason: 'duplicate manifest path' });
      continue;
    }
    seen.add(normalized);
    const absolute = path.resolve(root, record.relative_path);
    if (!(absolute === root || absolute.startsWith(root + path.sep))) {
      failures.push({ relative_path: normalized, reason: 'path escapes artifact root' });
      continue;
    }
    try {
      const actualPath = await fs.realpath(absolute);
      if (!(actualPath === root || actualPath.startsWith(root + path.sep))) {
        failures.push({ relative_path: normalized, reason: 'resolved artifact escapes artifact root' });
        continue;
      }
      const bytes = await fs.readFile(actualPath);
      const actual = { size_bytes: bytes.byteLength, sha256: sha256(bytes) };
      if (actual.size_bytes !== record.size_bytes || actual.sha256 !== record.sha256) {
        failures.push({ relative_path: normalized, reason: 'size or hash mismatch', expected: record, actual });
      } else { verified.push(normalized); listed.add(normalized); }
    } catch {
      failures.push({ relative_path: normalized, reason: 'artifact missing or unreadable' });
    }
  }
  async function findActual(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    const found = [];
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) found.push(...await findActual(absolute));
      else if (entry.isFile()) found.push(path.relative(root, absolute).replaceAll(path.sep, '/'));
      else failures.push({ relative_path: path.relative(root, absolute).replaceAll(path.sep, '/'), reason: 'unsupported non-file artifact entry' });
    }
    return found;
  }
  for (const actualPath of await findActual(root)) {
    if (!seen.has(actualPath)) failures.push({ relative_path: actualPath, reason: 'artifact is not present in manifest' });
  }
  return { status: failures.length ? 'FAIL — ARTIFACT MISMATCH' : 'PASS', verified, failures };
}
