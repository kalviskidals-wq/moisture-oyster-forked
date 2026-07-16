/**
 * CUSTOM: net-new, UPSTREAM LOW — no Horizon file touched.
 *
 * Powers sections/custom-header.liquid:
 *  - <mo-header-drawer> web component: the full-screen mobile menu panel.
 *    Handles open/close, a focus trap, ESC-to-close, and a body scroll lock.
 *    The visible trigger is the header's own burger/close toggle button
 *    (aria-expanded swaps the icon via CSS) — the drawer never duplicates
 *    the cart/account icons, it only owns the nav links + watermark.
 *  - Optional "scroll-up" sticky behavior: hides the header on scroll down,
 *    reveals it on scroll up. Only runs for headers with
 *    [data-sticky="scroll-up"] — "always" sticky is handled in pure CSS.
 *
 * Note on the header's rounded bottom corners (see custom.css): they are
 * plain, unconditional CSS, no scroll-position JS involved. Several JS
 * scroll-driven attempts at a "fill color behind the cutout" were tried and
 * reverted (see moisture-oyster-project memory for the full history) —
 * they all eventually produced a solid-colored block sitting behind/beside
 * the header in some scroll state (most recently: the fill lived on
 * #header-group, a persistent sticky ancestor, so it stayed visible even
 * when .mo-header itself slid away via the scroll-up hide transform).
 * The actual fix was simpler and needed no JS: assets/custom.css now sets
 * body's own background color to the header's green, so the one moment
 * nothing else is behind the corner cutout (true page top, before any
 * content is scrolled under the sticky header) shows green instead of the
 * theme's default white/cream page background.
 *
 * No-JS note: like Horizon's own <header-drawer> component, the mobile
 * burger has no functional fallback without JavaScript. The primary nav
 * itself (section's <nav class="mo-header__nav">) is plain markup and stays
 * keyboard/no-JS reachable whenever it's visible.
 */

class MoHeaderDrawer extends HTMLElement {
  connectedCallback() {
    this.panel = this.querySelector('[data-mo-drawer-panel]');
    this.handleKeydown = this.handleKeydown.bind(this);
    this.handleBackdropClick = this.handleBackdropClick.bind(this);
    this.addEventListener('click', this.handleBackdropClick);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.handleBackdropClick);
    document.removeEventListener('keydown', this.handleKeydown);
  }

  get toggleButton() {
    return document.querySelector('[data-mo-drawer-toggle][aria-controls="' + this.id + '"]');
  }

  handleBackdropClick(event) {
    if (event.target === this) this.close();
  }

  open() {
    this.hidden = false;
    document.documentElement.classList.add('mo-scroll-lock');
    document.addEventListener('keydown', this.handleKeydown);

    window.requestAnimationFrame(() => {
      this.classList.add('is-open');
      const firstFocusable = this.panel && this.panel.querySelector('a[href], button:not([disabled])');
      if (firstFocusable) firstFocusable.focus();
    });
  }

  close(options) {
    const restoreFocus = !options || options.restoreFocus !== false;

    this.classList.remove('is-open');
    document.documentElement.classList.remove('mo-scroll-lock');
    document.removeEventListener('keydown', this.handleKeydown);

    const toggle = this.toggleButton;
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    if (restoreFocus && toggle) toggle.focus();

    window.setTimeout(() => {
      this.hidden = true;
    }, 250);
  }

  handleKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }

    if (event.key !== 'Tab' || !this.panel) return;

    const toggle = this.toggleButton;
    const focusables = Array.from(this.panel.querySelectorAll('a[href], button:not([disabled])'));
    if (toggle) focusables.unshift(toggle);
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

if (!customElements.get('mo-header-drawer')) {
  customElements.define('mo-header-drawer', MoHeaderDrawer);
}

document.addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-mo-drawer-toggle]');
  if (!toggle) return;

  const targetId = toggle.getAttribute('aria-controls');
  const drawer = targetId && document.getElementById(targetId);
  if (!drawer) return;

  const isOpen = toggle.getAttribute('aria-expanded') === 'true';

  if (isOpen) {
    toggle.setAttribute('aria-expanded', 'false');
    drawer.close({ restoreFocus: false });
  } else {
    toggle.setAttribute('aria-expanded', 'true');
    drawer.open();
  }
});

// CUSTOM (fix, 2026-07-13): in-page "#anchor" links (e.g. the homepage
// hero's "HOW IT WORKS" CTA pointing at a section further down the page)
// silently did nothing on desktop. Root cause #1: Horizon's own
// .page-wrapper becomes the real scrolling element (overflow-y: auto) at
// desktop widths (>=990px, see base.css) while window/document stays fixed
// — the browser's native hash-navigation (":target" jump on click / on
// load) only scrolls the document/viewport, so on desktop there was
// nothing for it to actually scroll. Fixed generically for every same-page
// hash link on the site by intercepting the click and calling
// scrollIntoView() on the target instead, which correctly finds and scrolls
// whichever ancestor is actually the scrolling container.
// Root cause #2 (confirmed on the LIVE published site, not just the
// customizer preview): any page rendered from its own JSON template (like
// this "homepage" page template) gets EVERY section's `section.id` prefixed
// by Shopify with `template--{numeric-id}__`, to keep ids unique across
// templates — so `id="MoHowItWorks-{{ section.id }}"` actually renders as
// `MoHowItWorks-template--21808670638220__custom_how_it_works_rLezhk`, with
// the prefix spliced into the MIDDLE of the id (between our own
// "MoHowItWorks-" prefix and the section key), not at the very start. A
// plain "ends with" check for the literal hash can never match that, since
// "MoHowItWorks-" can only ever appear once, at the true start of the id.
// Fixed below by stripping any "template--...__" segment from candidate ids
// before comparing, wherever in the id it happens to fall.
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;

  const hash = link.getAttribute('href');
  if (!hash || hash.length < 2) return;

  let idValue;
  try {
    idValue = decodeURIComponent(hash.slice(1));
  } catch (error) {
    idValue = hash.slice(1);
  }
  if (!idValue) return;

  let target = document.getElementById(idValue);
  if (!target) {
    const candidates = document.querySelectorAll('[id*="' + idValue.replace(/^.*?-/, '') + '"]');
    for (const candidate of candidates) {
      if (candidate.id.replace(/template--[^_]+__/, '') === idValue) {
        target = candidate;
        break;
      }
    }
  }
  if (!target) return;

  event.preventDefault();
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (window.history && window.history.pushState) {
    window.history.pushState(null, '', hash);
  }
});

// CUSTOM (fix): Horizon's own .page-wrapper becomes the real scrolling
// element (overflow-y: auto) at desktop widths (>=990px, see base.css),
// while window/body scrolls normally below that. A "scroll" listener on
// window alone never fires on desktop, so both scroll-driven behaviors
// below listen on both window and .page-wrapper — only whichever one is
// actually scrolling will ever dispatch the event. Shared here so the two
// behaviors don't each re-detect the scroll container separately.
const moHeaderScrollContainer = document.querySelector('.page-wrapper');
const getMoHeaderScrollY = () =>
  moHeaderScrollContainer ? moHeaderScrollContainer.scrollTop : window.scrollY;

(function initStickyOnScroll() {
  const headers = document.querySelectorAll('.mo-header[data-sticky="scroll-up"]');
  if (!headers.length) return;

  let lastY = getMoHeaderScrollY();
  const threshold = 8;

  const onScroll = () => {
    const currentY = getMoHeaderScrollY();
    const delta = currentY - lastY;

    if (Math.abs(delta) < threshold) return;

    headers.forEach((header) => {
      if (delta > 0 && currentY > header.offsetHeight) {
        header.classList.add('mo-header--hidden');
      } else {
        header.classList.remove('mo-header--hidden');
      }
    });

    lastY = currentY;
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  if (moHeaderScrollContainer) moHeaderScrollContainer.addEventListener('scroll', onScroll, { passive: true });
})();

(function initTransparentHeaderScroll() {
  // CUSTOM: powers the per-template "Transparent header" option. Adds
  // .mo-header--scrolled to any .mo-header--transparent instance once the
  // page has scrolled a bit, which is what custom.css uses to switch that
  // header from no background to its normal solid color. This class lives
  // directly on .mo-header (the same element .mo-header--hidden transforms
  // in scroll-up mode above), not on #header-group, so the fill always
  // hides/reveals together with the header itself.
  const headers = document.querySelectorAll('.mo-header--transparent');
  if (!headers.length) return;

  const scrolledThreshold = 4;

  const updateScrolledState = () => {
    const isScrolled = getMoHeaderScrollY() > scrolledThreshold;
    headers.forEach((header) => header.classList.toggle('mo-header--scrolled', isScrolled));
  };

  updateScrolledState();
  window.addEventListener('scroll', updateScrolledState, { passive: true });
  if (moHeaderScrollContainer) moHeaderScrollContainer.addEventListener('scroll', updateScrolledState, { passive: true });
})();

