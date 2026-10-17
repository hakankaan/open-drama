'use client';

import { Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { AUDIO_UPLOAD_EXTENSIONS, type CharacterCard } from '@open-drama/contracts';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToastError } from '@/lib/errors';
import { mediaUrl } from '@/lib/media';
import { useUploadMedia } from '../media/api';
import { useSpeechVoices } from '../storyboard/api';
import { useUpdateAsset } from './api';

const NONE = 'none';

/**
 * The voice a character's lines are spoken in (adr-0021): one of the speech model's voices, and a recording of the
 * character's voice, cloned by a model that clones. Both save at once, like the character's images, and clear the
 * line audio of the shots the character speaks in.
 */
export function CharacterVoice({ character, dramaId }: { character: CharacterCard; dramaId: number }) {
  const t = useTranslations('assets.voice');
  const toastError = useToastError();
  const speech = useSpeechVoices();
  const upload = useUploadMedia('audio');
  const update = useUpdateAsset(dramaId);
  const input = useRef<HTMLInputElement>(null);
  const save = (body: { voice?: string; voiceSamplePath?: string | null }) =>
    update.mutateAsync({ kind: 'character', id: character.id, body }).catch((err) => toastError(err));

  const model = speech.data?.model ?? null;
  const voices = speech.data?.voices ?? [];
  // A voice the model no longer offers stays listed, so the select shows what is stored.
  const options = [
    { value: NONE, label: t('none') },
    ...voices.map((v) => ({ value: v, label: v })),
    ...(character.voice && !voices.includes(character.voice) ? [{ value: character.voice, label: character.voice, hint: t('notOffered') }] : []),
  ];

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const media = await upload.mutateAsync(file);
      await save({ voiceSamplePath: media.path });
    } catch (err) {
      toastError(err);
    } finally {
      if (input.current) input.current.value = '';
    }
  };

  const hint = speech.isError
    ? t('unavailable')
    : !speech.data
      ? undefined
      : !model
        ? t('noService')
        : speech.data.cloning
          ? t('clones', { model })
          : t('named', { model });

  return (
    <Field label={t('title')} htmlFor="character-voice" hint={hint}>
      <div className="flex flex-col gap-2">
        <Select
          id="character-voice"
          value={character.voice || NONE}
          onValueChange={(v) => void save({ voice: v === NONE ? '' : v })}
          options={options}
          disabled={!model || update.isPending}
          className="h-9"
        />
        <div className="flex flex-wrap items-center gap-2">
          {character.voiceSamplePath ? (
            <>
              <audio src={mediaUrl(character.voiceSamplePath)} controls preload="none" className="h-8 min-w-0 flex-1" />
              <Button size="sm" variant="quiet" onClick={() => void save({ voiceSamplePath: null })} disabled={update.isPending}>
                <X className="h-3.5 w-3.5" aria-hidden />
                {t('removeSample')}
              </Button>
            </>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => input.current?.click()} loading={upload.isPending}>
            <Upload className="h-3.5 w-3.5" aria-hidden />
            {character.voiceSamplePath ? t('replaceSample') : t('uploadSample')}
          </Button>
        </div>
        <p className="text-xs text-muted">{t('sampleHint')}</p>
        <input
          ref={input}
          type="file"
          accept={AUDIO_UPLOAD_EXTENSIONS.join(',')}
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </div>
    </Field>
  );
}
