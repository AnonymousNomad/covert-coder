# Covert Edge foundation

Covert Edge is a bounded command-center client for Covert Workstation. It is
not a mobile IDE and it does not contain a model runtime, terminal, filesystem
browser, or independent workflow state.

`remote-bridge-client.ts` is the platform-neutral client seam for Android and
iOS adapters. It keeps the paired actor token in memory only and exposes only
the shared Edge status, bounded command, and Cipher Voice contracts. Android
push-to-talk, widgets/quick actions, secure storage, notifications, and iOS
App Intents/Siri invocation remain platform adapters around this seam.

Current truth:

- pairing uses the existing Workstation Execution Authority pairing primitive;
- same-network/loopback development transport is the only transport proven in
  this slice;
- custom hotword and always-listening voice are not implemented;
- Apple compilation remains macOS/Xcode/executor-bound;
- no Android APK/AAB is claimed until a real Android project, toolchain, and
  device produce evidence.
