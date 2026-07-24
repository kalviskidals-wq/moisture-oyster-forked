/**
 * CUSTOM: net-new asset — scroll-triggered autoplay for Horizon's native
 * deferred-media component (snippets/video.liquid, assets/media.js).
 *
 * Reuses render 'video' + <deferred-media> exactly as Horizon built it
 * (poster image + a real <video muted loop playsinline autoplay> sitting
 * inert inside a <template>, so the browser fetches nothing until that
 * content is cloned into the live DOM) rather than building a parallel
 * video-loading mechanism. The ONLY thing this file changes is WHEN that
 * happens: instead of Horizon's own click-triggered showDeferredMedia
 * (bound to the poster button's on:click), an IntersectionObserver calls
 * the same public DeferredMedia.loadContent() method once a
 * [data-scroll-autoplay] instance scrolls near the viewport.
 *
 * snippets/video.liquid always passes `autoplay: true` to the video_tag
 * filter for the underlying <video> element (regardless of Horizon's own
 * video_autoplay param, which only controls whether the deferred/template
 * mechanism is used at all — see that file's comments) — so
 * DeferredMedia.loadContent() already calls .play() itself once the real
 * <video> is inserted (its own "force autoplay for Safari" branch). No
 * extra play() call is needed here.
 *
 * loadContent(focus) is called with focus:false — a scroll-triggered start
 * isn't a user gesture the way a click is, so it shouldn't steal keyboard
 * focus onto the video the way Horizon's own click handler intentionally
 * does.
 *
 * UPSTREAM risk LOW — no Horizon file touched, purely additive.
 */
document.addEventListener('DOMContentLoaded', () => {
  const targets = document.querySelectorAll('[data-scroll-autoplay]');
  if (!targets.length) return;

  if (!('IntersectionObserver' in window)) {
    // No-observer fallback (very old browsers): just load right away rather
    // than leaving the video permanently stuck on its poster image.
    targets.forEach((el) => {
      if (typeof el.loadContent === 'function') el.loadContent(false);
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        if (typeof el.loadContent === 'function') {
          el.loadContent(false);
        }
        observer.unobserve(el);
      });
    },
    {
      // Starts loading a little before the video is fully on-screen so
      // playback is already underway by the time it's actually visible,
      // rather than popping in mid-scroll.
      rootMargin: '200px 0px',
      threshold: 0,
    }
  );

  targets.forEach((el) => observer.observe(el));
});
