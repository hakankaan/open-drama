import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { AgentJob, DramaJobs, EpisodeJobs, GetJobsInput, JobWaitResult, WaitForJob } from '@open-drama/contracts';
import { invalid } from '../../http/errors';
import { jobOutcome } from '../../modules/jobs/outcome';
import { cancelJob, getDramaJobs, getEpisodeJobs, getJobRow, toAgentJob, waitForSettled } from '../../modules/jobs/run-job';
import { getDramaRow } from '../../modules/production/dramas';
import { getEpisodeRow } from '../../modules/production/episodes';
import { tool } from '../errors';

export function registerJobTools(server: McpServer, disconnected?: AbortSignal) {
  tool(
    server,
    'get_jobs',
    {
      title: 'Get the jobs',
      description: "A project's latest outline and plan jobs and its latest design job per kind and, with an episodeId, that episode's latest job per kind (write, rewrite, recap, extraction per kind, breakdown, video prompts).",
      input: GetJobsInput,
      output: z.object({ drama: DramaJobs, episode: EpisodeJobs.nullable() }),
      readOnly: true,
    },
    ({ dramaId, episodeId }) => {
      getDramaRow(dramaId);
      if (episodeId !== undefined && getEpisodeRow(episodeId).dramaId !== dramaId) throw invalid(`Episode ${episodeId} is not in project ${dramaId}`);
      return { drama: getDramaJobs(dramaId), episode: episodeId === undefined ? null : getEpisodeJobs(episodeId) };
    },
  );

  tool(
    server,
    'wait_for_job',
    {
      title: 'Wait for a job',
      description:
        'Waits up to timeoutSeconds (default 30, at most 300; 0 reads at once) for the job to settle and returns it with its outcome: the outline size and revision, the episodes a plan added, the script and the recap job a write started, the recap size (sizes and revisions as the texts are now), what a design saved and filled with the names it skipped or could not fit and the outline revision it read. A job still running comes back with settled: false; call again. A failed job carries its error.',
      input: WaitForJob,
      output: JobWaitResult,
      readOnly: true,
    },
    async ({ jobId, timeoutSeconds }, extra) => {
      // The protocol's cancellation and the client hanging up both end the wait.
      await waitForSettled(jobId, timeoutSeconds * 1000, disconnected ? AbortSignal.any([extra.signal, disconnected]) : extra.signal);
      const row = getJobRow(jobId);
      return { job: toAgentJob(row), settled: row.status !== 'running', outcome: jobOutcome(row) };
    },
  );

  tool(
    server,
    'cancel_job',
    {
      title: 'Cancel a job',
      description: 'Stops a running job; it settles as cancelled a moment later. A plan keeps the episodes it added; a breakdown restores the shots it parked. Only when the creator asks.',
      input: z.strictObject({ jobId: z.number().int().positive().describe('The job id') }),
      output: AgentJob,
      confirm: true,
    },
    ({ jobId }) => cancelJob(jobId),
  );
}
