import type { AspectRatio } from '@open-drama/contracts';
import { cn } from '@/lib/cn';
import { mediaUrl } from '@/lib/media';

const RATIO: Record<AspectRatio, string> = { '16:9': '16 / 9', '9:16': '9 / 16', '1:1': '1 / 1', adaptive: '4 / 3' };

/** A stable hue per project so the launcher wall is varied without using the accent colour. */
const hueOf = (seed: number) => (seed * 137.508) % 360;

/**
 * The project's frame drawn at its real aspect ratio inside a dark viewfinder, with safe-area corner marks.
 * Shows the cover image when there is one, otherwise the title's initial.
 */
export function FrameCover({
  aspectRatio,
  title,
  seed,
  thumbnail,
  className,
  size = 'md',
}: {
  aspectRatio: AspectRatio;
  title: string;
  seed: number;
  thumbnail?: string | null;
  className?: string;
  size?: 'md' | 'sm';
}) {
  const portrait = aspectRatio === '9:16';
  const hue = hueOf(seed);
  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden bg-frame',
        size === 'md' ? 'h-48 p-5' : 'h-24 w-32 shrink-0 rounded-md p-2.5',
        className,
      )}
    >
      <div
        className={cn(
          'relative max-h-full max-w-full overflow-hidden rounded-[3px]',
          portrait ? 'h-full' : 'w-full',
          aspectRatio === 'adaptive' && 'outline-1 outline-offset-2 outline-white/25 outline-dashed',
        )}
        style={{
          aspectRatio: RATIO[aspectRatio],
          background: `linear-gradient(150deg, oklch(0.42 0.09 ${hue}), oklch(0.24 0.06 ${hue + 40}))`,
        }}
      >
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- media is served by the API through the proxy
          <img src={mediaUrl(thumbnail)} alt="" className="h-full w-full object-cover" />
        ) : (
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center font-display font-bold text-white/85 select-none',
              size === 'md' ? 'text-6xl' : 'text-3xl',
            )}
            aria-hidden
          >
            {title.trim().charAt(0).toUpperCase() || '·'}
          </span>
        )}
        {size === 'md' ? (
          <span aria-hidden className="pointer-events-none absolute inset-2">
            <span className="absolute top-0 left-0 h-2.5 w-2.5 border-t border-l border-white/60" />
            <span className="absolute top-0 right-0 h-2.5 w-2.5 border-t border-r border-white/60" />
            <span className="absolute bottom-0 left-0 h-2.5 w-2.5 border-b border-l border-white/60" />
            <span className="absolute right-0 bottom-0 h-2.5 w-2.5 border-r border-b border-white/60" />
          </span>
        ) : null}
      </div>
    </div>
  );
}
