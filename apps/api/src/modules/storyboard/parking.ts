import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../../db/client';
import { shots } from '../../db/schema';

/**
 * Undoes a failed breakdown (adr-0008): when the job parked the episode's previous shots, the shots it created
 * are removed and the parked ones become live again. A job that never parked anything changes nothing.
 */
export function restoreParkedShots(jobId: number, episodeId: number): number {
  return db.transaction((tx) => {
    const parked = tx.select({ id: shots.id }).from(shots).where(eq(shots.parkedByJobId, jobId)).all();
    if (parked.length === 0) return 0;
    const created = tx
      .select({ id: shots.id })
      .from(shots)
      .where(and(eq(shots.episodeId, episodeId), isNull(shots.parkedByJobId)))
      .all();
    if (created.length > 0) {
      tx.delete(shots)
        .where(
          inArray(
            shots.id,
            created.map((s) => s.id),
          ),
        )
        .run();
    }
    tx.update(shots).set({ parkedByJobId: null }).where(eq(shots.parkedByJobId, jobId)).run();
    return parked.length;
  });
}
