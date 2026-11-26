// A video on the site (the makers video, the home page's overview): the
// browser's own player, loaded only when played, with its poster until then.
// Plays are counted once by Measure (video_play), so a page needs no wiring.
export function VideoPlayer({ src, poster, label, className = "" }: { src: string; poster: string; label: string; className?: string }) {
  return (
    <video controls playsInline preload="none" poster={poster} aria-label={label}
      className={`block aspect-video h-auto w-full rounded-card bg-dark shadow-[inset_0_0_0_1px_var(--border)] ${className}`}>
      <source src={src} type="video/mp4" />
    </video>
  );
}
