import path from 'node:path';
import { ArchServer } from '../../node/src/server.ts';

const [signal, workspace] = process.argv.slice(2);
if (signal !== 'SIGINT' && signal !== 'SIGTERM') throw new Error('unsupported fixture signal');

const baselineCounts = {
  SIGINT: process.listenerCount('SIGINT'),
  SIGTERM: process.listenerCount('SIGTERM')
};
const send = message => new Promise((resolve, reject) => {
  if (typeof process.send !== 'function') return reject(new Error('IPC channel unavailable'));
  process.send(message, error => error ? reject(error) : resolve());
});
const instance = new ArchServer(workspace, path.join(workspace, 'server.log'));
instance.addShutdownHook(async () => {
  await send({
    type: 'shutdown-hook',
    signal,
    baselineCounts,
    listenerCounts: {
      SIGINT: process.listenerCount('SIGINT'),
      SIGTERM: process.listenerCount('SIGTERM')
    }
  });
});
await instance.listen(0);
await send({ type: 'ready' });

// This exercises the installed Node signal callback path. Windows kernel
// delivery for SIGTERM is not represented by this synthetic EventEmitter emit.
process.emit(signal);
