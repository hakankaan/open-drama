import { z } from 'zod';
import { CharacterView, coverViewOf, type CharacterViews, type GeneratedView } from './assets';
import { cleanModelId, type VideoProviderCaps } from './video-providers';

/** `@[Name]` in a video prompt (Plan 1 §6): brackets allow multi-word names. The API resolves it to a reference slot. */
export const MENTION = /@\[([^\]\n]+)\]/g;

/** What one reference slot of a video showed of a character: a view, or a sheet composed from its views. */
export const SentView = z.enum([...CharacterView.options, 'composed']);
export type SentView = z.infer<typeof SentView>;

/** How a video model takes character references (adr-0018). */
export interface ReferencePolicy {
  /**
   * The model reads a multi-view sheet as one person: a character's sheet draws no warning, and a sheet composed from
   * its views stands in for separate views that do not fit.
   */
  sheets: boolean;
  /** The model uses separate side and back views: they are sent when a character has them, and suggested when not. */
  turnaround: boolean;
}

/** `family` names the model and `version` follows it as `2.5`, `2-5` or `v2.5`, so Ark, BytePlus, Bailian and ModelRunner ids all match. */
const isModel = (id: string, family: RegExp, major: number, minor: number) =>
  family.test(id) && new RegExp(`(?:^|[^0-9.])v?${major}[._-]${minor}(?![0-9])`, 'i').test(id);

/**
 * Per-model policies, first match wins. The Seedance 2.5 guides rank separate images above a multi-view sheet, which
 * they still accept for up to five subjects; Wan 2.7 documents multi-view references, one character per image.
 */
const POLICIES: { test: (id: string) => boolean; policy: ReferencePolicy }[] = [
  { test: (id) => isModel(id, /seedance/i, 2, 5), policy: { sheets: true, turnaround: true } },
  { test: (id) => isModel(id, /wan/i, 2, 7), policy: { sheets: true, turnaround: false } },
];

/**
 * The Seedance 2.0 guide warns that multi-view sheets cause identity drift and duplicated people; models whose
 * documentation says nothing (Veo 3.1, Wan 3.0, Happy Horse, MiniMax) are treated alike until a comparison run.
 */
const DEFAULT_POLICY: ReferencePolicy = { sheets: false, turnaround: false };

export function referencePolicyFor(model: string | null | undefined): ReferencePolicy {
  const id = model ? cleanModelId(model) : '';
  return POLICIES.find((p) => p.test(id))?.policy ?? DEFAULT_POLICY;
}

/** Bound characters past four, and bound assets past five, per call (adr-0017): stability drops past four people. */
export const MAX_CHARACTER_SLOTS = 4;
export const MAX_ASSET_SLOTS = 5;

export type ReferenceKind = 'character' | 'scene' | 'prop';

export interface PlannedSlot {
  name: string;
  kind: ReferenceKind;
  /** Which image of a character; null for scenes and props. */
  view: SentView | null;
  /** Null for a composed sheet, which is made from `compose` when the request is sent. */
  path: string | null;
  compose?: string[];
}

export interface ReferencePlan {
  slots: PlannedSlot[];
  /** Bound assets with an image that were left out. */
  dropped: string[];
}

const nameKey = (name: string) => name.trim().toLowerCase();

const TURNAROUND: GeneratedView[] = ['side', 'back'];

/**
 * The bound assets one video call shows, and which images of each character (adr-0017, adr-0018). Assets are chosen
 * as before: those the prompt mentions first, at most four characters and five assets, within the model's image limit,
 * an image already chosen under another name taking no slot. Each chosen asset sends one image (a character its
 * headshot, else another view or its sheet). Slots left after the images the creator added to the shot then go, in
 * the same order, to each character's full body; where none is left and the model reads sheets, the character's
 * headshot and body are composed into one sheet instead. A model that uses turnaround views gets side views, then
 * back views, last. Slots keep the binding order (characters, then the scene, then props), each character's images together.
 */
export function planReferences(input: {
  characters: { name: string; views: CharacterViews }[];
  scene: { name: string; path: string | null } | null;
  props: { name: string; path: string | null }[];
  /** Names the prompt mentions, in any case. */
  mentioned: Iterable<string>;
  imageLimit: number;
  /** Images the creator added to the shot or request, which come before a character's further views. */
  reserved?: string[];
  policy: ReferencePolicy;
}): ReferencePlan {
  interface Asset {
    order: number;
    name: string;
    kind: ReferenceKind;
    images: { view: SentView | null; path: string | null; compose?: string[] }[];
    views?: CharacterViews;
  }
  const mentioned = new Set([...input.mentioned].map(nameKey));
  const assets: Asset[] = [];
  for (const c of input.characters) {
    const view = coverViewOf(c.views);
    if (view) assets.push({ order: assets.length, name: c.name, kind: 'character', images: [{ view, path: c.views[view] }], views: c.views });
  }
  for (const [kind, list] of [['scene', input.scene ? [input.scene] : []], ['prop', input.props]] as const) {
    for (const a of list) if (a.path) assets.push({ order: assets.length, name: a.name, kind, images: [{ view: null, path: a.path }] });
  }

  const isMentioned = (a: Asset) => mentioned.has(nameKey(a.name));
  const budget = Math.min(MAX_ASSET_SLOTS, input.imageLimit);
  const used = new Set<string>();
  const chosen: Asset[] = [];
  const dropped: string[] = [];
  for (const a of [...assets.filter(isMentioned), ...assets.filter((x) => !isMentioned(x))]) {
    const path = a.images[0]!.path!;
    if (used.has(path)) continue;
    const characters = chosen.filter((c) => c.kind === 'character').length;
    if (chosen.length < budget && (a.kind !== 'character' || characters < MAX_CHARACTER_SLOTS)) {
      chosen.push(a);
      used.add(path);
    } else dropped.push(a.name);
  }

  // An added image that is already a chosen asset's takes no second slot; one a further view would repeat is sent as added.
  const added = new Set((input.reserved ?? []).filter((p) => !used.has(p)));
  for (const p of added) used.add(p);
  let free = Math.max(0, input.imageLimit - chosen.length - added.size);
  const add = (a: Asset, view: GeneratedView) => {
    const path = a.views![view];
    if (!path || used.has(path) || free === 0) return false;
    a.images.push({ view, path });
    used.add(path);
    free--;
    return true;
  };
  const castOf = chosen.filter((a) => a.kind === 'character' && a.images[0]!.view === 'headshot');
  for (const a of castOf) {
    if (!a.views!.body) continue;
    if (free > 0) {
      add(a, 'body');
      continue;
    }
    // Headshot and body only: references are sent at most 768 px wide, and every further view shrinks the face.
    if (input.policy.sheets) a.images = [{ view: 'composed', path: null, compose: [a.views!.headshot!, a.views!.body] }];
  }
  if (input.policy.turnaround) {
    // Every character's side before anyone's back: a side view says more about a face.
    for (const v of TURNAROUND) for (const a of castOf) if (a.images[0]!.view === 'headshot') add(a, v);
  }

  const slots = chosen
    .sort((x, y) => x.order - y.order)
    .flatMap((a) => a.images.map((img) => ({ name: a.name, kind: a.kind, view: img.view, path: img.path, ...(img.compose ? { compose: img.compose } : {}) })));
  return { slots, dropped };
}

/** The images a call carries beside its reference videos and audio files, under the model's per-kind and total caps. */
export const imageLimitOf = (caps: VideoProviderCaps, videos: number, audios: number) =>
  Math.max(0, Math.min(caps.images, (caps.total ?? Infinity) - videos - audios));

/** An asset bound to a shot, as the shot lists it: a character carries its views. */
interface BoundRef {
  name: string;
  imagePath: string | null;
  views?: CharacterViews;
}

/**
 * `planReferences` for a shot's bindings and prompt, so the video request and the studio's warnings agree on what a
 * model will be sent (adr-0018).
 */
export function planShotReferences(input: {
  bindings: { scene: BoundRef | null; characters: BoundRef[]; props: BoundRef[] };
  prompt: string;
  imageLimit: number;
  reserved: string[];
  model: string | null | undefined;
}): ReferencePlan {
  const { bindings } = input;
  return planReferences({
    characters: bindings.characters.flatMap((c) => (c.views ? [{ name: c.name, views: c.views }] : [])),
    scene: bindings.scene ? { name: bindings.scene.name, path: bindings.scene.imagePath } : null,
    props: bindings.props.map((p) => ({ name: p.name, path: p.imagePath })),
    mentioned: [...input.prompt.matchAll(MENTION)].map((m) => m[1]!),
    imageLimit: input.imageLimit,
    reserved: input.reserved,
    policy: referencePolicyFor(input.model),
  });
}
