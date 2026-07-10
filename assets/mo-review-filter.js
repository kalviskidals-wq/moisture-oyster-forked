// CUSTOM: net-new web component — <mo-review-filter> powers the filter pills +
// card visibility for sections/custom-reviews.liquid. Progressive enhancement
// by design (matching the mo-tabs.js convention in this project): the Liquid
// markup renders the filter pill bar with a `hidden` attribute and ALL review
// cards visible/unfiltered with no inline script, so if this file fails to
// load the pills simply never appear and every review stays visible — a
// correct, harmless fallback rather than a broken filtered state. On connect,
// this component removes `hidden` from the pill bar (now that JS is confirmed
// running) and wires up click handling: one active filter at a time,
// `aria-pressed` reflects state, "ALL" resets to show every card. Cards carry
// their matching tags in a `data-tags` comma list (see mo-review-card.liquid);
// a card is shown when the active filter is "all" or appears in that list.
// UPSTREAM risk LOW — net-new asset, no Horizon file touched.

const FILTER_BAR_SELECTOR = '[data-mo-reviews-filters]';
const FILTER_BUTTON_SELECTOR = '[data-filter]';
const CARD_SELECTOR = '.mo-reviews__card';

class MoReviewFilter extends HTMLElement {
  /** @type {AbortController} */
  #controller = new AbortController();

  /** @type {HTMLElement[]} */
  buttons = [];

  /** @type {HTMLElement[]} */
  cards = [];

  connectedCallback() {
    const { signal } = this.#controller;

    const filterBar = this.querySelector(FILTER_BAR_SELECTOR);
    this.buttons = Array.from(this.querySelectorAll(FILTER_BUTTON_SELECTOR));
    this.cards = Array.from(this.querySelectorAll(CARD_SELECTOR));

    if (!filterBar || !this.buttons.length) return;

    // Now that JS is confirmed running, reveal the filter pills — they stay
    // hidden (no-JS fallback state) otherwise.
    filterBar.removeAttribute('hidden');

    this.buttons.forEach((button) => {
      button.addEventListener('click', () => this.#applyFilter(button), { signal });
    });
  }

  disconnectedCallback() {
    this.#controller.abort();
  }

  /**
   * @param {HTMLElement} activeButton
   */
  #applyFilter(activeButton) {
    const filter = activeButton.dataset.filter || 'all';

    this.buttons.forEach((button) => {
      const isActive = button === activeButton;
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      button.classList.toggle('is-active', isActive);
    });

    this.cards.forEach((card) => {
      const tags = (card.dataset.tags || '').split(',').filter(Boolean);
      const matches = filter === 'all' || tags.includes(filter);
      card.hidden = !matches;
    });
  }
}

if (!customElements.get('mo-review-filter')) {
  customElements.define('mo-review-filter', MoReviewFilter);
}
