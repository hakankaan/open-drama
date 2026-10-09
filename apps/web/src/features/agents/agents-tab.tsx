'use client';

import { ChevronDown, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { SkillId, type AgentType, type ContentLanguage, type SkillSummary } from '@open-drama/contracts';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tag } from '@/components/ui/tag';
import { LOCALE_LABELS, type Locale } from '@/i18n/locales';
import { cn } from '@/lib/cn';
import { useToastError } from '@/lib/errors';
import {
  useAgentCatalog,
  useAgentPrompt,
  useCreateSkill,
  useDeleteSkill,
  useResetAgentPrompt,
  useSaveAgentPrompt,
  useSkill,
  useSkills,
  useUpdateSkill,
} from './api';

/** Edits a server text with an explicit Save; follows server changes unless there are unsaved edits. */
function useTextDraft(server: string | undefined) {
  const [draft, setDraft] = useState(server ?? '');
  const [base, setBase] = useState(server);
  if (server !== base) {
    setBase(server);
    if (draft === (base ?? '')) setDraft(server ?? '');
  }
  return [draft, setDraft, server !== undefined && draft !== server] as const;
}

function PromptPane({ type, lang }: { type: AgentType; lang: ContentLanguage }) {
  const t = useTranslations('settings.agents');
  const tc = useTranslations('common');
  const toastError = useToastError();
  const prompt = useAgentPrompt(type, lang);
  const save = useSaveAgentPrompt();
  const reset = useResetAgentPrompt();
  const [draft, setDraft, dirty] = useTextDraft(prompt.data?.body);
  const [confirmReset, setConfirmReset] = useState(false);

  if (!prompt.data) return <Skeleton className="h-80" />;
  const onSave = async () => {
    try {
      await save.mutateAsync({ type, lang, body: draft });
      toast.success(t('saved'));
    } catch (err) {
      toastError(err);
    }
  };
  const onReset = async () => {
    try {
      await reset.mutateAsync({ type, lang });
      setConfirmReset(false);
    } catch (err) {
      toastError(err);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="font-mono text-muted">{prompt.data.path}</span>
        {prompt.data.source !== 'variant' && lang !== 'en' ? <Tag tone="warning">{t('fallback')}</Tag> : null}
        {prompt.data.source === 'default' ? <Tag>{t('builtIn')}</Tag> : null}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setConfirmReset(true)}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            {t('reset')}
          </Button>
          <Button size="sm" variant="primary" onClick={onSave} loading={save.isPending} disabled={!dirty}>
            {dirty ? tc('save') : t('savedState')}
          </Button>
        </div>
      </div>
      <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-[50dvh] font-mono text-[13px] leading-relaxed" aria-label={t('prompt')} />
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={t('resetTitle')}
        description={lang === 'en' ? t('resetBodyEn') : t('resetBodyVariant')}
        confirmLabel={t('reset')}
        onConfirm={onReset}
        pending={reset.isPending}
      />
    </div>
  );
}

function SkillCard({ skill, lang }: { skill: SkillSummary; lang: ContentLanguage }) {
  const t = useTranslations('settings.agents');
  const tc = useTranslations('common');
  const toastError = useToastError();
  const [open, setOpen] = useState(false);
  const detail = useSkill(skill.id, lang, open);
  const update = useUpdateSkill();
  const remove = useDeleteSkill();
  const [draft, setDraft, dirty] = useTextDraft(detail.data?.body);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const onSave = async () => {
    try {
      await update.mutateAsync({ id: skill.id, lang, body: draft });
      toast.success(t('saved'));
    } catch (err) {
      toastError(err);
    }
  };
  const onDelete = async () => {
    try {
      await remove.mutateAsync({ id: skill.id, lang });
      setConfirmDelete(false);
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <li className="rounded-lg border border-line bg-surface">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start gap-3 px-4 py-3 text-left">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{skill.name}</p>
          {skill.description ? <p className="text-[13px] text-ink-2">{skill.description}</p> : null}
        </div>
        {lang !== 'en' && !skill.hasVariant ? <Tag tone="warning">{t('fallback')}</Tag> : null}
        <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open ? (
        <div className="flex flex-col gap-2 border-t border-line px-4 py-3">
          {detail.data ? (
            <>
              <span className="font-mono text-xs text-muted">{detail.data.path}</span>
              <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-72 font-mono text-[13px] leading-relaxed" aria-label={skill.name} />
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  {lang === 'en' ? tc('delete') : t('deleteVariant')}
                </Button>
                <Button size="sm" variant="primary" className="ml-auto" onClick={onSave} loading={update.isPending} disabled={!dirty}>
                  {dirty ? tc('save') : t('savedState')}
                </Button>
              </div>
            </>
          ) : (
            <Skeleton className="h-40" />
          )}
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('deleteSkillTitle', { name: skill.name })}
        description={lang === 'en' ? t('deleteSkillBody') : t('deleteVariantBody')}
        confirmLabel={tc('delete')}
        onConfirm={onDelete}
        pending={remove.isPending}
      />
    </li>
  );
}

const PREFIX: Record<AgentType, string> = {
  script_rewriter: 'script-rewriter/',
  extractor: 'extractor/',
  storyboard_breaker: 'storyboard-breaker/',
  prompt_generator: 'prompt-generator/',
  recap_writer: 'recap-writer/',
  episode_writer: 'episode-writer/',
  story_writer: 'story-writer/',
  episode_planner: 'episode-planner/',
};

function AddSkillDialog({ agent, onClose }: { agent: AgentType; onClose: () => void }) {
  const t = useTranslations('settings.agents.add');
  const tc = useTranslations('common');
  const toastError = useToastError();
  const create = useCreateSkill();
  const [dir, setDir] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [touched, setTouched] = useState(false);
  const id = PREFIX[agent] + dir.trim();
  const idError = !SkillId.safeParse(id).success || !dir.trim() ? t('invalidDir') : undefined;

  const submit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched(true);
    if (idError || !name.trim()) return;
    try {
      await create.mutateAsync({ id, name: name.trim(), description: description.trim(), body: '' });
      onClose();
    } catch (err) {
      toastError(err);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && !create.isPending && onClose()}>
      <DialogContent title={t('title')} description={t('description')}>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label={t('dir')} htmlFor="skill-dir" hint={t('dirHint', { path: `skills/${id}/SKILL.md` })} error={touched ? idError : undefined}>
            <Input id="skill-dir" autoFocus value={dir} onChange={(e) => setDir(e.target.value.toLowerCase())} className="font-mono text-[13px]" />
          </Field>
          <Field label={t('name')} htmlFor="skill-name" error={touched && !name.trim() ? t('required') : undefined}>
            <Input id="skill-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </Field>
          <Field label={t('descriptionField')} htmlFor="skill-desc">
            <Input id="skill-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
          </Field>
          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={create.isPending}>
              {t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Settings → Agents: each agent's system prompt and skills, edited in the current content language. */
export function AgentsTab() {
  const t = useTranslations('settings.agents');
  const lang = useLocale() as Locale;
  const catalog = useAgentCatalog(lang);
  const skills = useSkills(lang);
  const [selected, setSelected] = useState<AgentType>('script_rewriter');
  const [view, setView] = useState<'prompt' | 'skills'>('prompt');
  const [adding, setAdding] = useState(false);

  const agentSkills = (skills.data ?? []).filter((s) => s.agent === selected || s.id.startsWith(PREFIX[selected]));
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-md bg-surface-2 px-3 py-2 text-[13px] text-ink-2">{t('languageNote', { language: LOCALE_LABELS[lang] })}</p>
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <ul className="flex gap-1 overflow-x-auto lg:flex-col">
          {(catalog.data ?? []).map((a) => (
            <li key={a.type}>
              <button
                type="button"
                onClick={() => setSelected(a.type)}
                aria-current={selected === a.type ? 'true' : undefined}
                className={cn(
                  'flex w-full flex-col rounded-md px-3 py-2 text-left transition-colors',
                  selected === a.type ? 'bg-surface shadow-sm ring-1 ring-line' : 'hover:bg-surface-2',
                )}
              >
                <span className="text-sm font-medium whitespace-nowrap">{a.name}</span>
                <span className="text-xs text-muted">{t('skillCount', { count: a.skillCount })}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-center gap-4 border-b border-line">
            {(['prompt', 'skills'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-selected={view === v}
                role="tab"
                className={cn('-mb-px border-b-2 pb-2 text-sm font-medium', view === v ? 'border-ink text-ink' : 'border-transparent text-ink-2 hover:text-ink')}
              >
                {v === 'prompt' ? t('prompt') : t('skills', { count: agentSkills.length })}
              </button>
            ))}
            {view === 'skills' ? (
              <Button size="sm" variant="ghost" className="mb-1 ml-auto" onClick={() => setAdding(true)}>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                {t('addSkill')}
              </Button>
            ) : null}
          </div>
          {view === 'prompt' ? (
            <PromptPane key={`${selected}:${lang}`} type={selected} lang={lang} />
          ) : (
            <ul className="flex flex-col gap-2">
              {agentSkills.map((s) => (
                <SkillCard key={`${s.id}:${lang}`} skill={s} lang={lang} />
              ))}
              {agentSkills.length === 0 ? <p className="text-sm text-ink-2">{t('noSkills')}</p> : null}
            </ul>
          )}
        </div>
      </div>
      {adding ? <AddSkillDialog agent={selected} onClose={() => setAdding(false)} /> : null}
    </div>
  );
}
