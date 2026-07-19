/**
 * CUSTOM: net-new, UPSTREAM LOW — no Horizon file touched.
 *
 * Powers sections/custom-eye-health.liquid's flip cards (see custom.css's
 * .mo-eye-health__card-flip). Desktop already flips on :hover (and
 * :focus-within for keyboard users) via pure CSS — this script only exists
 * for touch devices, which have no hover state: a tap focuses the card
 * (opening it, since :focus-within matches), but a SECOND tap on an
 * already-open card needs to explicitly close it again rather than doing
 * nothing (per Kalvis, 2026-07-17).
 *
 * Adds/removes an `.is-open` class (combined with :hover/:focus-within in
 * custom.css's trigger selector) and blurs the card on close so
 * :focus-within stops matching too — without the blur, removing `.is-open`
 * alone wouldn't visually close a still-focused card.
 */
document.addEventListener('click', (event) => {
  const card = event.target.closest('.mo-eye-health__card');

  // Tapping anywhere outside a card closes every other open card.
  document.querySelectorAll('.mo-eye-health__card.is-open').forEach((openCard) => {
    if (openCard !== card) openCard.classList.remove('is-open');
  });

  if (!card) return;

  if (card.classList.contains('is-open')) {
    card.classList.remove('is-open');
    // CUSTOM FIX (2026-07-19, per Kalvis — 2nd tap wasn't closing the
    // card): calling blur() synchronously here lost a race against the
    // browser's own default focus-on-click behavior for this same click
    // event — the card immediately regained focus right after blur() ran,
    // so :focus-within kept matching and the card never visually closed.
    // Deferring to the next frame lets that native refocus happen first,
    // so this blur() is the one that actually sticks.
    requestAnimationFrame(() => card.blur());
  } else {
    card.classList.add('is-open');
  }
});
