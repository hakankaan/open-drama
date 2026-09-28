/** Open Drama mark: a frame under a slanted clapper stick. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id="od-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--accent-2)" />
        </linearGradient>
      </defs>
      <path d="M4 7.5 26.4 3l.9 4.4L4.9 11.9z" fill="url(#od-mark)" />
      <path d="M9.2 6.5 11.6 10.9M15.3 5.3l2.4 4.4M21.4 4.1l2.4 4.4" stroke="var(--surface)" strokeWidth="1.6" />
      <rect x="4" y="13" width="24" height="15" rx="3" fill="var(--ink)" />
      <path d="m14 17.2 5.6 3.3-5.6 3.3z" fill="var(--accent-2)" />
    </svg>
  );
}
