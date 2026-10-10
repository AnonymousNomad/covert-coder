import fs from 'node:fs';
import path from 'node:path';
import {
  CreationStudioPutRequest,
  CreationStudioRecord
} from '../../../common/contracts/creation-studio.ts';

function stateError(message, cause) {
  const error = Object.assign(new Error(message), { code: 'CORRUPT_STATE' });
  if (cause !== undefined) error.cause = cause;
  return error;
}

export function createCreationStudioService(options) {
  const workspace = options.workspace;
  const now = options.now ?? (() => new Date());
  const root = path.join(workspace, '.aide', 'creation-studio');
  const recordsPath = path.join(root, 'productions.json');

  function readRecords() {
    let raw;
    try {
      raw = fs.readFileSync(recordsPath, 'utf8');
    } catch (error) {
      if (error?.code === 'ENOENT') return [];
      throw stateError('creation studio state is unreadable', error);
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw stateError('creation studio state is invalid JSON', error);
    }
    if (!Array.isArray(parsed)) throw stateError('creation studio state must be an array');

    return parsed.map((record, index) => {
      const result = CreationStudioRecord.safeParse(record);
      if (!result.success) throw stateError(`creation studio record ${index} failed contract validation`, result.error);
      return result.data;
    });
  }

  function writeRecords(records) {
    fs.mkdirSync(root, { recursive: true });
    const tmp = recordsPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(records, null, 2), 'utf8');
    fs.renameSync(tmp, recordsPath);
  }

  function list() {
    return {
      records: readRecords()
        .slice()
        .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
    };
  }

  function put(input) {
    const request = CreationStudioPutRequest.parse(input);
    const records = readRecords();
    const id = request.production.production_id;
    const index = records.findIndex(record => record.production.production_id === id);
    const current = index >= 0 ? records[index] : null;
    const currentRevision = current?.revision ?? 0;
    if (currentRevision !== request.expected_revision) {
      throw Object.assign(new Error('creation studio revision conflict'), { code: 'CONFLICT' });
    }
    const record = CreationStudioRecord.parse({
      production: request.production,
      bible_entries: request.bible_entries,
      continuity_entries: request.continuity_entries,
      revision: currentRevision + 1,
      updated_at: now().toISOString()
    });
    if (index >= 0) records[index] = record;
    else records.push(record);
    writeRecords(records);
    return record;
  }

  return { list, put };
}
