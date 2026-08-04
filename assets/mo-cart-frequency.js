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

      // CUSTOM FIX (2026-08-04, QA report — "error in the cart drawer on a
      // 1-bottle subscription"): changing a line's selling plan does NOT edit
      // the existing line in place. Shopify removes it and writes a NEW line,
      // and a cart line key is `<variantId>:<hash-of-line-properties>` — the
      // selling plan is part of that hash, so the key changes on every
      // frequency change. Nothing here used to write the new key back into the
      // DOM, which broke the whole line after the FIRST change:
      //   - a SECOND frequency change posted the dead key and failed outright
      //     ("Could not update delivery frequency. Please try again." — the
      //     visible error in the QA report), and
      //   - Horizon's own quantity +/- and remove controls broke too: they
      //     resolve a line via `cartItemRows[line - 1].dataset.key` (see
      //     assets/component-cart-items.js), which was still the dead key.
      // Reproduced deterministically on production 2026-08-04 (change once =
      // OK, change again = error, cart unchanged).
      //
      // Fix: pull the replacement key out of the change.js response (it
      // returns the full cart) and write it back to BOTH holders of the key —
      // this wrapper's data-line-key and the row's data-key that Horizon
      // reads. Matched on variant + the plan we just applied, which is exact
      // even when the same variant sits on the line more than once under
      // different plans. Deliberately still no section re-render (per Kalvis,
      // price is flat across frequencies, so nothing else in the UI moves) —
      // this only re-points the identifiers at the line that now exists.
      const variantId = String(lineKey).split(':')[0];
      const newLine = Array.isArray(data?.items)
        ? data.items.find(
            (item) =>
              String(item?.variant_id) === variantId &&
              String(item?.selling_plan_allocation?.selling_plan?.id) === String(newPlanId)
          )
        : null;

      if (newLine?.key && newLine.key !== lineKey) {
        wrapper.dataset.lineKey = newLine.key;

        const row = wrapper.closest('[data-key]');
        if (row instanceof HTMLElement) {
          row.dataset.key = newLine.key;
          if (row.id) row.id = `CartItem-${newLine.key}`;
        }

        // Any child line (a bundled/added-on item) points back at its parent
        // by key as well — repoint those too so they aren't orphaned.
        document.querySelectorAll(`[data-parent-key="${lineKey}"]`).forEach((child) => {
          if (child instanceof HTMLElement) child.dataset.parentKey = newLine.key;
        });
      }
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
