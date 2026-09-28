import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ProjectPage } from '@/features/production/project-page/project-page';

export default async function Project({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return (
    <Suspense>
      <ProjectPage dramaId={id} />
    </Suspense>
  );
}
