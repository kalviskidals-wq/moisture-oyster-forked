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
    card.blur();
  } else {
    card.classList.add('is-open');
  }
});
