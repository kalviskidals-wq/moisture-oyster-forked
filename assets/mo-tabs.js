// CUSTOM: net-new web component — <mo-tabs> powers the tablist in
// sections/custom-ingredient-transparency.liquid (Active / Inactive / Free From /
// Specs). Progressive enhancement by design: the Liquid markup renders all 4
// tabpanels visible/stacked with no `hidden` attribute and no inline script, so
// content stays fully readable if this file fails to load. On connect, this
// component hides every panel except the one matching the already-selected tab
// (server-rendered as tab 1 / aria-selected="true"), then wires up click +
// arrow-key/Home/End roving-tabindex navigation per the WAI-ARIA APG tabs
// pattern (automatic activation — moving focus with arrow keys activates the
// panel immediately, same as Horizon's own layered-slideshow tablist).
// Ingredient accordions are native <details>/<summary> (see
// snippets/mo-ingredient-item.liquid) and are intentionally NOT handled here —
// they already work with zero JS.
// UPSTREAM risk LOW — net-new asset, no Horizon file touched.

const TAB_SELECTOR = '[role="tab"]';

class MoTabs extends HTMLElement {
  /** @type {AbortController} */
  #controller = new AbortController();

  /** @type {HTMLElement[]} */
  tabs = [];

  /** @type {(HTMLElement | null)[]} */
  panels = [];

  connectedCallback() {
    const { signal } = this.#controller;

    const tablist = this.querySelector('[role="tablist"]');
    if (!tablist) return;

    this.tabs = Array.from(tablist.querySelectorAll(TAB_SELECTOR));
    this.panels = this.tabs.map((tab) => {
      const panelId = tab.getAttribute('aria-controls');
      return panelId ? this.querySelector(`#${CSS.escape(panelId)}`) : null;
    });

    if (!this.tabs.length) return;

    let activeIndex = this.tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
    if (activeIndex === -1) activeIndex = 0;

    // Apply initial hidden state now that JS is confirmed to be running —
    // without this, every panel stays visible (the no-JS fallback state).
    this.#activate(activeIndex, { focus: false });

    this.tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => this.#activate(index, { focus: true }), { signal });
    });

    tablist.addEventListener('keydown', (event) => this.#handleKeyDown(event), { signal });
  }

  disconnectedCallback() {
    this.#controller.abort();
  }

  /**
   * @param {KeyboardEvent} event
   */
  #handleKeyDown(event) {
    const currentIndex = this.tabs.indexOf(/** @type {HTMLElement} */ (document.activeElement));
    if (currentIndex === -1) return;

    let nextIndex = null;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % this.tabs.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + this.tabs.length) % this.tabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = this.tabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    this.#activate(nextIndex, { focus: true });
  }

  /**
   * @param {number} index
   * @param {{ focus: boolean }} options
   */
  #activate(index, { focus }) {
    this.tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.setAttribute('tabindex', selected ? '0' : '-1');
      tab.classList.toggle('is-active', selected);
      if (selected && focus) tab.focus();
    });

    this.panels.forEach((panel, i) => {
      if (!panel) return;
      panel.hidden = i !== index;
    });
  }
}

if (!customElements.get('mo-tabs')) {
  customElements.define('mo-tabs', MoTabs);
}
