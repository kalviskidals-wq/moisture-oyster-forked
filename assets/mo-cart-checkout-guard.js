// CUSTOM (2026-08-04, per Kalvis — QA report from a client on an iPhone):
// "sometimes checkout doesn't respond on the first tap, and once it wanted to
// download something."
//
// The screenshot showed Safari offering to download a file literally named
// "cart" at "Zero KB of ?". That names the bug precisely:
//
//   - The cart drawer's CHECK OUT button is a plain `<button type="submit"
//     name="checkout" form="cart-form">` (snippets/cart-summary.liquid), so
//     tapping it does a native POST to /cart, which Shopify answers with a 302
//     to /checkouts/... A 302 has an EMPTY body, and Safari derives a download
//     filename from the request path — hence "cart", zero bytes.
//   - Verified against production (2026-08-04): POST /cart returns a redirect
//     for every body shape we could construct (with/without updates[], with
//     the checkout param, with an XHR header). The server is not returning
//     anything downloadable, and GET /cart is a normal 200 text/html with no
//     Content-Disposition. So the response is fine — Safari decided the
//     navigation was a download BEFORE it saw it.
//
// That is what iOS Safari does when a second navigation is started while one
// is already pending: the first submission wins the navigation, the second one
// has nowhere to go and degrades into a download of the raw response. Which
// means the download and the "dead first tap" are the SAME bug seen from two
// ends — the button gives no feedback at all while the POST + redirect + a
// cold checkout page load are in flight (seconds on mobile data), so shoppers
// reasonably assume the tap missed and tap again. Sometimes the second tap
// just lands harmlessly; sometimes it produces the download prompt.
//
// Fix: make the first tap visibly do something, and make every tap after it a
// no-op until the browser actually leaves the page.
//
// Deliberately NOT using `button.disabled`: the submitter's own name/value
// ("checkout") is what tells Shopify to go to checkout rather than just
// recalculate the cart, and a disabled control is barred from being a
// submitter. Blocking at the event level instead keeps the first, real
// submission completely untouched.
//
// Event delegation on `document` because the drawer's markup is morphed
// wholesale by Horizon's cart update flow (assets/component-cart-items.js),
// so anything bound directly to the button would be lost on the next re-render.
//
// UPSTREAM risk LOW — net-new file, no Horizon JS touched.

(function () {
  // snippets/cart-products.liquid renders in both the drawer and the cart
  // page, so this tag can be evaluated more than once on a single document.
  if (window.__moCartCheckoutGuard) return;
  window.__moCartCheckoutGuard = true;

  var SAFETY_RELEASE_MS = 12000;

  /** @type {WeakSet<HTMLFormElement>} */
  var submitting = new WeakSet();
  var releaseTimer = null;

  // Every form on the storefront whose submit causes a real NAVIGATION, and so
  // can be double-submitted into the download bug described above:
  //
  //   - the cart drawer / cart page form (POST /cart with `checkout`)
  //   - CUSTOM (2026-08-04): the product form when
  //     settings.skip_cart_to_checkout is on. That setting withholds
  //     `on:submit="/handleSubmit"` so the form submits natively straight to
  //     checkout (see blocks/buy-buttons.liquid), which puts Add to Bag in
  //     exactly the same position CHECK OUT was in — a slow navigation with no
  //     feedback, inviting a second tap. The hidden `return_to` input is what
  //     marks that mode; with the setting off, the product form is intercepted
  //     by Horizon and never navigates, so it must NOT be guarded (that would
  //     break adding a second item).
  var GUARDED = 'form.cart-form, form#cart-form, form[action*="/cart/add"]:has(input[name="return_to"])';

  function isGuarded(form) {
    // :has() is supported everywhere this theme targets, but fall back to an
    // explicit lookup rather than throwing if a browser rejects the selector.
    try {
      return form.matches(GUARDED);
    } catch (error) {
      return (
        form.id === 'cart-form' ||
        form.classList.contains('cart-form') ||
        !!form.querySelector('input[name="return_to"]')
      );
    }
  }

  function guardedForms() {
    try {
      return document.querySelectorAll(GUARDED);
    } catch (error) {
      return document.querySelectorAll('form.cart-form, form#cart-form');
    }
  }

  // The control that should show the busy state for a given form: CHECK OUT in
  // the cart, Add to Bag on the product form. Iterates form.elements rather
  // than querySelectorAll because the cart's CHECK OUT button is not a
  // DESCENDANT of #cart-form — it's associated to it by `form="cart-form"`
  // (snippets/cart-summary.liquid). form.elements includes controls adopted
  // that way; a descendant query would miss it entirely.
  function busyTargets(form) {
    return Array.prototype.filter.call(form.elements, function (el) {
      return el.name === 'checkout' || el.name === 'add' || el.getAttribute('ref') === 'addToCartButton';
    });
  }

  function setBusy(form, isBusy) {
    busyTargets(form).forEach(function (button) {
      if (!(button instanceof HTMLElement)) return;
      button.setAttribute('aria-busy', isBusy ? 'true' : 'false');
      // Inline styles rather than a class: these buttons are rendered by
      // Horizon snippets we don't own, and their stylesheets live in those same
      // snippets — a custom class would need an edit there to mean anything.
      button.style.opacity = isBusy ? '0.65' : '';
      button.style.cursor = isBusy ? 'progress' : '';
    });
  }

  function release() {
    if (releaseTimer) {
      clearTimeout(releaseTimer);
      releaseTimer = null;
    }
    guardedForms().forEach(function (form) {
      submitting.delete(form);
      setBusy(form, false);
    });
  }

  document.addEventListener(
    'submit',
    function (event) {
      var form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (!isGuarded(form)) return;

      if (submitting.has(form)) {
        // A navigation for this form is already under way. Swallowing this one
        // is what prevents Safari from turning it into a "cart" download.
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      submitting.add(form);
      setBusy(form, true);

      // If the navigation never happens (offline, a handler cancelled it, the
      // shopper dismissed something), don't strand the button as permanently
      // dead — let it be tappable again after a beat.
      releaseTimer = setTimeout(release, SAFETY_RELEASE_MS);
    },
    true
  );

  // Coming back from checkout on iOS restores this page from the back/forward
  // cache with its JS state frozen exactly as it was left — including the busy
  // flag. Without this, "back" from checkout would leave CHECK OUT dimmed and
  // unresponsive, which is a worse bug than the one being fixed.
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) release();
  });
})();
