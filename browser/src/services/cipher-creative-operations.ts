import type {
  CreationStudioRecordT,
  CreationStudioShotT
} from '../../../common/contracts/creation-studio.ts';
import {
  buildCreationStudioRenderManifest,
  type CreationStudioRenderManifest
} from '../../../common/creation-studio-manifest.ts';

export interface CipherCreativeOperationsProduction {
  production_id: string;
  title: string;
  premise: string;
  status: CreationStudioRecordT['production']['status'];
  revision: number;
  updated_at: string;
  execution_connection: 'NOT_CONNECTED';
  render_manifest_state: CreationStudioRenderManifest['execution_state'];
  scene_count: number;
  shot_count: number;
  blocked_shot_count: number;
  unavailable_assignment_count: number;
}

export interface CipherCreativeOperationsShot {
  production_id: string;
  scene_id: string;
  scene_title: string;
  shot_id: string;
  state: CreationStudioShotT['state'];
  prompt: string;
  duration_seconds: number;
  aspect_ratio: CreationStudioShotT['aspect_ratio'];
  assignments: CreationStudioShotT['assignments'];
}

export interface CipherCreativeOperationsProjection {
  production: CipherCreativeOperationsProduction;
  bible_entries: CreationStudioRecordT['bible_entries'];
  continuity_entries: CreationStudioRecordT['continuity_entries'];
  shot_queue: CipherCreativeOperationsShot[];
}

function compareId(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function projectCipherCreativeOperations(
  record: CreationStudioRecordT
): CipherCreativeOperationsProjection {
  const production = record.production;
  const orderedShots = production.scenes
    .flatMap(scene => scene.shots.map(shot => ({ scene, shot })))
    .sort((left, right) =>
      left.scene.order - right.scene.order ||
      compareId(left.scene.scene_id, right.scene.scene_id) ||
      left.shot.order - right.shot.order ||
      compareId(left.shot.shot_id, right.shot.shot_id)
    );
  const shots = production.scenes.flatMap(scene => scene.shots);
  const unavailableAssignmentCount = shots.reduce(
    (count, shot) => count + shot.assignments.filter(assignment => assignment.state === 'UNAVAILABLE').length,
    0
  );
  const renderManifest = buildCreationStudioRenderManifest(production);

  return {
    production: {
      production_id: production.production_id,
      title: production.title,
      premise: production.premise,
      status: production.status,
      revision: record.revision,
      updated_at: record.updated_at,
      execution_connection: production.execution_connection,
      render_manifest_state: renderManifest.execution_state,
      scene_count: production.scenes.length,
      shot_count: shots.length,
      blocked_shot_count: shots.filter(shot => shot.state === 'BLOCKED').length,
      unavailable_assignment_count: unavailableAssignmentCount
    },
    bible_entries: record.bible_entries.map(entry => ({ ...entry })),
    continuity_entries: record.continuity_entries.map(entry => ({ ...entry })),
    shot_queue: orderedShots.map(({ scene, shot }) => ({
      production_id: production.production_id,
      scene_id: scene.scene_id,
      scene_title: scene.title,
      shot_id: shot.shot_id,
      state: shot.state,
      prompt: shot.prompt,
      duration_seconds: shot.duration_seconds,
      aspect_ratio: shot.aspect_ratio,
      assignments: shot.assignments.map(assignment => ({ ...assignment }))
    }))
  };
}
