// CUSTOM (2026-07-29, per Kalvis): lets a shopper change delivery frequency
// for an already-added subscription line straight from the cart drawer/page,
// via the .mo-cart-frequency__select rendered in snippets/cart-products.liquid
// (only present when a line's variant has more than one selling plan option —
// a single option still renders as static text, no dropdown).
//
// Deliberately NOT built as an extension of Horizon's own CartItemsComponent
// (assets/component-cart-items.js) — that's a Horizon-owned file we don't
// touch directly (see this project's upstream-safe convention). Instead this
// talks to the same cart/change.js endpoint Horizon's own component uses
// (Theme.routes.cart_change_url, the same global every other cart script in
// this theme already reads — see snippets/scripts.liquid), but keeps its own
// tiny, self-contained update flow.
//
// Per Kalvis: subscription price is flat across every frequency option for
// this store, so a plan change never needs to update anything else in the
// cart UI (price, subtotal, etc.) — this only needs to persist the new plan
// to the line so it carries through to checkout. That's why there's no
// section re-render/morph here, unlike Horizon's own quantity-change flow.
//
// Event delegation on `document` (not direct listeners on the <select>
// elements) since the cart drawer's markup can be replaced wholesale by
// Horizon's own cart update flow (e.g. after a quantity change elsewhere in
// the cart) — delegation means this keeps working after a re-render without
// needing to re-bind anything.
document.addEventListener('change', (event) => {
  const select = /** @type {HTMLElement} */ (event.target)?.closest?.('[data-role="mo-cart-frequency-select"]');
  if (!(select instanceof HTMLSelectElement)) return;

  const wrapper = select.closest('[data-mo-cart-frequency]');
  const lineKey = wrapper instanceof HTMLElement ? wrapper.dataset.lineKey : null;
  if (!lineKey) return;

  const errorEl = wrapper.querySelector('[data-role="mo-cart-frequency-error"]');
  const newPlanId = select.value;
  // Remember the value that was actually persisted last, not just "whatever
  // the select showed a moment ago" — if a previous change already failed
  // and got reverted, dataset.appliedValue is the source of truth to roll
  // back to on a second failure.
  const previousValue = select.dataset.appliedValue || newPlanId;

  if (errorEl instanceof HTMLElement) {
    errorEl.hidden = true;
    errorEl.textContent = '';
  }
  select.disabled = true;

  fetch(Theme.routes.cart_change_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ id: lineKey, selling_plan: Number(newPlanId) }),
  })
    .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
    .then(({ ok, data }) => {
      if (!ok || data?.errors || data?.status === 422) {
        const message =
          typeof data?.errors === 'string'
            ? data.errors
            : typeof data?.description === 'string'
              ? data.description
              : 'Could not update delivery frequency. Please try again.';
        throw new Error(message);
      }

      select.dataset.appliedValue = newPlanId;
    })
    .catch((error) => {
      console.error('[mo-cart-frequency] Failed to update selling plan:', error);
      select.value = previousValue;

      if (errorEl instanceof HTMLElement) {
        errorEl.textContent = 'Could not update delivery frequency. Please try again.';
        errorEl.hidden = false;
      }
    })
    .finally(() => {
      select.disabled = false;
    });
});
