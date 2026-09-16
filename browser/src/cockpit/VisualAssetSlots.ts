// Local visual asset slots for the Covert presentation layer.
//
// This manifest names the approved production inputs without pretending that
// they exist. Consumers keep their truthful fallback until a standalone local
// asset is supplied and provenance is recorded.

export interface CovertVisualAssetSlot {
  id: string;
  relativePath: string;
  placement: 'branding' | 'operator' | 'portrait' | 'environment' | 'icon';
  status: 'awaiting-approved-asset';
  localOnly: true;
}

function slot(id: string, relativePath: string, placement: CovertVisualAssetSlot['placement']): CovertVisualAssetSlot {
  return { id, relativePath, placement, status: 'awaiting-approved-asset', localOnly: true };
}

export const COVERT_VISUAL_ASSET_SLOTS = {
  branding: {
    emblem: slot('covert-emblem', 'assets/emblem/covert-emblem.svg', 'branding'),
    wordmark: slot('covert-wordmark', 'assets/emblem/covert-wordmark.svg', 'branding')
  },
  operators: {
    engineering: {
      operator: slot('resident-engineering-operator', 'assets/operator/engineering/full-body.png', 'operator'),
      portrait: slot('resident-engineering-portrait', 'assets/resident/engineering/portrait.png', 'portrait'),
      environment: slot('resident-engineering-environment', 'assets/environment/workstation-background.png', 'environment')
    },
    security: {
      operator: slot('resident-security-operator', 'assets/operator/security/full-body.png', 'operator'),
      portrait: slot('resident-security-portrait', 'assets/resident/security/portrait.png', 'portrait'),
      environment: slot('resident-security-environment', 'assets/environment/security-background.png', 'environment')
    },
    research: {
      operator: slot('resident-research-operator', 'assets/operator/research/full-body.png', 'operator'),
      portrait: slot('resident-research-portrait', 'assets/resident/research/portrait.png', 'portrait'),
      environment: slot('resident-research-environment', 'assets/environment/research-background.png', 'environment')
    },
    creative: {
      operator: slot('resident-creative-operator', 'assets/operator/creative/full-body.png', 'operator'),
      portrait: slot('resident-creative-portrait', 'assets/resident/creative/portrait.png', 'portrait'),
      environment: slot('resident-creative-environment', 'assets/environment/creative-background.png', 'environment')
    }
  },
  atmosphere: {
    technicalOverlay: slot('technical-overlay', 'assets/environment/technical-overlay.svg', 'environment'),
    consoleMotif: slot('console-motif', 'assets/environment/console-motif.svg', 'environment'),
    iconSet: slot('icon-set', 'assets/icons/covert-icons.svg', 'icon')
  }
} as const;

export type OperatorVisualVariant = keyof typeof COVERT_VISUAL_ASSET_SLOTS.operators;
