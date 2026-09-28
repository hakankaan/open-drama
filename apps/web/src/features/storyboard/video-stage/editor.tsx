'use client';

import { ArrowRight, FileAudio, FileVideo, ImagePlus, Sparkles, Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import {
  AUDIO_UPLOAD_EXTENSIONS,
  IMAGE_UPLOAD_EXTENSIONS,
  VIDEO_UPLOAD_EXTENSIONS,
  type EpisodeAssets,
  type ReferenceMedia,
  type ShotCard,
  type UpdateShot,
} from '@open-drama/contracts';
import { MentionTextarea } from '@/components/mention-textarea';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
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

function DraftArea({ value, save, rows, label }: { value: string; save: (v: string) => Promise<unknown>; rows: number; label: string }) {
  const toastError = useToastError();
  const draft = useDraft(value, save);
  return (
    <Textarea
      aria-label={label}
      rows={rows}
      value={draft.value}
      onChange={(e) => draft.onChange(e.target.value)}
      onBlur={() => void draft.commit().catch((err) => toastError(err))}
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

/** Column 2: what the shot is (description, atmosphere), what it references, and its video prompt. */
export function ShotEditor({
  shot,
  assets,
  save,
  onGeneratePrompt,
  promptPending,
  onToAssets,
}: {
  shot: ShotCard;
  assets: EpisodeAssets | undefined;
  save: Save;
  onGeneratePrompt: () => void;
  promptPending: boolean;
  onToAssets: () => void;
}) {
  const t = useTranslations('studio.video');
  const toastError = useToastError();
  const promptDraft = useDraft(shot.videoPrompt, (videoPrompt) => save({ videoPrompt }));
  const b = shot.bindings;
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

  return (
    <div className="flex flex-col gap-5 p-4">
      <Section title={t('fields.description')}>
        <DraftArea label={t('fields.description')} value={shot.description} save={(description) => save({ description })} rows={6} />
      </Section>
      <Section title={t('fields.atmosphere')}>
        <DraftArea label={t('fields.atmosphere')} value={shot.atmosphere} save={(atmosphere) => save({ atmosphere })} rows={2} />
      </Section>

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
        </div>
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
        <p className="text-xs text-muted">{t('prompt.hint')}</p>
        {mentionOptions.length === 0 ? <Tag tone="warning">{t('prompt.noBindings')}</Tag> : null}
      </Section>
    </div>
  );
}
