import { z } from 'zod';

// Harness Operating Mode contract (foundation).
//
// There is ONE Covert Harness. A mode is a typed LOADOUT for that harness —
// which workflows, skills, SOPs, tool classes, policies, verification rules,
// checklists and stop conditions apply to a kind of work. A mode never creates
// a second execution system and never changes Execution Authority semantics.
//
// References point at EXISTING registries (workflow stage contract, skills
// registry categories, harness/sops.json, operation-policy kinds, egress and
// containment policies). Modes add constraints; they may not remove one.
export const HARNESS_MODE_SCHEMA_VERSION = '1.0';

export const HarnessModeStatus = z.enum(['AVAILABLE', 'PARTIAL', 'EXPERIMENTAL', 'PLANNED']);

export const HarnessModeRef = z
  .object({
    id: z.string().min(1),
    version: z.string().min(1)
  })
  .strict();

export const HarnessModelRoles = z
  .object({
    plan: z.string().min(1),
    act: z.string().min(1),
    utility: z.string().min(1)
  })
  .strict();

export const HarnessModeDefinition = z
  .object({
    schema_version: z.literal(HARNESS_MODE_SCHEMA_VERSION),
    mode_id: z.string().regex(/^[a-z][a-z0-9-]{2,63}$/),
    display_name: z.string().min(1),
    domain: z.string().min(1),
    version: z.string().min(1),
    status: HarnessModeStatus,
    workflow_bundles: z.array(HarnessModeRef),
    skill_bundles: z.array(HarnessModeRef),
    sop_bundles: z.array(HarnessModeRef),
    tool_classes: z.array(z.string().min(1)),
    model_roles: HarnessModelRoles,
    routing_requirements: z
      .object({
        local_default: z.boolean(),
        required_capabilities: z.array(z.string().min(1))
      })
      .strict(),
    authority_policy_refs: z.array(z.string().min(1)),
    network_policy_refs: z.array(z.string().min(1)),
    filesystem_policy_refs: z.array(z.string().min(1)),
    verification_contract_refs: z.array(z.string().min(1)),
    checklists: z.array(z.string().min(1)),
    stop_conditions: z.array(z.string().min(1)),
    prohibited_effects: z.array(z.string().min(1)),
    resource_policy: z
      .object({
        max_context_tokens: z.number().int().positive(),
        max_parallel_jobs: z.number().int().positive()
      })
      .strict(),
    context_policy: z
      .object({
        max_input_tokens: z.number().int().positive(),
        reserve_output_tokens: z.number().int().positive()
      })
      .strict(),
    required_integrations: z.array(z.string().min(1)),
    optional_integrations: z.array(z.string().min(1)),
    notes: z.array(z.string().min(1))
  })
  .strict();

export const ModeComposeRequest = z
  .object({
    primary: z.string().min(1),
    specializations: z.array(z.string().min(1)).max(8)
  })
  .strict();

export const ComposedHarnessMode = z
  .object({
    schema_version: z.literal(HARNESS_MODE_SCHEMA_VERSION),
    composed: z.literal(true),
    primary_mode_id: z.string().min(1),
    specialization_ids: z.array(z.string().min(1)),
    status: HarnessModeStatus,
    effective: z
      .object({
        workflow_bundles: z.array(HarnessModeRef),
        skill_bundles: z.array(HarnessModeRef),
        sop_bundles: z.array(HarnessModeRef),
        tool_classes: z.array(z.string().min(1)),
        model_roles: HarnessModelRoles,
        routing_requirements: z
          .object({
            local_default: z.boolean(),
            required_capabilities: z.array(z.string().min(1))
          })
          .strict(),
        authority_policy_refs: z.array(z.string().min(1)),
        network_policy_refs: z.array(z.string().min(1)),
        filesystem_policy_refs: z.array(z.string().min(1)),
        verification_contract_refs: z.array(z.string().min(1)),
        checklists: z.array(z.string().min(1)),
        stop_conditions: z.array(z.string().min(1)),
        prohibited_effects: z.array(z.string().min(1)),
        resource_policy: z
          .object({
            max_context_tokens: z.number().int().positive(),
            max_parallel_jobs: z.number().int().positive()
          })
          .strict(),
        context_policy: z
          .object({
            max_input_tokens: z.number().int().positive(),
            reserve_output_tokens: z.number().int().positive()
          })
          .strict(),
        required_integrations: z.array(z.string().min(1)),
        optional_integrations: z.array(z.string().min(1))
      })
      .strict(),
    notes: z.array(z.string().min(1))
  })
  .strict();

export const ModeListResponse = z
  .object({
    modes: z.array(HarnessModeDefinition)
  })
  .strict();

export const ComposedModeResponse = z
  .object({
    modes: z.array(ComposedHarnessMode)
  })
  .strict();

export type HarnessModeDefinitionT = z.infer<typeof HarnessModeDefinition>;
export type HarnessModeStatusT = z.infer<typeof HarnessModeStatus>;
export type ComposedHarnessModeT = z.infer<typeof ComposedHarnessMode>;
