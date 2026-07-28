// CUSTOM: net-new script — powers the "Read more" truncation toggle for
// .mo-reviews__quote (snippets/mo-review-card.liquid, used by
// sections/custom-reviews.liquid). Quote text is CSS line-clamped (4 lines
// mobile / 3 lines desktop, see .mo-reviews__quote in custom.css) with an
// always-rendered but `hidden`-by-default "Read more" button right after it.
// This script measures whether the clamp actually truncated the text —
// `scrollHeight > clientHeight` is a reliable cross-browser signal for a
// `display:-webkit-box; -webkit-line-clamp` box — and only reveals the
// button when it did, so a short quote that already fits never shows a
// toggle that would do nothing.
//
// A ResizeObserver (not a manual window "resize" listener) re-runs this
// check any time the quote's own rendered box changes size. That alone
// covers both cases that matter here: crossing the mobile/desktop
// breakpoint (the clamp's line-count, and therefore the box height,
// changes) and a card going from hidden to visible via the reviews filter
// (mo-review-filter.js toggles the native `hidden` attribute, which itself
// triggers a resize once the element regains layout) — no separate
// visibility-tracking logic needed.
//
// Progressive enhancement by design (matching mo-tabs.js/mo-review-filter.js
// conventions in this project): the button starts `hidden` in the markup, so
// if this script fails to load, quotes stay clamped with no dead toggle
// ever appearing — a correct, harmless fallback rather than a broken
// expand control.
// UPSTREAM risk LOW — net-new asset, no Horizon file touched.

const QUOTE_SELECTOR = '.mo-reviews__quote';
const TOGGLE_SELECTOR = '[data-quote-toggle]';

// CUSTOM (2026-07-28, per Kalvis): lowercase, no sentence-case — matches
// the label's markup default in mo-review-card.liquid.
const READ_MORE_TEXT = 'read more';
const READ_LESS_TEXT = 'read less';

/**
 * @param {HTMLElement} quote
 * @param {HTMLElement} button
 */
function toggleExpanded(quote, button) {
  const expanded = quote.classList.toggle('is-expanded');
  button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  button.textContent = expanded ? READ_LESS_TEXT : READ_MORE_TEXT;
}

/**
 * @param {HTMLElement} quote
 * @param {HTMLElement} button
 */
function checkOverflow(quote, button) {
  // Once expanded, the clamp is off (see .is-expanded in custom.css) — leave
  // the button visible (as "Read less") regardless of measured overflow.
  if (quote.classList.contains('is-expanded')) return;

  const isTruncated = quote.scrollHeight - quote.clientHeight > 1;
  button.hidden = !isTruncated;
}

function init() {
  document.querySelectorAll(QUOTE_SELECTOR).forEach((quote) => {
    const button = quote.nextElementSibling;
    if (!button || !button.matches(TOGGLE_SELECTOR)) return;

    button.addEventListener('click', () => toggleExpanded(quote, button));

    const observer = new ResizeObserver(() => checkOverflow(quote, button));
    observer.observe(quote);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
