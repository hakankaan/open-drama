import { DESCRIBABLE_FIELDS, type AssetKind, type DescribeAsset } from '@open-drama/contracts';
import type { z } from 'zod';
import { conflict } from '../../../http/errors';
import { withAssetClaim } from '../../assets/claims';
import { assertNoImageInFlight, describableFields, getAsset } from '../../assets/service';
import { getDramaJobs } from '../../jobs/run-job';
import { runAgentUntilSaved } from '../runtime/run-agent';
import { DESCRIBE_RUN_TOOLS } from '../tools';
import { loadAssetForPrompt } from './final-prompt';

const PLURAL: Record<AssetKind, 'characters' | 'scenes' | 'props'> = { character: 'characters', scene: 'scenes', prop: 'props' };

/** What the designer is told about the asset: its name, and each describable field with its text or its emptiness. */
function fieldLines(kind: AssetKind, id: number): string {
  const asset = getAsset(kind, id) as unknown as Record<string, unknown>;
  return DESCRIBABLE_FIELDS[kind].map((k) => `${k}: ${String(asset[k] ?? '').trim() ? JSON.stringify(asset[k]) : '(empty)'}`).join('\n');
}

/**
 * DescribeAsset (adr-0024): the asset designer, run in the request for one existing asset, offered the story, the
 * kind's existing assets and the kind's one describe tool, so it cannot create assets. Without `replace` it fills
 * the empty describable fields and is refused when none is; with `replace` it writes every one afresh (adr-0016);
 * the identity fields are never written. The asset is claimed for the run (its image, outfit image, prompt and a
 * second describe wait), and it is refused while an image task of the asset is processing or a design run of its
 * kind is going, which would write the same fields. Without an outline the designer still runs, from the premise.
 */
export async function describeAsset(kind: AssetKind, id: number, opts: z.output<typeof DescribeAsset>) {
  return withAssetClaim(kind, id, async () => {
    const asset = loadAssetForPrompt(kind, id);
    assertNoImageInFlight(kind, id, 'describe it');
    if (getDramaJobs(asset.dramaId).design[PLURAL[kind]]?.status === 'running') {
      throw conflict(`The ${PLURAL[kind]} are being designed; describe this one once the run has finished`);
    }
    const { empty } = describableFields(kind, id);
    if (!opts.replace && empty.length === 0) throw conflict(`The ${kind} is already described; pass replace to write over it`);
    const ask = opts.replace
      ? `write every one of its describing fields afresh (${DESCRIBABLE_FIELDS[kind].join(', ')})`
      : `fill its empty fields (${empty.join(', ')}); its filled fields are kept`;
    await runAgentUntilSaved(
      {
        agentType: 'asset_designer',
        message: `Describe the ${kind} "${asset.label}" (id ${id}) for this project, and nothing else: read the story with read_story_for_design, read the project's existing ${PLURAL[kind]} with read_existing_${PLURAL[kind]} for the look of the others, then call describe_${kind} once to ${ask}. Its fields now:\n${fieldLines(kind, id)}`,
        dramaId: asset.dramaId,
        model: opts.model,
        textServiceId: opts.textServiceId,
        tools: DESCRIBE_RUN_TOOLS[kind],
        target: { kind, id },
        replace: opts.replace,
      },
      `describe_${kind}`,
    );
    return getAsset(kind, id);
  });
}
