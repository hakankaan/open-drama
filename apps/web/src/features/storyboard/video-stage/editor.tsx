'use client';

import { ArrowRight, FileAudio, FileVideo, ImagePlus, Sparkles, TriangleAlert, Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import {
  AUDIO_UPLOAD_EXTENSIONS,
  continuityBreak,
  coverOf,
  IMAGE_UPLOAD_EXTENSIONS,
  imageLimitOf,
  outfitViews,
  planShotReferences,
  VIDEO_UPLOAD_EXTENSIONS,
  type EpisodeAssets,
  type ReferenceMedia,
  type ReferencePlan,
  type ShotCard,
  type UpdateShot,
  type VideoProviderCaps,
} from '@open-drama/contracts';
import { MentionTextarea } from '@/components/mention-textarea';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tag } from '@/components/ui/tag';
import { cn } from '@/lib/cn';
import { useToastError } from '@/lib/errors';
import { mediaUrl, thumbOf } from '@/lib/media';
import { useDraft } from '@/lib/use-draft';
import { useUploadMedia, type UploadKind } from '../../media/api';

type Save = (patch: UpdateShot) => Promise<unknown>;

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h3 className="text-[13px] font-semibold text-ink-2">{title}</h3>
        <div className="ml-auto">{action}</div>
      </div>
      {children}
    </section>
  );
}

function DraftArea({
  value,
  save,
  rows,
  label,
  maxLength,
  placeholder,
}: {
  value: string;
  save: (v: string) => Promise<unknown>;
  rows: number;
  label: string;
  maxLength?: number;
  placeholder?: string;
}) {
  const toastError = useToastError();
  const draft = useDraft(value, save);
  return (
    <Textarea
      aria-label={label}
      rows={rows}
      value={draft.value}
      onChange={(e) => draft.onChange(e.target.value)}
      onBlur={() => void draft.commit().catch((err) => toastError(err))}
      maxLength={maxLength}
      placeholder={placeholder}
      className="text-[13px]"
    />
  );
}

/** One bindable asset as a toggle chip; bound ones show whether their reference image exists. */
function Chip({ name, bound, ready, onToggle, disabled }: { name: string; bound: boolean; ready: boolean; onToggle: () => void; disabled?: boolean }) {
  const t = useTranslations('studio.video.refs');
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={bound}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors disabled:opacity-50',
        bound ? 'border-accent bg-accent-soft text-accent-soft-ink' : 'border-dashed border-line-strong text-muted hover:text-ink',
      )}
      title={bound ? (ready ? t('usable') : t('notGenerated')) : t('unbound')}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', bound ? (ready ? 'bg-success' : 'bg-warning') : 'bg-line-strong')} aria-hidden />
      {name}
    </button>
  );
}

const ACCEPT: Record<UploadKind, readonly string[]> = {
  image: IMAGE_UPLOAD_EXTENSIONS,
  video: VIDEO_UPLOAD_EXTENSIONS,
  audio: AUDIO_UPLOAD_EXTENSIONS,
};
const MEDIA_KEY: Record<UploadKind, keyof ReferenceMedia> = { image: 'imageUrls', video: 'videoUrls', audio: 'audioUrls' };

/** Uploaded per-shot references: sent after the bound assets' images. */
function ExtraReferences({ shot, save }: { shot: ShotCard; save: Save }) {
  const t = useTranslations('studio.video.extra');
  const toastError = useToastError();
  const input = useRef<HTMLInputElement>(null);
  const kindRef = useRef<UploadKind>('image');
  const uploads = { image: useUploadMedia('image'), video: useUploadMedia('video'), audio: useUploadMedia('audio') };
  const busy = Object.values(uploads).some((u) => u.isPending);
  const media = shot.referenceMedia;
  const items = (Object.keys(MEDIA_KEY) as UploadKind[]).flatMap((kind) => (media[MEDIA_KEY[kind]] ?? []).map((path) => ({ kind, path })));

  const pick = (kind: UploadKind) => {
    kindRef.current = kind;
    if (input.current) {
      input.current.accept = ACCEPT[kind].join(',');
      input.current.click();
    }
  };
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const kind = kindRef.current;
    try {
      const uploaded = await uploads[kind].mutateAsync(file);
      const key = MEDIA_KEY[kind];
      await save({ referenceMedia: { ...media, [key]: [...(media[key] ?? []), uploaded.path] } });
    } catch (err) {
      toastError(err);
    } finally {
      if (input.current) input.current.value = '';
    }
  };
  const remove = (kind: UploadKind, path: string) => {
    const key = MEDIA_KEY[kind];
    void save({ referenceMedia: { ...media, [key]: (media[key] ?? []).filter((p) => p !== path) } }).catch((err) => toastError(err));
  };

  return (
    <Section
      title={t('title')}
      action={
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => pick('image')} disabled={busy} aria-label={t('addImage')}>
            <ImagePlus className="h-3.5 w-3.5" aria-hidden />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => pick('video')} disabled={busy} aria-label={t('addVideo')}>
            <FileVideo className="h-3.5 w-3.5" aria-hidden />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => pick('audio')} disabled={busy} aria-label={t('addAudio')}>
            <FileAudio className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      }
    >
      {items.length === 0 ? (
        <p className="text-xs text-muted">{busy ? t('uploading') : t('empty')}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {items.map(({ kind, path }) => (
            <li key={path} className="relative flex h-14 w-20 items-center justify-center overflow-hidden rounded border border-line bg-surface-2">
              {kind === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element -- media is served by the API through the proxy
                <img src={thumbOf(path)} alt="" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.src = mediaUrl(path))} />
              ) : kind === 'video' ? (
                <FileVideo className="h-5 w-5 text-muted" aria-label={t('video')} />
              ) : (
                <FileAudio className="h-5 w-5 text-muted" aria-label={t('audio')} />
              )}
              <button
                type="button"
                onClick={() => remove(kind, path)}
                className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white"
                aria-label={t('remove')}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {busy ? (
        <p className="flex items-center gap-1 text-xs text-muted">
          <Upload className="h-3 w-3" aria-hidden />
          {t('uploading')}
        </p>
      ) : null}
      <input ref={input} type="file" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
    </Section>
  );
}

/**
 * The shot's bindings with each asset's images as its row has them now: the shot carries a copy as old as its last
 * fetch, asset changes do not refetch shots, and the API plans from the current images. A character in an episode
 * outfit shows its face and the outfit's picture, as the API sends them (adr-0023).
 */
function liveBindings(b: ShotCard['bindings'], assets: EpisodeAssets | undefined): ShotCard['bindings'] {
  if (!assets) return b;
  const scenes = new Map(assets.scenes.map((s) => [s.id, s]));
  const characters = new Map(assets.characters.map((c) => [c.id, c]));
  const props = new Map(assets.props.map((p) => [p.id, p]));
  const scene = b.scene && scenes.get(b.scene.id);
  return {
    scene: b.scene && scene ? { ...b.scene, imagePath: scene.imagePath } : b.scene,
    characters: b.characters.map((c) => {
      const row = characters.get(c.id);
      if (!row) return c;
      const outfit = row.outfit.trim();
      const views = outfit ? outfitViews(row.views, row.outfitPath) : row.views;
      const { outfit: _was, ...ref } = c;
      return { ...ref, imagePath: coverOf(views), views, ...(outfit ? { outfit } : {}) };
    }),
    props: b.props.map((p) => {
      const row = props.get(p.id);
      return row ? { ...p, imagePath: row.imagePath } : p;
    }),
  };
}

/** Each sent asset once, a character with the views it gets: `Mei (headshot + full body), Night market`. */
function planLabel(plan: ReferencePlan, view: (v: string) => string): string {
  const out: { name: string; views: string[] }[] = [];
  for (const s of plan.slots) {
    const last = out.at(-1);
    if (last?.name === s.name) last.views.push(view(s.view!));
    else out.push({ name: s.name, views: s.view ? [view(s.view)] : [] });
  }
  return out.map((a) => (a.views.length ? `${a.name} (${a.views.join(' + ')})` : a.name)).join(', ');
}

/** Where a shot stands in its take (adr-0020): the shot before it, and whether two shots in a row already continue. */
export interface Continuity {
  /** The number of the shot before; null for the first shot, which cannot continue anything. */
  previous: number | null;
  /** The scene of the shot before: a take does not move to another scene. */
  previousSceneId: number | null;
  /** The shot before and the one before that both continue: this one would be the third in a row. */
  capped: boolean;
}

/** Column 2: what the shot is (description, atmosphere), whether it continues the shot before, what it references, and its video prompt. */
export function ShotEditor({
  shot,
  assets,
  save,
  onGeneratePrompt,
  promptPending,
  onToAssets,
  target,
  continuity,
}: {
  shot: ShotCard;
  assets: EpisodeAssets | undefined;
  save: Save;
  onGeneratePrompt: () => void;
  promptPending: boolean;
  onToAssets: () => void;
  /** The video model a generation would use, to show what it will be sent (adr-0018). */
  target: { model: string | null; caps: VideoProviderCaps };
  continuity: Continuity;
}) {
  const t = useTranslations('studio.video');
  const tv = useTranslations('assets.views');
  const toastError = useToastError();
  const promptDraft = useDraft(shot.videoPrompt, (videoPrompt) => save({ videoPrompt }));
  const b = liveBindings(shot.bindings, assets);
  const boundChars = new Set(b.characters.map((c) => c.id));
  const boundProps = new Set(b.props.map((p) => p.id));
  const missingImages = [b.scene, ...b.characters, ...b.props].filter((a) => a && !a.imagePath).length;
  const mentionOptions = [
    ...b.characters.map((c) => ({ name: c.name, group: t('refs.character') })),
    ...(b.scene ? [{ name: b.scene.name, group: t('refs.scene') }] : []),
    ...b.props.map((p) => ({ name: p.name, group: t('refs.prop') })),
  ];
  const toggle = (list: number[], id: number) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const bind = (patch: UpdateShot) => void save(patch).catch((err) => toastError(err));
  const sceneLabel = (s: { location: string; time: string }) => (s.time ? `${s.location} (${s.time})` : s.location);
  // What the target model would get from this shot as it stands, planned as the API plans it.
  const media = shot.referenceMedia;
  const imageLimit = imageLimitOf(target.caps, new Set(media.videoUrls ?? []).size, new Set(media.audioUrls ?? []).size);
  const otherMedia = Boolean(media.videoUrls?.length || media.audioUrls?.length);
  const modelName = target.model ?? t('keyframes.defaultModel');
  // A shot that continues the one before starts from its last frame; one with a keyframe starts from that. Either
  // way, on a model that takes a first frame, no reference image is sent.
  const continues = shot.continuesPrevious && continuity.previous !== null;
  const broken = continues ? continuityBreak(shot, { sceneId: continuity.previousSceneId }, target.model) : null;
  // Why a shot marked as continuing cannot be generated as it stands (the API refuses it for the same reasons).
  const blocked = !continues
    ? null
    : broken === 'model'
      ? t('continuity.noTakes', { model: modelName })
      : broken === 'scene'
        ? t('continuity.otherScene', { number: continuity.previous! })
        : continuity.capped
          ? t('continuity.capped')
          : !target.caps.firstFrame
            ? t('continuity.noFirstFrame', { model: modelName })
            : otherMedia
              ? t('continuity.noMedia')
              : null;
  const chained = continues && !blocked;
  const fromKeyframe = !continues && Boolean(shot.keyframePath) && target.caps.firstFrame && !otherMedia;
  const plan =
    target.model && !fromKeyframe && !chained
      ? planShotReferences({ bindings: b, prompt: promptDraft.value, imageLimit, reserved: media.imageUrls ?? [], model: target.model })
      : null;
  const planLine = chained
    ? t('refs.chained', { model: modelName, number: continuity.previous! })
    : fromKeyframe
      ? t('refs.fromKeyframe', { model: modelName })
      : plan?.slots.length
        ? t('refs.plan', { model: target.model ?? '', list: planLabel(plan, tv) })
        : null;

  return (
    <div className="flex flex-col gap-5 p-4">
      <Section title={t('fields.description')}>
        <DraftArea label={t('fields.description')} value={shot.description} save={(description) => save({ description })} rows={6} />
      </Section>
      <Section title={t('fields.atmosphere')}>
        <DraftArea label={t('fields.atmosphere')} value={shot.atmosphere} save={(atmosphere) => save({ atmosphere })} rows={2} />
      </Section>

      {continuity.previous !== null ? (
        <Section title={t('continuity.title')}>
          <div className="flex items-center gap-2 text-[13px] text-ink-2">
            <Switch
              checked={shot.continuesPrevious}
              onCheckedChange={(continuesPrevious) => bind({ continuesPrevious })}
              label={t('continuity.toggle', { number: continuity.previous })}
              disabled={!shot.continuesPrevious && continuity.capped}
            />
            <span>{t('continuity.toggle', { number: continuity.previous })}</span>
          </div>
          <p className="text-xs text-muted">
            {!shot.continuesPrevious && continuity.capped ? t('continuity.capped') : t('continuity.hint', { number: continuity.previous })}
          </p>
          {shot.continuesPrevious && shot.continuationStale ? (
            <p className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning" role="status">
              <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
              {t('continuity.stale', { number: continuity.previous })}
            </p>
          ) : null}
          {blocked ? (
            <p className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning" role="status">
              <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
              {blocked}
            </p>
          ) : null}
        </Section>
      ) : null}

      <Section
        title={t('refs.title')}
        action={
          missingImages > 0 ? (
            <Button size="sm" variant="ghost" onClick={onToAssets}>
              {t('refs.goGenerate', { count: missingImages })}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Button>
          ) : null
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted">{t('refs.characters')}</span>
            <div className="flex flex-wrap gap-1.5">
              {(assets?.characters ?? []).map((c) => (
                <Chip
                  key={c.id}
                  name={c.name}
                  bound={boundChars.has(c.id)}
                  ready={!!c.imagePath}
                  onToggle={() => bind({ characterIds: toggle(b.characters.map((x) => x.id), c.id) })}
                />
              ))}
              {assets?.characters.length === 0 ? <span className="text-xs text-muted">{t('refs.none')}</span> : null}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted">{t('refs.scene')}</span>
            <Select
              value={b.scene ? String(b.scene.id) : 'none'}
              onValueChange={(v) => bind({ sceneId: v === 'none' ? null : Number(v) })}
              options={[
                { value: 'none', label: t('refs.noScene') },
                ...(assets?.scenes ?? []).map((s) => ({
                  value: String(s.id),
                  label: sceneLabel(s),
                  hint: s.imagePath ? t('refs.usable') : t('refs.notGenerated'),
                })),
              ]}
              className="h-8 text-[13px]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted">{t('refs.props')}</span>
            <div className="flex flex-wrap gap-1.5">
              {(assets?.props ?? []).map((p) => (
                <Chip
                  key={p.id}
                  name={p.name}
                  bound={boundProps.has(p.id)}
                  ready={!!p.imagePath}
                  onToggle={() => bind({ propIds: toggle(b.props.map((x) => x.id), p.id) })}
                />
              ))}
              {assets?.props.length === 0 ? <span className="text-xs text-muted">{t('refs.none')}</span> : null}
            </div>
          </div>
          {planLine ? (
            <p className="truncate text-xs text-muted" title={planLine}>
              {planLine}
            </p>
          ) : null}
          {plan?.dropped.length ? (
            <p className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning" role="status">
              <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
              {t('refs.notSent', { names: plan.dropped.join(', '), count: imageLimit })}
            </p>
          ) : null}
        </div>
      </Section>

      <Section title={t('voice.dialogue')}>
        <label htmlFor={`speaker-${shot.id}`} className="sr-only">
          {t('voice.speaker')}
        </label>
        <Select
          id={`speaker-${shot.id}`}
          value={shot.speakerId !== null ? String(shot.speakerId) : 'none'}
          onValueChange={(v) => bind({ speakerId: v === 'none' ? null : Number(v) })}
          options={[
            { value: 'none', label: t('voice.nobody') },
            ...b.characters.map((c) => ({ value: String(c.id), label: c.name })),
          ]}
          className="h-8 text-[13px]"
        />
        <DraftArea
          label={t('voice.line')}
          value={shot.line}
          save={(line) => save({ line })}
          rows={2}
          maxLength={1000}
          placeholder={t('voice.linePlaceholder')}
        />
        <p className="text-xs text-muted">{t('voice.lineHint')}</p>
      </Section>

      <ExtraReferences shot={shot} save={save} />

      <Section
        title={t('fields.videoPrompt')}
        action={
          <Button size="sm" variant="ghost" onClick={onGeneratePrompt} loading={promptPending}>
            {promptPending ? null : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
            {shot.videoPrompt.trim() ? t('prompt.regenerate') : t('prompt.generate')}
          </Button>
        }
      >
        <MentionTextarea
          value={promptDraft.value}
          onChange={promptDraft.onChange}
          onBlur={() => void promptDraft.commit().catch((err) => toastError(err))}
          options={mentionOptions}
          disabled={promptPending}
          placeholder={t('prompt.placeholder')}
          labels={{ picker: t('prompt.picker'), empty: t('prompt.pickerEmpty'), unbound: t('prompt.unbound') }}
        />
        {shot.videoPromptStale ? (
          <p className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning" role="status">
            <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('prompt.stale')}
          </p>
        ) : null}
        <p className="text-xs text-muted">{t('prompt.hint')}</p>
        {mentionOptions.length === 0 ? <Tag tone="warning">{t('prompt.noBindings')}</Tag> : null}
      </Section>

      <Section title={t('keyframes.prompt')}>
        <DraftArea label={t('keyframes.prompt')} value={shot.imagePrompt} save={(imagePrompt) => save({ imagePrompt })} rows={3} />
        <p className="text-xs text-muted">{t('keyframes.promptHint')}</p>
      </Section>
    </div>
  );
}
