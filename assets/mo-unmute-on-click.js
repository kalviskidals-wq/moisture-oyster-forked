/**
 * CUSTOM: net-new asset — Horizon's native deferred-media component
 * (snippets/video.liquid, assets/media.js) always renders its <video> tag
 * with `muted` hardcoded true, for every use of {% render 'video' %} on the
 * theme (product gallery, video blocks, etc.) — presumably so ambient/inline
 * video never surprises a shopper with sound. That's the right default
 * almost everywhere, but a few sections (e.g. custom-expert-video.liquid's
 * doctor video review) want the opposite: a deliberate click on the poster's
 * play button is a real user gesture, so the video should play WITH sound.
 *
 * Rather than forking snippets/video.liquid (a large shared Horizon file
 * covering Shopify-hosted video, YouTube/Vimeo URLs, and the no-JS
 * placeholder state — duplicating all of that would be a much bigger
 * UPSTREAM footprint than needed), this file opts a specific instance in by
 * listening for a click on any deferred-media poster button that lives
 * inside a wrapper carrying `data-unmute-on-click`, and un-muting + replaying
 * the <video> element Horizon's own click handler already inserted.
 *
 * Ordering this depends on: Horizon's <deferred-media> custom element wires
 * its own poster-button click listener (on:click="/showDeferredMedia") in
 * connectedCallback(), which runs while the initial HTML is parsed — i.e.
 * before this script's DOMContentLoaded listener attaches its own listener
 * on the same button. Multiple listeners on the same element fire
 * synchronously, in registration order, for one real click event — so by
 * the time our handler runs, Horizon's has already run first, already
 * inserted the real <video> element into the DOM (deferred-media's
 * showDeferredMedia -> loadContent -> appendChild, all synchronous) and
 * already called .play() once (muted). We simply find that same <video>,
 * flip `.muted = false`, and call .play() again — still within the same
 * user-gesture-triggered click, so browsers honor the unmuted playback.
 *
 * UPSTREAM risk LOW — no Horizon file touched, purely additive.
 */
document.addEventListener('DOMContentLoaded', () => {
  const wrappers = document.querySelectorAll('[data-unmute-on-click]');

  wrappers.forEach((wrapper) => {
    const playButton = wrapper.querySelector('.deferred-media__poster-button');
    if (!playButton) return;

    playButton.addEventListener('click', () => {
      const video = wrapper.querySelector('video');
      if (!video) return;

      video.muted = false;
      video.volume = 1;

      const playResult = video.play();
      if (playResult && typeof playResult.catch === 'function') {
        // Autoplay-with-sound can still be rejected in rare edge cases
        // (e.g. a browser that doesn't treat this click as a fresh enough
        // gesture) — fail silently rather than throwing an unhandled
        // rejection; the video is still visible/paused with controls in
        // that case, not a hard failure.
        playResult.catch(() => {});
      }
    });
  });
});
