import { atomicWriteJson } from '../../node/src/services/atomic-json.ts';

const [target, mode] = process.argv.slice(2);
if (typeof target !== 'string' || !['during-temp-write', 'before-replace', 'after-replace'].includes(mode)) process.exit(64);

await atomicWriteJson(target, { version: 1, tabs: [], panel: 'after-interruption' }, {
  validate: value => {
    if (!value || value.version !== 1 || !Array.isArray(value.tabs)) throw new Error('fixture schema invalid');
  },
  testHooks: {
    beforePhase(phase) {
      if (mode === 'before-replace' && phase === 'replace') process.exit(71);
    },
    async writeTemp(handle, bytes) {
      if (mode === 'during-temp-write') {
        await handle.writeFile(bytes.slice(0, Math.max(1, Math.floor(bytes.length / 2))), 'utf8');
        process.exit(70);
      }
      await handle.writeFile(bytes, 'utf8');
    },
    afterReplace() {
      if (mode === 'after-replace') process.exit(72);
    }
  }
});

process.exit(90);
