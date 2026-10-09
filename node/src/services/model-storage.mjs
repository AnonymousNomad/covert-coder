import { constants as fsConstants } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export class ModelStorageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ModelStorageError';
    this.code = 'NOT_READY';
  }
}

export async function resolveModelStorageDirectory(configured = process.env.AIDE_MODEL_DIR, fsOps = fs) {
  if (typeof configured !== 'string' || configured.trim().length === 0) {
    throw new ModelStorageError('model storage is not configured; set AIDE_MODEL_DIR to an existing absolute model directory');
  }
  if (!path.isAbsolute(configured)) {
    throw new ModelStorageError('AIDE_MODEL_DIR must be an absolute path so every Covert component resolves the same model directory');
  }

  const lexical = path.resolve(configured);
  let info;
  try {
    info = await fsOps.stat(lexical);
  } catch {
    throw new ModelStorageError('configured AIDE_MODEL_DIR does not exist or cannot be read; create and configure the model directory explicitly');
  }
  if (!info.isDirectory()) {
    throw new ModelStorageError('configured AIDE_MODEL_DIR is not a directory');
  }

  let canonical;
  try {
    canonical = await fsOps.realpath(lexical);
    await fsOps.access(canonical, fsConstants.R_OK | fsConstants.W_OK);
  } catch {
    throw new ModelStorageError('configured AIDE_MODEL_DIR is not readable and writable; correct its path or permissions');
  }
  return path.resolve(canonical);
}

export function sameModelStorageDirectory(left, right) {
  const a = path.resolve(left);
  const b = path.resolve(right);
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}
