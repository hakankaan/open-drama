/**
 * Set once the process starts shutting down. Work it cuts short is left as it stands instead of being recorded as
 * failed: boot cleanup fails it with the restart message, or resumes a paid generation (adr-0005).
 */
let stopping = false;

export const isShuttingDown = () => stopping;
export const beginShutdown = () => {
  stopping = true;
};
