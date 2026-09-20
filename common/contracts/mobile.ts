import { z } from 'zod';
import { Notification } from './notifications.ts';

export const CapabilityStatus = z.enum(['AVAILABLE', 'MISSING', 'MISCONFIGURED', 'UNKNOWN', 'UNAVAILABLE']);
export type CapabilityStatusT = z.infer<typeof CapabilityStatus>;

export const MobilePluginStatus = z.enum(['EXPERIMENTAL', 'AVAILABLE', 'UNAVAILABLE']);
export const MobilePlatform = z.enum(['android', 'apple']);
export const MobileOperatingMode = z.enum(['inspect', 'build', 'verify', 'install', 'run']);

export const MobilePluginMetadata = z
  .object({
    publisher: z.string().min(1),
    platform_requirements: z.array(z.string().min(1)).max(16),
    operating_modes: z.array(MobileOperatingMode).max(8),
    workflows: z.array(z.string().min(1)).max(32),
    skills: z.array(z.string().min(1)).max(32),
    tool_adapters: z.array(z.string().min(1)).max(32),
    ui_contributions: z.array(z.string().min(1)).max(16),
    verification_contracts: z.array(z.string().min(1)).max(32),
    adapters: z
      .array(
        z
          .object({
            id: z.string().min(1),
            platform: MobilePlatform,
            status: MobilePluginStatus,
            limitation: z.string().min(1).nullable()
          })
          .strict()
      )
      .max(8)
  })
  .strict();

export const MobilePluginResponse = z
  .object({
    id: z.literal('covert.mobile-production'),
    name: z.string().min(1),
    publisher: z.string().min(1),
    version: z.string().min(1),
    status: MobilePluginStatus,
    capabilities: z.array(z.string().min(1)).max(16),
    platform_requirements: z.array(z.string().min(1)).max(16),
    operating_modes: z.array(MobileOperatingMode).max(8),
    workflows: z.array(z.string().min(1)).max(32),
    skills: z.array(z.string().min(1)).max(32),
    tool_adapters: z.array(z.string().min(1)).max(32),
    ui_contributions: z.array(z.string().min(1)).max(16),
    verification_contracts: z.array(z.string().min(1)).max(32),
    adapters: z.array(
      z
        .object({
          id: z.string().min(1),
          platform: MobilePlatform,
          status: MobilePluginStatus,
          limitation: z.string().min(1).nullable()
        })
        .strict()
    )
  })
  .strict();

export const MobilePluginResponseEnvelope = z.object({ plugin: MobilePluginResponse }).strict();
export type MobilePluginResponseT = z.infer<typeof MobilePluginResponse>;

export const AndroidComponent = z
  .object({
    status: CapabilityStatus,
    detail: z.string().max(300),
    path: z.string().nullable(),
    version: z.string().nullable()
  })
  .strict();
export type AndroidComponentT = z.infer<typeof AndroidComponent>;

export const AndroidEnvironment = z
  .object({
    host_os: z.enum(['windows', 'macos', 'linux', 'other']),
    checked_at: z.number().int(),
    sdk_root: z.string().nullable(),
    components: z
      .object({
        jdk: AndroidComponent,
        java_home: AndroidComponent,
        android_sdk: AndroidComponent,
        platform_tools: AndroidComponent,
        adb: AndroidComponent,
        build_tools: AndroidComponent,
        android_platforms: AndroidComponent,
        gradle: AndroidComponent,
        gradle_wrapper: AndroidComponent,
        android_studio: AndroidComponent,
        tauri_android: AndroidComponent
      })
      .strict(),
    limitations: z.array(z.string().min(1)).max(24)
  })
  .strict();

export const AndroidEnvironmentResponse = z.object({ environment: AndroidEnvironment }).strict();
export type AndroidEnvironmentT = z.infer<typeof AndroidEnvironment>;

export const AndroidProjectKind = z.enum(['native-android-gradle', 'tauri-v2-android', 'unsupported', 'not-found']);
export const AndroidProject = z
  .object({
    project_path: z.string().min(1),
    kind: AndroidProjectKind,
    supported: z.boolean(),
    application_id: z.string().nullable(),
    package_name: z.string().nullable(),
    min_sdk: z.number().int().positive().nullable(),
    target_sdk: z.number().int().positive().nullable(),
    variants: z.array(z.string().min(1)).max(64),
    gradle_wrapper: z.string().nullable(),
    manifest_path: z.string().nullable(),
    output_locations: z.array(z.string().min(1)).max(16),
    source_sha: z.string().regex(/^[0-9a-f]{7,64}$/i).nullable(),
    limitations: z.array(z.string().min(1)).max(24)
  })
  .strict();

export const AndroidProjectResponse = z.object({ project: AndroidProject }).strict();
export const AndroidProjectQuery = z.object({ project_path: z.string().min(1) }).strict();
export type AndroidProjectT = z.infer<typeof AndroidProject>;

export const AndroidDevice = z
  .object({
    serial: z.string().min(1),
    state: z.enum(['online', 'offline', 'unauthorized', 'unknown']),
    model: z.string().nullable(),
    product: z.string().nullable(),
    transport_id: z.string().nullable()
  })
  .strict();
export const AndroidDeviceListResponse = z.object({ devices: z.array(AndroidDevice).max(32), checked_at: z.number().int() }).strict();
export type AndroidDeviceT = z.infer<typeof AndroidDevice>;

export const ArtifactType = z.enum(['apk', 'aab', 'app', 'xcarchive', 'ipa']);
export const ArtifactTarget = z.enum(['android', 'apple']);
export const BuildMode = z.enum(['debug', 'release', 'test', 'unknown']);
export const SigningStatus = z.enum(['unsigned', 'signed', 'configured', 'unknown']);
export const ArtifactVerificationStatus = z.enum(['UNVERIFIED', 'PARTIAL', 'VERIFIED', 'FAILED']);
export const DeviceInstallStatus = z.enum(['NOT_ATTEMPTED', 'NOT_APPLICABLE', 'INSTALL_PASSED', 'INSTALL_FAILED', 'PACKAGE_PRESENT', 'UNKNOWN']);
export const VerificationStageName = z.enum([
  'BUILD_PASSED',
  'ARTIFACT_FOUND',
  'HASHED',
  'INSTALL_PASSED',
  'PACKAGE_PRESENT',
  'LAUNCH_REQUEST_PASSED',
  'RUNTIME_EVIDENCE_OBSERVED'
]);

export const VerificationStage = z
  .object({
    stage: VerificationStageName,
    passed: z.boolean(),
    observed_at: z.number().int(),
    detail: z.string().max(500),
    evidence_refs: z.array(z.string().min(1)).max(16)
  })
  .strict();

export const MobileArtifact = z
  .object({
    artifact_type: ArtifactType,
    package_id: z.string().nullable(),
    bundle_id: z.string().nullable(),
    version: z.string().nullable(),
    build_number: z.string().nullable(),
    source_sha: z.string().regex(/^[0-9a-f]{7,64}$/i).nullable(),
    target_platform: ArtifactTarget,
    architectures: z.array(z.string().min(1)).max(16),
    build_mode: BuildMode,
    artifact_path: z.string().nullable(),
    artifact_reference: z.string().nullable(),
    size_bytes: z.number().int().nonnegative().nullable(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/i).nullable(),
    signing_status: SigningStatus,
    signing_profile_ref: z.string().nullable(),
    verification_status: ArtifactVerificationStatus,
    device_install_status: DeviceInstallStatus,
    evidence_refs: z.array(z.string().min(1)).max(32),
    verification_stages: z.array(VerificationStage).max(16)
  })
  .strict();
export type MobileArtifactT = z.infer<typeof MobileArtifact>;

export const AndroidBuildRequest = z
  .object({
    project_path: z.string().min(1),
    variant: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/).optional()
  })
  .strict();
export const AndroidBuildResponse = z
  .object({
    status: z.enum(['BUILD_PASSED', 'BUILD_FAILED', 'UNAVAILABLE']),
    project: AndroidProject,
    artifact: MobileArtifact.nullable(),
    stages: z.array(VerificationStage).max(16),
    limitation: z.string().nullable()
  })
  .strict();

export const AndroidArtifactQuery = z.object({ artifact_path: z.string().min(1) }).strict();
export const AndroidArtifactResponse = z.object({ artifact: MobileArtifact }).strict();

export const AndroidInstallRequest = z
  .object({
    artifact_path: z.string().min(1),
    device_serial: z.string().min(1).max(256).optional()
  })
  .strict();
export const AndroidInstallResponse = z
  .object({
    status: z.enum(['INSTALL_PASSED', 'INSTALL_FAILED', 'UNAVAILABLE']),
    artifact: MobileArtifact.nullable(),
    device: AndroidDevice.nullable(),
    detail: z.string().max(500),
    stage: VerificationStage
  })
  .strict();

export const AndroidLaunchRequest = z
  .object({
    package_id: z.string().regex(/^[A-Za-z][A-Za-z0-9_.]{0,254}$/),
    device_serial: z.string().min(1).max(256).optional()
  })
  .strict();
export const AndroidLaunchResponse = z
  .object({
    status: z.enum(['LAUNCH_REQUEST_PASSED', 'LAUNCH_FAILED', 'UNAVAILABLE']),
    device: AndroidDevice.nullable(),
    package_id: z.string(),
    detail: z.string().max(500),
    stage: VerificationStage
  })
  .strict();

export const AndroidStopRequest = AndroidLaunchRequest;
export const AndroidStopResponse = z
  .object({
    status: z.enum(['STOP_PASSED', 'STOP_FAILED', 'UNAVAILABLE']),
    device: AndroidDevice.nullable(),
    package_id: z.string(),
    detail: z.string().max(500)
  })
  .strict();

export const AndroidLogcatRequest = z
  .object({
    device_serial: z.string().min(1).max(256).optional(),
    package_id: z.string().regex(/^[A-Za-z][A-Za-z0-9_.]{0,254}$/).optional(),
    lines: z.number().int().positive().max(1000).optional()
  })
  .strict();
export const AndroidLogcatResponse = z
  .object({
    status: z.enum(['RUNTIME_EVIDENCE_OBSERVED', 'NO_RUNTIME_EVIDENCE', 'UNAVAILABLE']),
    device: AndroidDevice.nullable(),
    package_id: z.string().nullable(),
    lines: z.array(z.string().max(2000)).max(1000),
    truncated: z.boolean(),
    stage: VerificationStage
  })
  .strict();

export const AppleEnvironment = z
  .object({
    host_os: z.enum(['windows', 'macos', 'linux', 'other']),
    checked_at: z.number().int(),
    components: z
      .object({
        swift: AndroidComponent,
        swift_package_manager: AndroidComponent,
        xcode: AndroidComponent,
        xcodebuild: AndroidComponent,
        simctl: AndroidComponent,
        simulator_runtimes: AndroidComponent,
        signing: AndroidComponent,
        provisioning: AndroidComponent
      })
      .strict(),
    executor_backends: z.array(z.string().min(1)).max(16),
    limitations: z.array(z.string().min(1)).max(24)
  })
  .strict();
export const AppleEnvironmentResponse = z.object({ environment: AppleEnvironment }).strict();

export const AppleProjectKind = z.enum(['swift-package', 'swiftui-source', 'xcode-project', 'xcode-workspace', 'unsupported', 'not-found']);
export const AppleProject = z
  .object({
    project_path: z.string().min(1),
    kind: AppleProjectKind,
    supported: z.boolean(),
    bundle_id: z.string().nullable(),
    deployment_target: z.string().nullable(),
    schemes: z.array(z.string().min(1)).max(64),
    configurations: z.array(z.string().min(1)).max(64),
    source_sha: z.string().regex(/^[0-9a-f]{7,64}$/i).nullable(),
    limitations: z.array(z.string().min(1)).max(24)
  })
  .strict();
export const AppleProjectQuery = z.object({ project_path: z.string().min(1) }).strict();
export const AppleProjectResponse = z.object({ project: AppleProject }).strict();

export const AppleBuildRequest = z
  .object({
    project_path: z.string().min(1),
    executor_id: z.string().min(1).max(128).optional(),
    scheme: z.string().min(1).max(128).optional(),
    configuration: z.string().min(1).max(128).optional()
  })
  .strict();
export const AppleBuildResponse = z
  .object({
    status: z.enum(['QUEUED', 'BUILT', 'UNAVAILABLE', 'FAILED']),
    executor_id: z.string().nullable(),
    artifact: MobileArtifact.nullable(),
    limitation: z.string().nullable(),
    evidence_refs: z.array(z.string().min(1)).max(16)
  })
  .strict();

export const EdgeConnection = z
  .object({
    state: z.enum(['connected', 'disconnected', 'local-only']),
    transport: z.enum(['loopback', 'same-network', 'paired-remote', 'none']),
    authenticated: z.boolean(),
    last_seen: z.number().int().nullable(),
    detail: z.string().max(300)
  })
  .strict();

export const EdgeSnapshot = z
  .object({
    generated_at: z.number().int(),
    workstation: z.object({ id: z.string().min(1), name: z.string().min(1), version: z.string().nullable() }).strict(),
    connection: EdgeConnection,
    current_project: z.object({ name: z.string().min(1), reference: z.string().min(1), source_sha: z.string().nullable() }).strict().nullable(),
    workflow: z
      .object({ id: z.string().nullable(), stage: z.string().min(1), status: z.string().min(1), updated_at: z.number().int().nullable() })
      .strict()
      .nullable(),
    jobs: z.array(z.object({ id: z.string().min(1), label: z.string().min(1), status: z.string().min(1), started_at: z.number().int(), ended_at: z.number().int().nullable() }).strict()).max(100),
    workers: z.array(z.object({ id: z.string().min(1), role: z.string().min(1), status: z.string().min(1), provider: z.string().nullable(), model: z.string().nullable() }).strict()).max(64),
    approvals: z.array(z.object({ id: z.string().min(1), kind: z.string().min(1), summary: z.string().min(1), risk: z.enum(['low', 'medium', 'high']), created_at: z.number().int() }).strict()).max(64),
    verification: z.object({ status: z.string().min(1), summary: z.string().min(1), evidence_refs: z.array(z.string().min(1)).max(32) }).strict(),
    activity: z.array(z.object({ kind: z.string().min(1), title: z.string().min(1), occurred_at: z.number().int() }).strict()).max(100),
    notifications: z.array(Notification).max(100),
    resident: z.object({ message: z.string().max(2000), generated_at: z.number().int() }).strict()
  })
  .strict();
export const EdgeStatusResponse = z.object({ snapshot: EdgeSnapshot }).strict();
export const EdgeCapabilitiesResponse = z
  .object({
    capabilities: z.array(z.object({ id: z.string().min(1), kind: z.enum(['read', 'mutate']), risk: z.enum(['low', 'medium', 'high']), available: z.boolean(), confirmation_required: z.boolean() }).strict()).max(64),
    custom_hotword_available: z.literal(false),
    push_to_talk_available: z.boolean()
  })
  .strict();

export const EdgePairingChallengeRequest = z.object({}).strict();
export const EdgePairingChallengeResponse = z.object({ challenge: z.string().min(1), expires_at: z.number().int(), single_use: z.literal(true) }).strict();
export const EdgePairRequest = z.object({ proof: z.string().min(32).max(256) }).strict();
export const EdgePairResponse = z.object({ token: z.string().min(1), actor_id: z.string().min(1), expires_at: z.number().int() }).strict();

export const EdgeCommandRequest = z
  .object({
    command: z.enum(['status.read', 'resident.read', 'verification.read', 'notifications.read', 'workers.read', 'workflow.start', 'workflow.pause', 'workflow.stop', 'approval.submit']),
    confirmation: z.literal(true).optional()
  })
  .strict();
export const EdgeCommandResponse = z
  .object({
    accepted: z.boolean(),
    requires_confirmation: z.boolean(),
    risk: z.enum(['low', 'medium', 'high']),
    reason: z.string().max(500),
    snapshot: EdgeSnapshot.nullable()
  })
  .strict();

export const VoiceCapabilitiesResponse = z
  .object({
    input_available: z.boolean(),
    push_to_talk_available: z.boolean(),
    custom_hotword_available: z.literal(false),
    assistant_role_available: z.boolean(),
    supported_invocations: z.array(z.enum(['in-app-push-to-talk', 'widget', 'quick-action', 'assistant-role', 'app-intent', 'siri'])).max(8),
    limitations: z.array(z.string().min(1)).max(16)
  })
  .strict();
export const VoiceCommandRequest = z.object({ transcript: z.string().min(1).max(2000), confirmation: z.literal(true).optional() }).strict();
export const VoiceCommandResponse = z
  .object({
    accepted: z.boolean(),
    category: z.enum(['read', 'mutate', 'high-risk', 'unknown']),
    requires_confirmation: z.boolean(),
    response_text: z.string().max(2000),
    snapshot: EdgeSnapshot.nullable()
  })
  .strict();

export const ReleaseArtifact = z
  .object({
    product: z.enum(['COVERT WORKSTATION', 'COVERT EDGE']),
    version: z.string().min(1),
    platform: z.string().min(1),
    architecture: z.string().min(1),
    artifact_type: z.string().min(1),
    filename: z.string().min(1),
    size_bytes: z.number().int().nonnegative(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/i),
    signing_state: z.enum(['unsigned', 'signed', 'unknown']),
    certification_state: z.enum(['certified', 'uncertified', 'pending']),
    minimum_requirements: z.array(z.string().min(1)).max(16),
    reference: z.string().min(1),
    limitations: z.array(z.string().min(1)).max(16)
  })
  .strict();
export const ReleaseManifest = z
  .object({ schema_version: z.literal('1'), generated_at: z.string().datetime(), source_sha: z.string().regex(/^[0-9a-f]{7,64}$/i), artifacts: z.array(ReleaseArtifact).max(256) })
  .strict();
export const ConciergeManifestResponse = z.object({ manifest: ReleaseManifest }).strict();
export const ConciergeResolveRequest = z
  .object({
    intent: z.enum(['workstation', 'edge', 'android-production', 'apple-production']),
    platform: z.enum(['windows', 'linux', 'macos', 'android', 'ios']),
    architecture: z.string().min(1).max(32)
  })
  .strict();
export const ConciergeResolveResponse = z
  .object({ matched: z.boolean(), reason: z.string().max(500), artifacts: z.array(ReleaseArtifact).max(32), limitations: z.array(z.string().min(1)).max(16) })
  .strict();

export type EdgeSnapshotT = z.infer<typeof EdgeSnapshot>;
export type EdgeCommandRequestT = z.infer<typeof EdgeCommandRequest>;
export type EdgePairResponseT = z.infer<typeof EdgePairResponse>;
export type VoiceCommandRequestT = z.infer<typeof VoiceCommandRequest>;
export type ReleaseManifestT = z.infer<typeof ReleaseManifest>;
export type ReleaseArtifactT = z.infer<typeof ReleaseArtifact>;
export type AndroidBuildResponseT = z.infer<typeof AndroidBuildResponse>;
export type AndroidDeviceListResponseT = z.infer<typeof AndroidDeviceListResponse>;
export type AndroidProjectResponseT = z.infer<typeof AndroidProjectResponse>;
export type EdgeStatusResponseT = z.infer<typeof EdgeStatusResponse>;
export type EdgeCommandResponseT = z.infer<typeof EdgeCommandResponse>;
export type VoiceCapabilitiesResponseT = z.infer<typeof VoiceCapabilitiesResponse>;
export type VoiceCommandResponseT = z.infer<typeof VoiceCommandResponse>;
