import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyExternalDocumentChange } from '../../browser/src/editor/document-reconcile.ts';

test('external document reconciliation ignores a write that left disk at its saved snapshot', () => {
  assert.equal(classifyExternalDocumentChange({ savedContent: 'base', editorContent: 'draft', diskContent: 'base', dirty: true }), 'unchanged');
});

test('external document reconciliation preserves a dirty buffer when disk has a different version', () => {
  assert.equal(classifyExternalDocumentChange({ savedContent: 'base', editorContent: 'operator draft', diskContent: 'agent edit', dirty: true }), 'conflict');
});

test('external document reconciliation marks a dirty buffer clean when it exactly matches disk', () => {
  assert.equal(classifyExternalDocumentChange({ savedContent: 'base', editorContent: 'agent edit', diskContent: 'agent edit', dirty: true }), 'reload');
});

test('external document reconciliation reloads a clean buffer when disk changed', () => {
  assert.equal(classifyExternalDocumentChange({ savedContent: 'base', editorContent: 'base', diskContent: 'agent edit', dirty: false }), 'reload');
});
