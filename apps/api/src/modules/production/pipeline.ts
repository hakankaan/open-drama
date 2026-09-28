import { and, desc, eq, isNull } from 'drizzle-orm';
import { isNarrator, type EpisodePipelineStatus, type StepStatus } from '@open-drama/contracts';
import { db } from '../../db/client';
import { characters, episodeCharacters, episodeProps, episodeScenes, films, props, scenes, shots } from '../../db/schema';
import { getEpisodeRow } from './episodes';

const progress = (done: number, total: number): StepStatus => ({
  state: total === 0 ? 'empty' : done >= total ? 'done' : 'in_progress',
  done,
  total,
});

/**
 * EpisodePipelineStatus, derived on read (the stage rail is never stored). Script is ready when raw content
 * exists and done when scriptContent exists; asset steps count linked assets with an image (narrators excluded);
 * videos count live shots with a video; merge is done when the episode has a film.
 */
export function getPipelineStatus(episodeId: number): EpisodePipelineStatus {
  const ep = getEpisodeRow(episodeId);

  const linkedCharacters = db
    .select({ name: characters.name, role: characters.role, imagePath: characters.imagePath })
    .from(episodeCharacters)
    .innerJoin(characters, eq(characters.id, episodeCharacters.characterId))
    .where(and(eq(episodeCharacters.episodeId, episodeId), isNull(characters.deletedAt)))
    .all()
    .filter((c) => !isNarrator(c.name, c.role));
  const linkedScenes = db
    .select({ imagePath: scenes.imagePath })
    .from(episodeScenes)
    .innerJoin(scenes, eq(scenes.id, episodeScenes.sceneId))
    .where(and(eq(episodeScenes.episodeId, episodeId), isNull(scenes.deletedAt)))
    .all();
  const linkedProps = db
    .select({ imagePath: props.imagePath })
    .from(episodeProps)
    .innerJoin(props, eq(props.id, episodeProps.propId))
    .where(and(eq(episodeProps.episodeId, episodeId), isNull(props.deletedAt)))
    .all();
  const withImage = (rows: { imagePath: string | null }[]) => rows.filter((r) => r.imagePath).length;

  const liveShots = db
    .select({ videoPath: shots.videoPath })
    .from(shots)
    .where(and(eq(shots.episodeId, episodeId), isNull(shots.parkedByJobId)))
    .all();

  const latestFilm = db
    .select({ status: films.status })
    .from(films)
    .where(eq(films.episodeId, episodeId))
    .orderBy(desc(films.id))
    .get();

  const hasScript = ep.scriptContent !== null && ep.scriptContent.trim().length > 0;
  return {
    episodeId,
    script: {
      state: hasScript ? 'done' : ep.content.trim() ? 'ready' : 'empty',
      done: hasScript ? 1 : 0,
      total: 1,
    },
    characters: progress(withImage(linkedCharacters), linkedCharacters.length),
    scenes: progress(withImage(linkedScenes), linkedScenes.length),
    props: progress(withImage(linkedProps), linkedProps.length),
    shots: { state: liveShots.length > 0 ? 'done' : 'empty', done: liveShots.length, total: liveShots.length },
    videos: progress(liveShots.filter((s) => s.videoPath).length, liveShots.length),
    merge: {
      state: ep.filmPath ? 'done' : latestFilm?.status === 'processing' ? 'in_progress' : 'empty',
      done: ep.filmPath ? 1 : 0,
      total: 1,
    },
    completed: ep.status === 'completed',
  };
}
