'use client';

import { ImageOff, Loader2, Sparkles, Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { IMAGE_UPLOAD_EXTENSIONS, type EpisodeCharacterCard } from '@open-drama/contracts';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { useToastError } from '@/lib/errors';
import { mediaUrl } from '@/lib/media';
import { useModelPicks } from '../configuration/model-picks';
import { useUploadMedia } from '../media/api';
import { useRequestOutfitImage, useUpdateEpisodeOutfit } from './api';

/**
 * What a character wears in this episode instead of its usual styling (adr-0023), and the full-body picture of it the
 * episode's shots send in place of the character's own views. The text saves when the field loses focus; a new outfit
 * drops the old picture. The picture is drawn from the headshot, or uploaded.
 */
export function CharacterOutfit({ character, episodeId, dramaId }: { character: EpisodeCharacterCard; episodeId: number; dramaId: number }) {
  const t = useTranslations('assets.outfit');
  const toastError = useToastError();
  const { picks } = useModelPicks();
  const update = useUpdateEpisodeOutfit(dramaId);
  const draw = useRequestOutfitImage(dramaId);
  const upload = useUploadMedia('image');
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(character.outfit);
  const save = (body: { outfit?: string; outfitPath?: string | null }) =>
    update.mutateAsync({ id: character.id, body: { episodeId, ...body } }).catch((err) => toastError(err));

  const task = character.latestOutfitTask;
  const drawing = task?.status === 'processing';
  const outfit = character.outfit.trim();
  const edited = text.trim() !== outfit;
  // A failed draw stops mattering once a picture is in place.
  const failed = task?.status === 'failed' && !character.outfitPath ? task.error : null;
  const blocked = !outfit ? t('describeFirst') : !character.views.headshot ? t('headshotFirst') : edited ? t('saveFirst') : null;

  const onDraw = async () => {
    try {
      await draw.mutateAsync({
        id: character.id,
        body: { episodeId, ...(picks.image ? { imageServiceId: picks.image.serviceId, model: picks.image.model } : {}) },
      });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CONFLICT') toast.info(t('alreadyDrawing'));
      else toastError(err);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const media = await upload.mutateAsync(file);
      await save({ outfitPath: media.path });
    } catch (err) {
      toastError(err);
    } finally {
      if (input.current) input.current.value = '';
    }
  };

  return (
    <Field label={t('title')} htmlFor="character-outfit" hint={t('hint')}>
      <div className="flex flex-col gap-2">
        <Textarea
          id="character-outfit"
          value={text}
          maxLength={2000}
          placeholder={character.styling || t('placeholder')}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            if (edited) void save({ outfit: text.trim() });
          }}
          className="min-h-16"
        />
        {outfit ? (
          <div className="flex items-start gap-3">
            <div className="flex aspect-[9/16] w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-2">
              {drawing ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted" aria-label={t('drawing')} />
              ) : character.outfitPath ? (
                <a href={mediaUrl(character.outfitPath)} target="_blank" rel="noreferrer" className="h-full w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element -- media is served by the API through the proxy */}
                  <img src={mediaUrl(character.outfitPath)} alt={t('alt', { name: character.name })} className="h-full w-full object-cover" />
                </a>
              ) : (
                <ImageOff className="h-5 w-5 text-muted" aria-hidden />
              )}
            </div>
            <div className="flex min-w-0 flex-col items-start gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void onDraw()}
                loading={draw.isPending}
                disabled={drawing || blocked !== null}
                title={blocked ?? undefined}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {drawing ? t('drawing') : character.outfitPath ? t('redraw') : t('draw')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => input.current?.click()} loading={upload.isPending} disabled={drawing || edited}>
                <Upload className="h-3.5 w-3.5" aria-hidden />
                {character.outfitPath ? t('replace') : t('upload')}
              </Button>
              {character.outfitPath && !drawing ? (
                <Button size="sm" variant="quiet" onClick={() => void save({ outfitPath: null })} disabled={update.isPending}>
                  <X className="h-3.5 w-3.5" aria-hidden />
                  {t('remove')}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
        {failed ? (
          <p className="text-xs text-danger" role="alert">
            {failed}
          </p>
        ) : outfit && !character.outfitPath && !drawing ? (
          <p className="text-xs text-muted">{t('noPicture')}</p>
        ) : null}
        <input
          ref={input}
          type="file"
          accept={IMAGE_UPLOAD_EXTENSIONS.join(',')}
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </div>
    </Field>
  );
}
