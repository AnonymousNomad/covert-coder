import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const COMMAND_TIMEOUT_MS = 120_000;
const BUILD_TIMEOUT_MS = 15 * 60_000;
const OUTPUT_LIMIT = 256 * 1024;
const LOGCAT_LIMIT = 1_000;

const MOBILE_PLUGIN = Object.freeze({
  id: 'covert.mobile-production',
  name: 'Mobile Production',
  publisher: 'Covert',
  version: '0.1.0',
  status: 'EXPERIMENTAL',
  capabilities: ['ui.view', 'command.register'],
  platform_requirements: ['One governed Harness', 'Execution Authority for mutations', 'Android SDK for Android builds', 'macOS/Xcode executor for Apple builds'],
  operating_modes: ['inspect', 'build', 'verify', 'install', 'run'],
  workflows: ['mobile.project-inspect', 'mobile.android-build-verify', 'mobile.apple-build-request'],
  skills: ['android-production', 'apple-production', 'mobile-artifact-verification'],
  tool_adapters: ['android.environment_status', 'android.inspect_project', 'android.device_list', 'android.build_debug_apk', 'android.artifact_inspect', 'android.install_apk', 'android.launch_app', 'android.stop_app', 'android.logcat_bounded', 'apple.environment_status', 'apple.inspect_project', 'apple.build_request'],
  ui_contributions: ['android-production'],
  verification_contracts: ['mobile.artifact', 'mobile.device-install', 'mobile.runtime-evidence'],
  adapters: [
    { id: 'android-production', platform: 'android', status: 'EXPERIMENTAL', limitation: 'Requires a real Android project, local Gradle/toolchain, and an available device for live installation proof.' },
    { id: 'apple-production', platform: 'apple', status: 'EXPERIMENTAL', limitation: 'MACOS_EXECUTOR_REQUIRED for Xcode-dependent operations.' }
  ]
});

export class MobileProductionError extends Error {
  constructor(code, message, detail = undefined) {
    super(message);
    this.name = code;
    this.code = code;
    this.detail = detail;
  }
}

function hostOs() {
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'macos';
  if (process.platform === 'linux') return 'linux';
  return 'other';
}

function component(status, detail, componentPath = null, version = null) {
  return { status, detail: String(detail).slice(0, 300), path: componentPath, version: version === null ? null : String(version).slice(0, 160) };
}

function normalizeOutput(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').slice(0, OUTPUT_LIMIT);
}

function commandName(command) {
  if (process.platform === 'win32' && command === 'gradle') return 'gradle.bat';
  if (process.platform === 'win32' && command === 'adb') return 'adb.exe';
  return command;
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

async function pathExists(candidate) {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(candidate) {
  try {
    return (await fs.stat(candidate)).isDirectory();
  } catch {
    return false;
  }
}

async function isFile(candidate) {
  try {
    return (await fs.stat(candidate)).isFile();
  } catch {
    return false;
  }
}

async function readText(candidate) {
  try {
    return await fs.readFile(candidate, 'utf8');
  } catch {
    return '';
  }
}

function parseVersion(output) {
  const match = normalizeOutput(output).match(/(?:version\s+|v)([0-9]+(?:\.[0-9]+){0,3})/i) ?? normalizeOutput(output).match(/([0-9]+(?:\.[0-9]+){1,3})/);
  return match?.[1] ?? null;
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function parseSdkNumber(text, key) {
  const value = firstMatch(text, [
    new RegExp(`${key}\\s*(?:=|\\()\\s*["']?([0-9]+)`, 'i'),
    new RegExp(`${key}\\s+(?:=\\s*)?["']?([0-9]+)`, 'i'),
    new RegExp(`${key}Version\\s*(?:=|\\()\\s*["']?([0-9]+)`, 'i')
  ]);
  return value ? Number(value) : null;
}

function relativeReference(root, candidate) {
  return path.relative(root, candidate).split(path.sep).join('/') || '.';
}

async function walkFiles(root, predicate, max = 5000) {
  const found = [];
  const visit = async current => {
    if (found.length >= max) return;
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (found.length >= max || entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.aide') continue;
      const candidate = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(candidate);
      } else if (entry.isFile() && predicate(candidate, entry.name)) {
        found.push(candidate);
      }
    }
  };
  await visit(root);
  return found;
}

function defaultRunner(file, args, options) {
  const windowsShim = process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(String(file));
  const target = windowsShim ? (process.env.ComSpec ?? 'cmd.exe') : file;
  const targetArgs = windowsShim
    ? ['/d', '/s', '/c', `"${[file, ...args].map(value => `"${String(value).replace(/["^&|<>]/g, '^$&')}"`).join(' ')}"`]
    : args;
  return execFile(target, targetArgs, {
    cwd: options?.cwd,
    env: { ...process.env, ...(options?.env ?? {}) },
    timeout: options?.timeoutMs ?? COMMAND_TIMEOUT_MS,
    maxBuffer: options?.maxBuffer ?? OUTPUT_LIMIT,
    windowsHide: true,
    ...(windowsShim ? { windowsVerbatimArguments: true } : {})
  }).then(result => ({ code: 0, stdout: normalizeOutput(result.stdout), stderr: normalizeOutput(result.stderr) })).catch(error => ({
    code: Number.isInteger(error?.code) ? error.code : 1,
    stdout: normalizeOutput(error?.stdout),
    stderr: normalizeOutput(error?.stderr || error?.message),
    timedOut: error?.killed === true || error?.signal === 'SIGTERM'
  }));
}

function commandPathFromWhereOutput(output) {
  const first = normalizeOutput(output).split(/\r?\n/).map(line => line.trim()).find(Boolean);
  return first ? first.replace(/^"|"$/g, '') : null;
}

export function createMobileProductionService({ workspace, commandRunner = defaultRunner, clock = () => Date.now() } = {}) {
  const root = path.resolve(workspace ?? process.cwd());

  function safePath(input, label = 'path') {
    if (typeof input !== 'string' || input.trim().length === 0) throw new MobileProductionError('BAD_REQUEST', `${label} is required`);
    const candidate = path.resolve(root, input);
    if (!isInside(root, candidate)) throw new MobileProductionError('FORBIDDEN', `${label} must remain inside the workspace`);
    return candidate;
  }

  async function findExecutable(command, candidates = []) {
    for (const candidate of candidates) {
      if (candidate && await isFile(candidate)) return candidate;
    }
    const lookup = process.platform === 'win32' ? 'where.exe' : 'which';
    const result = await commandRunner(lookup, [commandName(command)], { timeoutMs: 5000, maxBuffer: 16 * 1024 });
    if (result.code === 0) return commandPathFromWhereOutput(result.stdout);
    return null;
  }

  async function commandVersion(executable) {
    if (!executable) return null;
    const result = await commandRunner(executable, ['--version'], { timeoutMs: 10_000, maxBuffer: 32 * 1024 });
    return result.code === 0 ? parseVersion(`${result.stdout}\n${result.stderr}`) : null;
  }

  async function sdkRoot() {
    const configured = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT].filter(value => typeof value === 'string' && value.length > 0);
    if (configured.length > 1 && path.resolve(configured[0]) !== path.resolve(configured[1])) return { root: path.resolve(configured[0]), conflict: true };
    if (configured.length > 0) return { root: path.resolve(configured[0]), conflict: false };
    const candidates = process.platform === 'win32'
      ? [process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : null]
      : process.platform === 'darwin'
        ? [path.join(os.homedir(), 'Library', 'Android', 'sdk')]
        : [path.join(os.homedir(), 'Android', 'Sdk'), path.join(os.homedir(), '.android', 'sdk')];
    let existing = null;
    for (const candidate of candidates) {
      if (candidate && await isDirectory(candidate)) {
        existing = candidate;
        break;
      }
    }
    return { root: existing ? path.resolve(existing) : null, conflict: false };
  }

  async function androidEnvironment() {
    const sdk = await sdkRoot();
    const sdkPath = sdk.root;
    const javaHomeValue = process.env.JAVA_HOME ?? null;
    const javaHomeValid = javaHomeValue !== null && await isDirectory(path.resolve(javaHomeValue));
    const javaCandidates = [
      javaHomeValid ? path.join(path.resolve(javaHomeValue), 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : null,
      process.platform === 'win32' ? 'C:\\Program Files\\Java\\jdk-21\\bin\\java.exe' : null,
      process.platform === 'win32' ? 'C:\\Program Files\\Eclipse Adoptium\\jdk-21\\bin\\java.exe' : null
    ];
    const java = await findExecutable('java', javaCandidates);
    const javaVersion = await commandVersion(java);
    const jdkStatus = java ? 'AVAILABLE' : javaHomeValue ? 'MISCONFIGURED' : 'MISSING';
    const javaHomeStatus = javaHomeValue === null ? 'MISSING' : javaHomeValid ? 'AVAILABLE' : 'MISCONFIGURED';
    const sdkStatus = sdkPath && await isDirectory(sdkPath) ? (sdk.conflict ? 'MISCONFIGURED' : 'AVAILABLE') : sdk.conflict ? 'MISCONFIGURED' : 'MISSING';
    const platformToolsPath = sdkPath ? path.join(sdkPath, 'platform-tools') : null;
    const adbCandidates = [platformToolsPath ? path.join(platformToolsPath, process.platform === 'win32' ? 'adb.exe' : 'adb') : null];
    const adb = await findExecutable('adb', adbCandidates);
    const buildToolsPath = sdkPath ? path.join(sdkPath, 'build-tools') : null;
    const platformPath = sdkPath ? path.join(sdkPath, 'platforms') : null;
    const buildToolVersions = buildToolsPath && await isDirectory(buildToolsPath) ? (await fs.readdir(buildToolsPath, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort() : [];
    const platformVersions = platformPath && await isDirectory(platformPath) ? (await fs.readdir(platformPath, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort() : [];
    const gradleCandidates = [
      process.platform === 'win32' ? 'C:\\Gradle\\gradle-8.14\\bin\\gradle.bat' : null,
      process.platform !== 'win32' ? '/opt/gradle/bin/gradle' : null
    ];
    const gradle = await findExecutable('gradle', gradleCandidates);
    const studioCandidates = process.platform === 'win32'
      ? [
        process.env.PROGRAMFILES ? path.join(process.env.PROGRAMFILES, 'Android', 'Android Studio', 'bin', 'studio64.exe') : null,
        process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Android Studio', 'bin', 'studio64.exe') : null
      ]
      : process.platform === 'darwin' ? ['/Applications/Android Studio.app/Contents/MacOS/studio'] : ['/opt/android-studio/bin/studio.sh'];
    let studio = null;
    for (const candidate of studioCandidates) {
      if (candidate && await isFile(candidate)) {
        studio = candidate;
        break;
      }
    }
    const tauriCli = await findExecutable('tauri', [path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tauri.cmd' : 'tauri')]);
    const tauriConfig = (await isFile(path.join(root, 'src-tauri', 'tauri.conf.json')) || await isFile(path.join(root, 'src-tauri', 'tauri.conf.json5')));
    const limitations = [];
    if (!java) limitations.push('JDK is not available; Gradle Android builds cannot be proven locally.');
    if (!sdkPath) limitations.push('Android SDK root was not found.');
    if (!adb) limitations.push('adb is not available; device install and runtime proof are unavailable.');
    if (buildToolVersions.length === 0) limitations.push('No Android build-tools package was found.');
    if (platformVersions.length === 0) limitations.push('No Android platform package was found.');
    if (!gradle) limitations.push('Global Gradle is not available; project Gradle wrappers are checked during project inspection.');
    return {
      host_os: hostOs(),
      checked_at: clock(),
      sdk_root: sdkPath,
      components: {
        jdk: component(jdkStatus, java ? 'Java executable detected.' : 'Java executable not detected.', java, javaVersion),
        java_home: component(javaHomeStatus, javaHomeValue === null ? 'JAVA_HOME is not set.' : javaHomeValid ? 'JAVA_HOME points to a directory.' : 'JAVA_HOME does not point to a valid directory.', javaHomeValue, null),
        android_sdk: component(sdkStatus, sdkPath ? (sdk.conflict ? 'ANDROID_HOME and ANDROID_SDK_ROOT disagree.' : 'Android SDK root detected.') : 'Android SDK root not detected.', sdkPath, null),
        platform_tools: component(platformToolsPath && await isDirectory(platformToolsPath) ? 'AVAILABLE' : platformToolsPath ? 'MISSING' : 'UNKNOWN', platformToolsPath ? 'platform-tools directory probe.' : 'SDK root unavailable; platform-tools status is unknown.', platformToolsPath, null),
        adb: component(adb ? 'AVAILABLE' : sdkPath ? 'MISSING' : 'UNKNOWN', adb ? 'adb executable detected.' : 'adb executable not detected.', adb, await commandVersion(adb)),
        build_tools: component(buildToolVersions.length > 0 ? 'AVAILABLE' : sdkPath ? 'MISSING' : 'UNKNOWN', buildToolVersions.length > 0 ? `Detected ${buildToolVersions.length} build-tools version(s).` : 'No build-tools version detected.', buildToolsPath, buildToolVersions.at(-1) ?? null),
        android_platforms: component(platformVersions.length > 0 ? 'AVAILABLE' : sdkPath ? 'MISSING' : 'UNKNOWN', platformVersions.length > 0 ? `Detected ${platformVersions.length} Android platform(s).` : 'No Android platform detected.', platformPath, platformVersions.at(-1) ?? null),
        gradle: component(gradle ? 'AVAILABLE' : 'MISSING', gradle ? 'Global Gradle detected.' : 'Global Gradle not detected.', gradle, await commandVersion(gradle)),
        gradle_wrapper: component('UNKNOWN', 'Gradle wrapper status is project-specific; inspect a project to resolve it.', null, null),
        android_studio: component(studio ? 'AVAILABLE' : 'MISSING', studio ? 'Android Studio executable detected.' : 'Android Studio executable not detected.', studio, null),
        tauri_android: component(tauriCli && tauriConfig ? 'AVAILABLE' : tauriCli || tauriConfig ? 'MISCONFIGURED' : 'UNKNOWN', tauriCli && tauriConfig ? 'Tauri CLI and v2 project configuration detected.' : 'Tauri Android capability is project-specific and was not fully detected.', tauriCli, await commandVersion(tauriCli))
      },
      limitations
    };
  }

  async function sourceSha(cwd = root) {
    const result = await commandRunner('git', ['rev-parse', 'HEAD'], { cwd, timeoutMs: 5000, maxBuffer: 4096 });
    const value = result.code === 0 ? normalizeOutput(result.stdout).trim() : '';
    return /^[0-9a-f]{7,64}$/i.test(value) ? value : null;
  }

  async function inspectAndroidProject(input) {
    const projectRoot = safePath(input, 'project_path');
    if (!await isDirectory(projectRoot)) {
      return {
        project_path: relativeReference(root, projectRoot), kind: 'not-found', supported: false, application_id: null, package_name: null,
        min_sdk: null, target_sdk: null, variants: [], gradle_wrapper: null, manifest_path: null, output_locations: [], source_sha: null,
        limitations: ['Android project directory was not found inside the workspace.']
      };
    }
    const tauriConfig = await isFile(path.join(projectRoot, 'src-tauri', 'tauri.conf.json')) || await isFile(path.join(projectRoot, 'src-tauri', 'tauri.conf.json5'));
    const gradleFiles = [
      path.join(projectRoot, 'settings.gradle'), path.join(projectRoot, 'settings.gradle.kts'),
      path.join(projectRoot, 'build.gradle'), path.join(projectRoot, 'build.gradle.kts'),
      path.join(projectRoot, 'app', 'build.gradle'), path.join(projectRoot, 'app', 'build.gradle.kts'),
      path.join(projectRoot, 'src-tauri', 'gen', 'android', 'build.gradle'), path.join(projectRoot, 'src-tauri', 'gen', 'android', 'app', 'build.gradle')
    ];
    const existingGradle = [];
    let buildText = '';
    for (const file of gradleFiles) {
      if (await isFile(file)) {
        existingGradle.push(file);
        buildText += `\n${await readText(file)}`;
      }
    }
    const manifestCandidates = [
      path.join(projectRoot, 'app', 'src', 'main', 'AndroidManifest.xml'),
      path.join(projectRoot, 'src-tauri', 'gen', 'android', 'app', 'src', 'main', 'AndroidManifest.xml')
    ];
    const manifestPath = manifestCandidates.find(candidate => isFile(candidate)) ?? null;
    const manifestText = manifestPath ? await readText(manifestPath) : '';
    const hasAndroidShape = existingGradle.length > 0 || manifestPath !== null || await isDirectory(path.join(projectRoot, 'src-tauri', 'gen', 'android'));
    const kind = tauriConfig ? 'tauri-v2-android' : hasAndroidShape ? 'native-android-gradle' : 'unsupported';
    const applicationId = firstMatch(buildText, [/applicationId\s*(?:=)?\s*["']([^"']+)["']/i, /namespace\s*(?:=)?\s*["']([^"']+)["']/i]) ?? firstMatch(manifestText, [/package\s*=\s*["']([^"']+)["']/i]);
    const packageName = firstMatch(manifestText, [/package\s*=\s*["']([^"']+)["']/i]) ?? applicationId;
    const minSdk = parseSdkNumber(buildText, 'minSdk') ?? parseSdkNumber(manifestText, 'minSdkVersion');
    const targetSdk = parseSdkNumber(buildText, 'targetSdk') ?? parseSdkNumber(manifestText, 'targetSdkVersion');
    const declaredVariants = Array.from(buildText.matchAll(/(?:create|register)\s*\(\s*["']([A-Za-z][A-Za-z0-9_-]*)["']/g)).map(match => match[1]).filter(Boolean);
    const variants = Array.from(new Set(['debug', 'release', ...declaredVariants]));
    const wrapper = process.platform === 'win32' ? path.join(projectRoot, 'gradlew.bat') : path.join(projectRoot, 'gradlew');
    const outputRoots = [
      path.join(projectRoot, 'app', 'build', 'outputs', 'apk'),
      path.join(projectRoot, 'build', 'outputs', 'apk'),
      path.join(projectRoot, 'src-tauri', 'gen', 'android', 'app', 'build', 'outputs', 'apk')
    ].filter(candidate => isInside(root, candidate));
    const limitations = [];
    if (kind === 'unsupported') limitations.push('Only native Android Gradle and Tauri v2 Android project shapes are supported by this adapter.');
    if (!applicationId) limitations.push('Application ID/package name was not safely derived from Gradle or the manifest.');
    if (existingGradle.length > 0 && !await isFile(wrapper)) limitations.push('No project Gradle wrapper was found.');
    return {
      project_path: relativeReference(root, projectRoot), kind, supported: kind === 'native-android-gradle' || kind === 'tauri-v2-android',
      application_id: applicationId, package_name: packageName, min_sdk: minSdk, target_sdk: targetSdk, variants,
      gradle_wrapper: await isFile(wrapper) ? relativeReference(root, wrapper) : null,
      manifest_path: manifestPath ? relativeReference(root, manifestPath) : null,
      output_locations: outputRoots.map(candidate => relativeReference(root, candidate)),
      source_sha: await sourceSha(projectRoot), limitations
    };
  }

  async function artifactFromFile(input, metadata = {}) {
    const artifactPath = safePath(input, 'artifact_path');
    const extension = path.extname(artifactPath).toLowerCase().slice(1);
    const artifactIsDirectory = extension === 'xcarchive' && await isDirectory(artifactPath);
    if (!await isFile(artifactPath) && !artifactIsDirectory) throw new MobileProductionError('NOT_FOUND', 'mobile artifact was not found inside the workspace');
    const stat = await fs.stat(artifactPath);
    const artifactType = ['apk', 'aab', 'app', 'xcarchive', 'ipa'].includes(extension) ? extension : null;
    if (!artifactType) throw new MobileProductionError('BAD_REQUEST', 'unsupported mobile artifact type');
    const target = artifactType === 'apk' || artifactType === 'aab' ? 'android' : 'apple';
    const digestBuilder = crypto.createHash('sha256');
    let sizeBytes = stat.size;
    if (artifactIsDirectory) {
      sizeBytes = 0;
      const files = (await walkFiles(artifactPath, () => true, 10_000)).sort();
      for (const file of files) {
        digestBuilder.update(relativeReference(artifactPath, file));
        const contents = await fs.readFile(file);
        digestBuilder.update(contents);
        sizeBytes += contents.byteLength;
      }
    } else {
      digestBuilder.update(await fs.readFile(artifactPath));
    }
    const digest = digestBuilder.digest('hex');
    let packageId = metadata.package_id ?? null;
    let version = metadata.version ?? null;
    let buildNumber = metadata.build_number ?? null;
    const architectures = [];
    if (artifactType === 'apk') {
      const environment = await androidEnvironment();
      const buildToolsRoot = environment.sdk_root ? path.join(environment.sdk_root, 'build-tools') : null;
      const versions = buildToolsRoot && await isDirectory(buildToolsRoot) ? (await fs.readdir(buildToolsRoot, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort() : [];
      const aaptName = process.platform === 'win32' ? 'aapt.exe' : 'aapt';
      const aapt = versions.length > 0 ? path.join(buildToolsRoot, versions.at(-1), aaptName) : null;
      if (aapt && await isFile(aapt)) {
        const badging = await commandRunner(aapt, ['dump', 'badging', artifactPath], { timeoutMs: 20_000, maxBuffer: 64 * 1024 });
        if (badging.code === 0) {
          packageId = packageId ?? firstMatch(badging.stdout, [/package: name='([^']+)'/]);
          version = version ?? firstMatch(badging.stdout, [/versionName='([^']*)'/]);
          buildNumber = buildNumber ?? firstMatch(badging.stdout, [/versionCode='([^']*)'/]);
          const nativeCode = badging.stdout.match(/native-code:\s*((?:'[^']+'\s*)+)/i)?.[1] ?? '';
          architectures.push(...Array.from(nativeCode.matchAll(/'([^']+)'/g)).map(match => match[1]));
        }
      }
    }
    const signingStatus = artifactType === 'apk' ? 'unknown' : 'unknown';
    const stages = metadata.stages ?? [{ stage: 'ARTIFACT_FOUND', passed: true, observed_at: clock(), detail: 'Artifact found inside the workspace.', evidence_refs: [] }, { stage: 'HASHED', passed: true, observed_at: clock(), detail: 'SHA-256 calculated locally.', evidence_refs: [] }];
    return {
      artifact_type: artifactType, package_id: packageId, bundle_id: metadata.bundle_id ?? null, version, build_number: buildNumber,
      source_sha: metadata.source_sha ?? null, target_platform: target, architectures, build_mode: metadata.build_mode ?? 'unknown',
      artifact_path: relativeReference(root, artifactPath), artifact_reference: metadata.artifact_reference ?? relativeReference(root, artifactPath),
      size_bytes: sizeBytes, sha256: digest, signing_status: signingStatus, signing_profile_ref: metadata.signing_profile_ref ?? null,
      verification_status: metadata.verification_status ?? 'PARTIAL', device_install_status: metadata.device_install_status ?? 'NOT_ATTEMPTED',
      evidence_refs: metadata.evidence_refs ?? [], verification_stages: stages
    };
  }

  async function findApk(projectRoot) {
    return (await walkFiles(projectRoot, (_candidate, name) => name.toLowerCase().endsWith('.apk'), 128)).sort((a, b) => b.localeCompare(a))[0] ?? null;
  }

  async function buildDebugApk(input) {
    const project = await inspectAndroidProject(input.project_path);
    const now = clock();
    if (!project.supported) return { status: 'UNAVAILABLE', project, artifact: null, stages: [], limitation: project.limitations.join(' ') };
    if (!project.gradle_wrapper) return { status: 'UNAVAILABLE', project, artifact: null, stages: [], limitation: 'A project Gradle wrapper is required for a governed Android build.' };
    const projectRoot = safePath(input.project_path, 'project_path');
    const wrapper = safePath(project.gradle_wrapper, 'gradle_wrapper');
    const variant = input.variant ?? 'debug';
    const taskName = `assemble${variant[0].toUpperCase()}${variant.slice(1)}`;
    const result = await commandRunner(wrapper, [taskName], { cwd: projectRoot, timeoutMs: BUILD_TIMEOUT_MS, maxBuffer: OUTPUT_LIMIT });
    const stages = [{ stage: 'BUILD_PASSED', passed: result.code === 0, observed_at: now, detail: result.code === 0 ? `Gradle ${taskName} completed successfully.` : `Gradle ${taskName} exited with code ${String(result.code)}.`, evidence_refs: [] }];
    if (result.code !== 0) return { status: 'BUILD_FAILED', project, artifact: null, stages, limitation: result.timedOut ? 'Gradle build timed out.' : 'Gradle build failed; inspect local build output on the workstation.' };
    const apk = await findApk(projectRoot);
    if (!apk) {
      stages.push({ stage: 'ARTIFACT_FOUND', passed: false, observed_at: clock(), detail: 'Gradle passed but no APK was found under the project output tree.', evidence_refs: [] });
      return { status: 'BUILD_FAILED', project, artifact: null, stages, limitation: 'Gradle exit 0 is not application verification; APK output was not found.' };
    }
    const artifact = await artifactFromFile(apk, {
      package_id: project.application_id,
      source_sha: project.source_sha,
      build_mode: variant.toLowerCase().includes('release') ? 'release' : 'debug',
      stages: [
        ...stages,
        { stage: 'ARTIFACT_FOUND', passed: true, observed_at: clock(), detail: 'APK located under the project output tree.', evidence_refs: [] },
        { stage: 'HASHED', passed: true, observed_at: clock(), detail: 'APK SHA-256 calculated locally.', evidence_refs: [] }
      ],
      verification_status: 'PARTIAL'
    });
    return { status: 'BUILD_PASSED', project, artifact, stages: artifact.verification_stages, limitation: 'Install, launch, and runtime evidence are separate gates.' };
  }

  async function adbPath() {
    const environment = await androidEnvironment();
    return environment.components.adb.path;
  }

  async function listDevices() {
    const adb = await adbPath();
    if (!adb) return { devices: [], checked_at: clock() };
    const result = await commandRunner(adb, ['devices', '-l'], { timeoutMs: 20_000, maxBuffer: 64 * 1024 });
    if (result.code !== 0) return { devices: [], checked_at: clock() };
    const devices = [];
    for (const line of result.stdout.split(/\r?\n/).slice(1)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const [serial, state, ...details] = trimmed.split(/\s+/);
      if (!serial || !state) continue;
      const values = Object.fromEntries(details.map(detail => {
        const index = detail.indexOf(':');
        return index === -1 ? [detail, ''] : [detail.slice(0, index), detail.slice(index + 1)];
      }));
      devices.push({ serial, state: ['online', 'offline', 'unauthorized'].includes(state) ? state : 'unknown', model: values.model ? values.model.replace(/_/g, ' ') : null, product: values.product ?? null, transport_id: values.transport_id ?? null });
    }
    return { devices, checked_at: clock() };
  }

  async function chooseDevice(serial) {
    const list = await listDevices();
    const device = serial ? list.devices.find(item => item.serial === serial) : list.devices.find(item => item.state === 'online');
    if (!device) throw new MobileProductionError('NOT_READY', serial ? 'requested Android device is not connected' : 'no online Android device is connected');
    if (device.state !== 'online') throw new MobileProductionError('NOT_READY', `Android device is ${device.state}`);
    return { adb: await adbPath(), device };
  }

  async function installApk(input) {
    const artifact = await artifactFromFile(input.artifact_path);
    if (artifact.artifact_type !== 'apk') return { status: 'INSTALL_FAILED', artifact: { ...artifact, device_install_status: 'INSTALL_FAILED', verification_status: 'FAILED' }, device: null, detail: 'Only APK artifacts can be installed by the Android adapter.', stage: { stage: 'INSTALL_PASSED', passed: false, observed_at: clock(), detail: 'Artifact is not an APK.', evidence_refs: [] } };
    let selected;
    try { selected = await chooseDevice(input.device_serial); } catch (error) {
      if (error instanceof MobileProductionError) return { status: 'UNAVAILABLE', artifact, device: null, detail: error.message, stage: { stage: 'INSTALL_PASSED', passed: false, observed_at: clock(), detail: error.message, evidence_refs: [] } };
      throw error;
    }
    if (!artifact.package_id) return { status: 'INSTALL_FAILED', artifact: { ...artifact, device_install_status: 'INSTALL_FAILED', verification_status: 'FAILED' }, device: selected.device, detail: 'Package ID was not observed; installation is fail-closed.', stage: { stage: 'INSTALL_PASSED', passed: false, observed_at: clock(), detail: 'Package ID is required before installation.', evidence_refs: [] } };
    const absolute = safePath(input.artifact_path, 'artifact_path');
    const result = await commandRunner(selected.adb, ['-s', selected.device.serial, 'install', '-r', absolute], { timeoutMs: BUILD_TIMEOUT_MS, maxBuffer: OUTPUT_LIMIT });
    if (result.code !== 0) return { status: 'INSTALL_FAILED', artifact: { ...artifact, device_install_status: 'INSTALL_FAILED', verification_status: 'FAILED' }, device: selected.device, detail: 'adb install failed.', stage: { stage: 'INSTALL_PASSED', passed: false, observed_at: clock(), detail: 'adb install exited non-zero.', evidence_refs: [] } };
    const present = await commandRunner(selected.adb, ['-s', selected.device.serial, 'shell', 'pm', 'path', artifact.package_id], { timeoutMs: 20_000, maxBuffer: 32 * 1024 });
    const packagePresent = present.code === 0 && /package:/i.test(present.stdout);
    const stages = [
      ...(artifact.verification_stages ?? []),
      { stage: 'INSTALL_PASSED', passed: true, observed_at: clock(), detail: 'adb install completed successfully.', evidence_refs: [] },
      { stage: 'PACKAGE_PRESENT', passed: packagePresent, observed_at: clock(), detail: packagePresent ? 'Package manager reports the package.' : 'Package manager did not report the package.', evidence_refs: [] }
    ];
    return { status: packagePresent ? 'INSTALL_PASSED' : 'INSTALL_FAILED', artifact: { ...artifact, device_install_status: packagePresent ? 'PACKAGE_PRESENT' : 'INSTALL_FAILED', verification_status: packagePresent ? 'PARTIAL' : 'FAILED', verification_stages: stages }, device: selected.device, detail: packagePresent ? 'APK installed and package presence observed.' : 'APK install returned but package presence was not observed.', stage: stages.at(-1) };
  }

  async function launchApp(input) {
    let selected;
    try { selected = await chooseDevice(input.device_serial); } catch (error) {
      if (error instanceof MobileProductionError) return { status: 'UNAVAILABLE', device: null, package_id: input.package_id, detail: error.message, stage: { stage: 'LAUNCH_REQUEST_PASSED', passed: false, observed_at: clock(), detail: error.message, evidence_refs: [] } };
      throw error;
    }
    const result = await commandRunner(selected.adb, ['-s', selected.device.serial, 'shell', 'monkey', '-p', input.package_id, '1'], { timeoutMs: 30_000, maxBuffer: 64 * 1024 });
    const passed = result.code === 0;
    return { status: passed ? 'LAUNCH_REQUEST_PASSED' : 'LAUNCH_FAILED', device: selected.device, package_id: input.package_id, detail: passed ? 'Android launch request accepted by monkey.' : 'Android launch request failed.', stage: { stage: 'LAUNCH_REQUEST_PASSED', passed, observed_at: clock(), detail: passed ? 'monkey launch request exited successfully.' : 'monkey launch request exited non-zero.', evidence_refs: [] } };
  }

  async function stopApp(input) {
    let selected;
    try { selected = await chooseDevice(input.device_serial); } catch (error) {
      if (error instanceof MobileProductionError) return { status: 'UNAVAILABLE', device: null, package_id: input.package_id, detail: error.message };
      throw error;
    }
    const result = await commandRunner(selected.adb, ['-s', selected.device.serial, 'shell', 'am', 'force-stop', input.package_id], { timeoutMs: 20_000, maxBuffer: 16 * 1024 });
    return { status: result.code === 0 ? 'STOP_PASSED' : 'STOP_FAILED', device: selected.device, package_id: input.package_id, detail: result.code === 0 ? 'Android force-stop completed.' : 'Android force-stop failed.' };
  }

  async function logcat(input) {
    let selected;
    try { selected = await chooseDevice(input.device_serial); } catch (error) {
      if (error instanceof MobileProductionError) return { status: 'UNAVAILABLE', device: null, package_id: input.package_id ?? null, lines: [], truncated: false, stage: { stage: 'RUNTIME_EVIDENCE_OBSERVED', passed: false, observed_at: clock(), detail: error.message, evidence_refs: [] } };
      throw error;
    }
    const requestedLines = Math.min(input.lines ?? 200, LOGCAT_LIMIT);
    const result = await commandRunner(selected.adb, ['-s', selected.device.serial, 'logcat', '-d', '-t', String(requestedLines)], { timeoutMs: 30_000, maxBuffer: 512 * 1024 });
    let lines = normalizeOutput(result.stdout).split(/\r?\n/).filter(Boolean);
    if (input.package_id) lines = lines.filter(line => line.includes(input.package_id));
    const truncated = lines.length > requestedLines;
    lines = lines.slice(-requestedLines);
    const observed = result.code === 0 && lines.length > 0;
    return { status: observed ? 'RUNTIME_EVIDENCE_OBSERVED' : 'NO_RUNTIME_EVIDENCE', device: selected.device, package_id: input.package_id ?? null, lines, truncated, stage: { stage: 'RUNTIME_EVIDENCE_OBSERVED', passed: observed, observed_at: clock(), detail: observed ? 'Bounded Logcat output was observed.' : 'No matching bounded Logcat evidence was observed.', evidence_refs: [] } };
  }

  async function appleEnvironment() {
    const currentOs = hostOs();
    const nonMac = currentOs !== 'macos';
    const swift = await findExecutable('swift');
    const swiftpm = await findExecutable('swift', []);
    const xcodebuild = nonMac ? null : await findExecutable('xcodebuild');
    const simctl = nonMac ? null : await findExecutable('simctl');
    const xcode = nonMac ? null : await findExecutable('xcode-select');
    const swiftVersion = await commandVersion(swift);
    const xcodeVersion = await commandVersion(xcodebuild);
    const unavailable = 'UNAVAILABLE — MACOS/XCODE REQUIRED';
    return {
      host_os: currentOs,
      checked_at: clock(),
      components: {
        swift: component(swift ? 'AVAILABLE' : 'MISSING', swift ? 'Swift executable detected.' : 'Swift executable not detected.', swift, swiftVersion),
        swift_package_manager: component(swiftpm ? 'AVAILABLE' : 'MISSING', swiftpm ? 'Swift Package Manager is available through swift.' : 'Swift Package Manager is not available.', swiftpm, swiftVersion),
        xcode: component(nonMac ? 'UNAVAILABLE' : xcode ? 'AVAILABLE' : 'MISSING', nonMac ? unavailable : xcode ? 'Xcode selector detected.' : 'Xcode selector not detected.', xcode, xcodeVersion),
        xcodebuild: component(nonMac ? 'UNAVAILABLE' : xcodebuild ? 'AVAILABLE' : 'MISSING', nonMac ? unavailable : xcodebuild ? 'xcodebuild detected.' : 'xcodebuild not detected.', xcodebuild, xcodeVersion),
        simctl: component(nonMac ? 'UNAVAILABLE' : simctl ? 'AVAILABLE' : 'MISSING', nonMac ? unavailable : simctl ? 'simctl detected.' : 'simctl not detected.', simctl, null),
        simulator_runtimes: component(nonMac ? 'UNAVAILABLE' : 'UNKNOWN', nonMac ? unavailable : 'Simulator runtime inventory requires macOS.', null, null),
        signing: component(nonMac ? 'UNAVAILABLE' : 'UNKNOWN', nonMac ? unavailable : 'Signing capability requires configured certificates and profiles.', null, null),
        provisioning: component(nonMac ? 'UNAVAILABLE' : 'UNKNOWN', nonMac ? unavailable : 'Provisioning capability requires configured profiles.', null, null)
      },
      executor_backends: [],
      limitations: nonMac ? [unavailable, 'A configured paired macOS, GitHub Actions macOS runner, or future Xcode Cloud adapter is required for Apple builds.'] : ['No macOS executor backend is configured for this workspace.']
    };
  }

  async function inspectAppleProject(input) {
    const projectPath = safePath(input, 'project_path');
    if (!await pathExists(projectPath)) return { project_path: relativeReference(root, projectPath), kind: 'not-found', supported: false, bundle_id: null, deployment_target: null, schemes: [], configurations: [], source_sha: null, limitations: ['Apple project path was not found inside the workspace.'] };
    const stat = await fs.stat(projectPath);
    const directory = stat.isDirectory() ? projectPath : path.dirname(projectPath);
    const packageFile = path.join(directory, 'Package.swift');
    const xcodeProjects = (await fs.readdir(directory, { withFileTypes: true }).catch(() => [])).filter(entry => entry.name.endsWith('.xcodeproj')).map(entry => path.join(directory, entry.name));
    const xcodeWorkspaces = (await fs.readdir(directory, { withFileTypes: true }).catch(() => [])).filter(entry => entry.name.endsWith('.xcworkspace')).map(entry => path.join(directory, entry.name));
    const swiftFiles = stat.isFile() && projectPath.endsWith('.swift') ? [projectPath] : await walkFiles(directory, (_candidate, name) => name.endsWith('.swift'), 128);
    const sourceText = (await Promise.all([packageFile, ...xcodeProjects.map(project => path.join(project, 'project.pbxproj')), ...swiftFiles.slice(0, 20)].map(readText))).join('\n');
    const hasSwiftUi = /import\s+SwiftUI/.test(sourceText);
    const kind = await isFile(packageFile) ? 'swift-package' : xcodeWorkspaces.length > 0 ? 'xcode-workspace' : xcodeProjects.length > 0 ? 'xcode-project' : hasSwiftUi ? 'swiftui-source' : swiftFiles.length > 0 ? 'swiftui-source' : 'unsupported';
    const bundleId = firstMatch(sourceText, [/PRODUCT_BUNDLE_IDENTIFIER\s*=\s*([^;\s]+)/, /CFBundleIdentifier[^<]*<string>([^<]+)</i]);
    const deploymentTarget = firstMatch(sourceText, [/IPHONEOS_DEPLOYMENT_TARGET\s*=\s*([^;\s]+)/, /platforms:\s*\[[^\]]*iOS\("([^"]+)"\)/i]);
    return {
      project_path: relativeReference(root, projectPath), kind, supported: ['swift-package', 'swiftui-source', 'xcode-project', 'xcode-workspace'].includes(kind), bundle_id: bundleId,
      deployment_target: deploymentTarget, schemes: [], configurations: ['Debug', 'Release'].filter(name => kind !== 'swift-package' || name === 'Debug'), source_sha: await sourceSha(directory),
      limitations: kind.startsWith('xcode') ? ['Xcode project metadata is inspected conservatively; the full Xcode project model is not reproduced.'] : []
    };
  }

  async function appleBuild(input) {
    const project = await inspectAppleProject(input.project_path);
    const environment = await appleEnvironment();
    if (environment.host_os !== 'macos') return { status: 'UNAVAILABLE', executor_id: input.executor_id ?? null, artifact: null, limitation: 'UNAVAILABLE — MACOS/XCODE REQUIRED', evidence_refs: [] };
    if (!input.executor_id) return { status: 'UNAVAILABLE', executor_id: null, artifact: null, limitation: 'No configured macOS executor backend. The contract is ready for a paired workstation or governed runner.', evidence_refs: [] };
    if (!project.supported) return { status: 'FAILED', executor_id: input.executor_id, artifact: null, limitation: 'Apple project shape is unsupported.', evidence_refs: [] };
    return { status: 'QUEUED', executor_id: input.executor_id, artifact: null, limitation: 'Executor delegation is a contract-only foundation in this slice; no build proof is fabricated.', evidence_refs: [] };
  }

  return Object.freeze({
    plugin: () => ({ ...MOBILE_PLUGIN, adapters: MOBILE_PLUGIN.adapters.map(adapter => ({ ...adapter })) }),
    androidEnvironment,
    inspectAndroidProject,
    buildDebugApk,
    artifactFromFile,
    listDevices,
    installApk,
    launchApp,
    stopApp,
    logcat,
    appleEnvironment,
    inspectAppleProject,
    appleBuild
  });
}
