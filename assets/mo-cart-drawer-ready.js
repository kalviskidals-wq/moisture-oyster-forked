// CUSTOM (2026-08-04, per Kalvis — QA report: "the first tap on CHECK OUT in
// the cart drawer does nothing, it only works on the second tap").
//
// Root cause, measured on production 2026-08-04 (empty cart, tap Add to Bag,
// MutationObserver timeline — MutationObserver rather than rAF/setInterval
// because those are throttled in a background tab):
//
//     t=0ms      Add to Bag tapped
//     t=1516ms   theme-drawer#cart-drawer gains [open] — the drawer becomes
//                visible, and at that instant the drawer is STILL showing its
//                empty-cart state: there is no CHECK OUT button in the DOM
//     t=1531ms   the cart section morph lands and inserts the CHECK OUT button
//
// So the drawer is revealed BEFORE the thing the shopper is about to tap
// exists. On desktop that gap was 15ms and invisible. On a phone on mobile
// data it's the whole cart-section render round-trip, and the drawer is
// sliding in during it — so the button materialises under a finger that is
// already moving. iOS won't deliver a tap to an element that wasn't
// hit-testable when the touch began, so the first tap is simply lost. The
// second tap works because by then the button is really there.
//
// That also explains the two things that narrowed it down: nothing dims on the
// failed tap (no submit event fires at all — see mo-cart-checkout-guard.js,
// which would have dimmed the button), and it is ONLY the CHECK OUT button
// that needs two taps. The quantity +/-, the trash button and the delivery
// frequency dropdown all live in the cart-items area and are bound via
// Horizon's declarative `on:click` handlers on elements that already exist;
// CHECK OUT is the one control that is absent from the empty-cart state
// entirely, so it is the only one that can appear late.
//
// Why the race exists: assets/cart-drawer.js opens the drawer from a callback
// on the cartLinesUpdate promise, and assets/component-cart-items.js morphs
// the cart content from a callback on that SAME promise. cart-drawer-component
// is the outer element so it upgrades (and therefore registers) first, and
// `morphSection` is awaited — so the open always wins and the content always
// arrives after.
//
// Fix: sequence them. Wrap the cart drawer's own `open()` so that, when a cart
// ADD is in flight and the drawer has no CHECK OUT button yet, the reveal
// waits for the section morph to deliver one. Patched on the element INSTANCE,
// not on Horizon's class or its file — assets/cart-drawer.js and
// assets/theme-drawer.js are untouched, per this project's don't-edit-Horizon-JS
// convention. Every other path (opening the drawer from the cart icon, opening
// it when the cart already has items and the button is already rendered) hits
// the `return openNow()` fast path and behaves exactly as before.
//
// UPSTREAM risk LOW — net-new file, no Horizon file modified.

(function () {
  // snippets/cart-products.liquid renders in both the drawer and the cart
  // page, so this tag can be evaluated more than once on a single document.
  if (window.__moCartDrawerReady) return;
  window.__moCartDrawerReady = true;

  // Ceiling on how long the reveal may be held. If the add fails, or the
  // response carries no cart section to morph, no CHECK OUT button will ever
  // arrive — the drawer must still open rather than silently never appearing.
  // Also doubles as the window in which an add counts as "in flight".
  var MAX_WAIT_MS = 2000;

  var addInFlight = false;
  var addFlagTimer = null;

  // Capture phase: assets/cart-drawer.js listens for this same event in the
  // bubble phase, so capturing guarantees the flag is already set by the time
  // its handler decides whether to open the drawer immediately.
  document.addEventListener(
    'shopify:cart:lines-update',
    function (event) {
      if (event.action !== 'add') return;

      addInFlight = true;
      clearTimeout(addFlagTimer);
      addFlagTimer = setTimeout(function () {
        addInFlight = false;
      }, MAX_WAIT_MS);
    },
    true
  );

  function hasCheckoutButton(drawer) {
    return !!drawer.querySelector('button[name="checkout"]');
  }

  function patch(drawer) {
    if (drawer.__moOpenSequenced) return;
    drawer.__moOpenSequenced = true;

    var openNow = drawer.open.bind(drawer);

    // Shadows the prototype method with an own property. Safe: nothing reads
    // `.open` on <theme-drawer> as a boolean — Horizon uses the `isOpen`
    // getter and hasAttribute('open') for that.
    drawer.open = function () {
      // Not an add, or the button is already on screen from a previous
      // render: nothing to wait for.
      if (!addInFlight || hasCheckoutButton(drawer)) return openNow();

      var settled = false;
      var timer = null;

      var reveal = function () {
        if (settled) return;
        settled = true;
        observer.disconnect();
        clearTimeout(timer);
        openNow();
      };

      var observer = new MutationObserver(function () {
        if (hasCheckoutButton(drawer)) reveal();
      });

      observer.observe(drawer, { childList: true, subtree: true });
      timer = setTimeout(reveal, MAX_WAIT_MS);

      // The morph can land between the check above and observe() being wired
      // up; without this re-check that button insertion would go unnoticed and
      // the drawer would sit closed until the timeout.
      if (hasCheckoutButton(drawer)) reveal();
    };
  }

  customElements.whenDefined('theme-drawer').then(function () {
    var drawer = document.querySelector('theme-drawer#cart-drawer');
    if (drawer) patch(drawer);
  });
})();
