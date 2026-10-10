import {
  CreationStudioProduction,
  type CreationStudioProductionT
} from './contracts/creation-studio.ts';

export interface CreationStudioManifestShot {
  scene_id: string;
  shot_id: string;
  scene_order: number;
  shot_order: number;
  prompt: string;
  duration_seconds: number;
  aspect_ratio: CreationStudioProductionT['scenes'][number]['shots'][number]['aspect_ratio'];
  video_provider_id: string | null;
  video_model_id: string | null;
  render_state: CreationStudioProductionT['scenes'][number]['shots'][number]['state'];
}

export interface CreationStudioRenderManifest {
  schema: 'covert.creation-studio.render-manifest.v1';
  production_id: string;
  production_title: string;
  execution_state: 'GATED_NOT_CONNECTED';
  total_duration_seconds: number;
  shots: CreationStudioManifestShot[];
}

export function buildCreationStudioRenderManifest(input: CreationStudioProductionT): CreationStudioRenderManifest {
  const production = CreationStudioProduction.parse(input);
  const shots = production.scenes
    .flatMap(scene => scene.shots.map(shot => ({ scene, shot })))
    .sort((left, right) => left.scene.order - right.scene.order || left.shot.order - right.shot.order)
    .map(({ scene, shot }) => {
      const video = shot.assignments.find(assignment => assignment.capability === 'VIDEO') ?? null;
      return {
        scene_id: scene.scene_id,
        shot_id: shot.shot_id,
        scene_order: scene.order,
        shot_order: shot.order,
        prompt: shot.prompt,
        duration_seconds: shot.duration_seconds,
        aspect_ratio: shot.aspect_ratio,
        video_provider_id: video?.provider_id ?? null,
        video_model_id: video?.model_id ?? null,
        render_state: shot.state
      };
    });
  return {
    schema: 'covert.creation-studio.render-manifest.v1',
    production_id: production.production_id,
    production_title: production.title,
    execution_state: 'GATED_NOT_CONNECTED',
    total_duration_seconds: shots.reduce((total, shot) => total + shot.duration_seconds, 0),
    shots
  };
}
