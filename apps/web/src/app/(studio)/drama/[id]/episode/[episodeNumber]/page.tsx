import { notFound } from 'next/navigation';
import { EpisodeStudio } from '@/features/production/studio/episode-studio';

export default async function Studio({ params }: { params: Promise<{ id: string; episodeNumber: string }> }) {
  const { id, episodeNumber } = await params;
  const dramaId = Number(id);
  const number = Number(episodeNumber);
  if (!Number.isInteger(dramaId) || dramaId <= 0 || !Number.isInteger(number) || number <= 0) notFound();
  return <EpisodeStudio dramaId={dramaId} episodeNumber={number} />;
}
