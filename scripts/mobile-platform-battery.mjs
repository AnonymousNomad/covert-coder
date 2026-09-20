import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createMobileProductionService } from '../node/src/services/mobile-production.mjs';
import { createRemoteBridgeService } from '../node/src/services/remote-bridge.mjs';
import { createCipherVoiceService } from '../node/src/services/cipher-voice.mjs';
import { createConciergeService } from '../node/src/services/concierge.mjs';
import { createExecutionAuthority } from '../node/src/services/execution-authority.mjs';

const evidence = {
  test: 'mobile-platform-battery',
  generated_at: new Date().toISOString(),
  checks: [],
  live: {}
};

function check(name, passed, detail) {
  evidence.checks.push({ name, passed, detail });
  assert.equal(passed, true, `${name}: ${detail}`);
}

const fixture = await mkdtemp(path.join(os.tmpdir(), 'covert-mobile-'));
const calls = [];
const apk = path.join(fixture, 'app', 'build', 'outputs', 'apk', 'debug', 'covert-edge-debug.apk');
const runner = async (file, args, options = {}) => {
  calls.push({ file: String(file), args: [...args] });
  if (String(file).toLowerCase().includes('where')) return { code: 1, stdout: '', stderr: '' };
  if (String(file) === 'git' && args[0] === 'rev-parse') return { code: 0, stdout: 'abc1234\n', stderr: '' };
  if (String(file).endsWith('gradlew.bat') && args[0] === 'assembleDebug') {
    await mkdir(path.dirname(apk), { recursive: true });
    await writeFile(apk, Buffer.from('synthetic-apk-fixture'));
    return { code: 0, stdout: 'BUILD SUCCESSFUL\n', stderr: '' };
  }
  return { code: 1, stdout: '', stderr: 'fixture command unavailable' };
};

try {
  await mkdir(path.join(fixture, 'app', 'src', 'main'), { recursive: true });
  await writeFile(path.join(fixture, 'settings.gradle'), 'rootProject.name = "fixture"\ninclude ":app"\n');
  await writeFile(path.join(fixture, 'app', 'build.gradle'), 'plugins { id "com.android.application" }\nandroid { namespace "com.covert.edge"\n defaultConfig { applicationId "com.covert.edge" minSdk 26 targetSdk 35 } }\n');
  await writeFile(path.join(fixture, 'app', 'src', 'main', 'AndroidManifest.xml'), '<manifest package="com.covert.edge"><application /></manifest>\n');
  await writeFile(path.join(fixture, 'gradlew.bat'), '@echo off\n');

  const mobile = createMobileProductionService({ workspace: fixture, commandRunner: runner, clock: () => 1700000000000 });
  const plugin = mobile.plugin();
  check('plugin metadata', plugin.id === 'covert.mobile-production' && plugin.status === 'EXPERIMENTAL' && plugin.adapters.length === 2, 'first-party plugin metadata is truthful and declarative');
  check('plugin has no executable entry', !Object.hasOwn(plugin, 'entry'), 'service metadata does not create an independent plugin runtime');

  const project = await mobile.inspectAndroidProject('.');
  check('native Android project detection', project.kind === 'native-android-gradle' && project.supported === true && project.application_id === 'com.covert.edge' && project.min_sdk === 26 && project.target_sdk === 35 && project.gradle_wrapper === 'gradlew.bat', JSON.stringify(project));
  check('Android SDK bounds are project independent', !String(JSON.stringify(project)).includes('password'), 'project inspection has no secret fields');

  const tauriFixture = path.join(fixture, 'tauri-edge');
  await mkdir(path.join(tauriFixture, 'src-tauri', 'gen', 'android'), { recursive: true });
  await writeFile(path.join(tauriFixture, 'src-tauri', 'tauri.conf.json'), '{"productName":"Covert Edge"}\n');
  await writeFile(path.join(tauriFixture, 'src-tauri', 'gen', 'android', 'build.gradle'), '// generated Tauri Android fixture\n');
  const tauriProject = await mobile.inspectAndroidProject('tauri-edge');
  check('Tauri v2 Android project detection', tauriProject.kind === 'tauri-v2-android' && tauriProject.supported === true, JSON.stringify(tauriProject));

  const build = await mobile.buildDebugApk({ project_path: '.' });
  check('debug APK build result', build.status === 'BUILD_PASSED' && build.artifact?.artifact_type === 'apk', JSON.stringify(build));
  check('artifact hash', build.artifact?.sha256 === crypto.createHash('sha256').update('synthetic-apk-fixture').digest('hex') && build.artifact?.verification_stages.some(stage => stage.stage === 'HASHED' && stage.passed), 'hash stage is explicit');
  check('build does not imply runtime proof', build.artifact?.verification_status === 'PARTIAL' && build.artifact?.device_install_status === 'NOT_ATTEMPTED', 'runtime stages remain unclaimed');
  await mkdir(path.join(fixture, 'CovertEdge.xcarchive', 'Products'), { recursive: true });
  await writeFile(path.join(fixture, 'CovertEdge.xcarchive', 'Products', 'Info.plist'), 'fixture archive');
  const archive = await mobile.artifactFromFile('CovertEdge.xcarchive', { signing_profile_ref: 'profile-reference-only' });
  check('Apple archive artifact contract', archive.artifact_type === 'xcarchive' && archive.sha256?.length === 64 && archive.signing_profile_ref === 'profile-reference-only', JSON.stringify(archive));
  check('signing secret exclusion', !JSON.stringify(archive).match(/password|private.?key|credential|secret/i), 'artifact metadata contains only a non-secret profile reference');
  const swiftPackageFixture = path.join(fixture, 'swift-package');
  await mkdir(swiftPackageFixture, { recursive: true });
  await writeFile(path.join(swiftPackageFixture, 'Package.swift'), '// swift-tools-version: 5.9\nimport PackageDescription\nlet package = Package(name: "CovertEdge")\n');
  const swiftPackage = await mobile.inspectAppleProject('swift-package');
  check('Swift Package project inspection', swiftPackage.kind === 'swift-package' && swiftPackage.supported === true, JSON.stringify(swiftPackage));
  const swiftUiFixture = path.join(fixture, 'swiftui-source');
  await mkdir(swiftUiFixture, { recursive: true });
  await writeFile(path.join(swiftUiFixture, 'ContentView.swift'), 'import SwiftUI\nstruct ContentView: View { var body: some View { Text("Covert Edge") } }\n');
  const swiftUi = await mobile.inspectAppleProject('swiftui-source');
  check('SwiftUI source inspection', swiftUi.kind === 'swiftui-source' && swiftUi.supported === true, JSON.stringify(swiftUi));
  if (process.platform === 'win32') {
    const shimService = createMobileProductionService({ workspace: fixture, clock: () => 1700000000000 });
    const shimBuild = await shimService.buildDebugApk({ project_path: '.' });
    check('Windows Gradle wrapper shim', shimBuild.status === 'BUILD_PASSED', JSON.stringify(shimBuild));
  }

  const install = await mobile.installApk({ artifact_path: 'app/build/outputs/apk/debug/covert-edge-debug.apk' });
  check('install fails closed without adb/device', install.status === 'UNAVAILABLE' && install.artifact?.device_install_status === 'NOT_ATTEMPTED', JSON.stringify(install));
  check('no arbitrary Android shell adapter', !calls.some(call => call.args[0] === 'shell' && !['pm', 'monkey', 'am'].includes(call.args[2] ?? '')), 'only fixed bounded adb subcommands are used');

  const apple = await mobile.appleEnvironment();
  if (process.platform === 'win32' || process.platform === 'linux') check('Apple Xcode boundary', apple.components.xcode.status === 'UNAVAILABLE' && apple.components.xcodebuild.detail.includes('MACOS/XCODE REQUIRED'), JSON.stringify(apple));
  const appleBuild = await mobile.appleBuild({ project_path: '.' });
  if (process.platform === 'win32' || process.platform === 'linux') check('Apple build unavailable truth', appleBuild.status === 'UNAVAILABLE' && appleBuild.limitation.includes('MACOS/XCODE REQUIRED'), JSON.stringify(appleBuild));

  const notifications = { list: () => ({ notifications: [] }) };
  const bridge = createRemoteBridgeService({
    workspace: fixture,
    resident: { summary: async () => ({ status: 'ready', recommendation: 'Resident observed.', git: {} }) },
    workflow: { load: async () => null },
    tasks: { status: async () => ({ jobs: [] }) },
    notifications,
    modelRuntime: { status: async () => ({ models: [] }) },
    clock: () => 1700000000000
  });
  const snapshot = await bridge.snapshot();
  check('Remote Bridge projection', snapshot.connection.state === 'local-only' && snapshot.current_project.reference.startsWith('workspace:') && !JSON.stringify(snapshot).includes(fixture), 'Edge projection contains bounded references, not raw workspace paths');
  const mutation = await bridge.command({ command: 'workflow.start' });
  check('Remote Bridge mutation confirmation', mutation.accepted === false && mutation.requires_confirmation === true, JSON.stringify(mutation));
  check('Remote Bridge has no raw authority', !Object.keys(bridge).some(key => /pty|filesystem|shell|model/i.test(key)), 'bridge surface is a projection/command contract');

  const authority = createExecutionAuthority({ workspace: fixture, record: async () => ({ persisted: true }) });
  const pairingProof = authority.control.createPairing('edge-test');
  const paired = await authority.pair(pairingProof, 'edge-test');
  check('pairing reuses existing authority primitive', typeof paired.token === 'string' && paired.token.length >= 32 && typeof paired.actor_id === 'string', 'one-use pairing exchanged for an in-memory operator actor');
  await assert.rejects(authority.pair(pairingProof, 'edge-test'));
  await assert.rejects(authority.pair(authority.control.createPairing('edge-test'), 'wrong-origin'));
  check('pairing is one-use and origin-bound', true, 'replay and origin mismatch were rejected');

  const voice = createCipherVoiceService({ bridge });
  check('Cipher hotword truth', voice.capabilities().custom_hotword_available === false, JSON.stringify(voice.capabilities()));
  check('Cipher invocation truth', voice.capabilities().supported_invocations.length === 1 && voice.capabilities().supported_invocations[0] === 'in-app-push-to-talk', JSON.stringify(voice.capabilities()));
  const voiceRead = await voice.command({ transcript: "Cipher, what's Covert doing?" });
  check('Cipher read command', voiceRead.accepted === true && voiceRead.category === 'read', JSON.stringify(voiceRead));
  const voiceMutate = await voice.command({ transcript: 'pause that workflow' });
  check('Cipher mutation confirmation', voiceMutate.accepted === false && voiceMutate.requires_confirmation === true, JSON.stringify(voiceMutate));

  const manifestPath = path.join(fixture, 'release-manifest.json');
  const hash = 'a'.repeat(64);
  await writeFile(manifestPath, JSON.stringify({ schema_version: '1', generated_at: new Date().toISOString(), source_sha: 'abc1234', artifacts: [{ product: 'COVERT WORKSTATION', version: '0.1.0', platform: 'windows', architecture: 'x64', artifact_type: 'NSIS', filename: 'Covert.exe', size_bytes: 4, sha256: hash, signing_state: 'unknown', certification_state: 'uncertified', minimum_requirements: [], reference: 'Covert.exe', limitations: [] }] }));
  const concierge = createConciergeService({ repoRoot: fixture, manifestPath });
  const noMatch = await concierge.resolve({ intent: 'workstation', platform: 'windows', architecture: 'x64' });
  check('Concierge rejects uncertified package', noMatch.matched === false && noMatch.artifacts.length === 0, JSON.stringify(noMatch));
  const parsedManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  parsedManifest.artifacts[0].certification_state = 'certified';
  await writeFile(manifestPath, JSON.stringify(parsedManifest));
  const match = await concierge.resolve({ intent: 'workstation', platform: 'windows', architecture: 'x64' });
  check('Concierge deterministic certified match', match.matched === true && match.artifacts[0].sha256 === hash, JSON.stringify(match));
  check('Concierge exposes checksum only', !JSON.stringify(match).match(/password|private.?key|token|secret/i), 'manifest response contains package evidence, not credentials');

  evidence.live = {
    host_os: process.platform,
    fixture_project: project,
    fixture_build: { status: build.status, artifact_sha256: build.artifact?.sha256 ?? null },
    fixture_install: install.status,
    apple_environment: apple,
    physical_device: 'NOT_PROVEN_BY_FIXTURE',
    edge_pairing: 'NOT_RUN_IN_HERMETIC_SERVICE_TEST'
  };
  const liveService = createMobileProductionService({ workspace: process.cwd() });
  evidence.live.android_environment = await liveService.androidEnvironment();
  evidence.live.android_devices = await liveService.listDevices();
  evidence.live.apple_environment = await liveService.appleEnvironment();
  const outputArg = process.argv.find(arg => arg.startsWith('--output='));
  if (outputArg) await writeFile(path.resolve(outputArg.slice('--output='.length)), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ passed: true, checks: evidence.checks.length, output: outputArg ? path.resolve(outputArg.slice('--output='.length)) : null }));
} finally {
  await rm(fixture, { recursive: true, force: true });
}
