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
 *  - "Scrolled" corner-radius/fill toggle: adds .mo-header-group--scrolled
 *    to #header-group once the page has scrolled down a bit. The header
 *    sits flush (square corners) at the true top of the page, and only
 *    gains its rounded bottom corners + fill color (see custom.css) once
 *    scrolled — runs unconditionally, independent of sticky mode.
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

(function initScrolledCornerFill() {
  const headerGroup = document.getElementById('header-group');
  if (!headerGroup || !headerGroup.querySelector('.mo-header')) return;

  // CUSTOM (fix, round 7): inverted from the original "only fill at the
  // true top" behavior. At the very top, the header sits flush against the
  // first section with square corners (no radius, so there's no cutout to
  // ever show a mismatched color). Only once scrolled down a bit does the
  // radius + fill turn on, avoiding any color-mismatch seam at scrollY 0
  // entirely, rather than trying to make the fill color match whatever's
  // behind at the top (which was never fully reliable across content).
  // Threshold is a bit larger than a bare "at top" check to comfortably
  // clear iOS Safari's elastic overscroll/bounce.
  const scrolledThreshold = 12;

  const updateScrolledState = () => {
    headerGroup.classList.toggle('mo-header-group--scrolled', getMoHeaderScrollY() > scrolledThreshold);
  };

  updateScrolledState();
  window.addEventListener('scroll', updateScrolledState, { passive: true });
  if (moHeaderScrollContainer) moHeaderScrollContainer.addEventListener('scroll', updateScrolledState, { passive: true });
})();
