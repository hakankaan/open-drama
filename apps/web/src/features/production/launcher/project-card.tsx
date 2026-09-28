'use client';

import { Clapperboard, Map, MoreHorizontal, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { DramaListItem, DramaStatus } from '@open-drama/contracts';
import { FrameCover } from '@/components/frame-cover';
import { StatusMenu } from '@/components/status-menu';
import { Button } from '@/components/ui/button';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { relativeTime } from '@/lib/time';

export function ProjectCard({
  drama,
  styleName,
  onStatus,
  onDelete,
}: {
  drama: DramaListItem;
  styleName: string;
  onStatus: (status: DramaStatus) => void;
  onDelete: () => void;
}) {
  const t = useTranslations('launcher.card');
  const locale = useLocale();
  const router = useRouter();
  const href = `/drama/${drama.id}`;
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-sm transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-md">
      <Link href={href} className="block focus-visible:outline-offset-[-2px]" aria-label={t('open', { title: drama.title })}>
        <FrameCover aspectRatio={drama.aspectRatio} title={drama.title} seed={drama.id} thumbnail={drama.thumbnail} />
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={href} className="min-w-0">
            <h2 className="truncate font-display text-[22px] leading-tight font-semibold tracking-wide">{drama.title}</h2>
          </Link>
          <Menu>
            <MenuTrigger asChild>
              <Button variant="ghost" size="icon" className="-mt-1 -mr-2 h-8 w-8" aria-label={t('more')}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </MenuTrigger>
            <MenuContent keepFocus>
              <MenuItem onSelect={() => router.push(href)}>{t('openAction')}</MenuItem>
              <MenuSeparator />
              <MenuItem danger onSelect={onDelete}>
                {t('delete')}
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusMenu value={drama.status} onChange={onStatus} />
          <span className="text-[13px] text-muted">{styleName}</span>
        </div>
        <dl className="mt-auto flex items-center gap-4 text-[13px] text-ink-2">
          <div className="flex items-center gap-1.5" title={t('episodes', { count: drama.episodeCount })}>
            <dt>
              <Clapperboard className="h-3.5 w-3.5 text-muted" aria-label={t('episodesLabel')} />
            </dt>
            <dd>{drama.episodeCount}</dd>
          </div>
          <div className="flex items-center gap-1.5" title={t('characters', { count: drama.characterCount })}>
            <dt>
              <Users className="h-3.5 w-3.5 text-muted" aria-label={t('charactersLabel')} />
            </dt>
            <dd>{drama.characterCount}</dd>
          </div>
          <div className="flex items-center gap-1.5" title={t('scenes', { count: drama.sceneCount })}>
            <dt>
              <Map className="h-3.5 w-3.5 text-muted" aria-label={t('scenesLabel')} />
            </dt>
            <dd>{drama.sceneCount}</dd>
          </div>
          <time dateTime={drama.updatedAt} className="ml-auto text-xs text-muted">
            {relativeTime(drama.updatedAt, locale)}
          </time>
        </dl>
      </div>
    </article>
  );
}
