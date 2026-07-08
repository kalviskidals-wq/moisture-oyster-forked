# Shopify Card-Style Variant + Subscription Picker — Reusable Pattern

A pattern for replacing Shopify's default variant picker with a card-based UI that separates quantity selection from purchase type (subscribe vs. one-time), designed for products with Seal Subscriptions or any native selling-plan app.

---

## When to use this pattern

- Product has multiple variants (pack sizes, bundles, tiers)
- Product is available as both one-time purchase and subscription
- You want a visually rich card UI instead of dropdowns or button pills
- Subscribe should be pre-selected on page load
- Prices should update dynamically when the user switches variants

---

## File structure

Two files are involved:

```
blocks/
  variant-picker.liquid       ← thin wrapper block; holds schema settings
snippets/
  variant-main-picker.liquid  ← all rendering, CSS, JS lives here
```

The block renders the snippet, passing `block` so settings are accessible:

```liquid
{% render 'variant-main-picker',
  product_resource: product_resource,
  section: section,
  product: product,
  block: block
%}
```

**Critical:** `block: block` must be passed explicitly. Without it, `block.settings` is empty in the snippet and all schema controls do nothing.

---

## Architecture — two independent pickers

### Picker 1: Quantity
- Loops `product.variants` — one card per variant
- Each card is a `<label>` wrapping a hidden `<input type="radio">`
- Radio `name` is namespaced to the section ID: `mo-qty-{section.id}`
- The first variant with a selling plan allocation is pre-selected (not `forloop.first`)
- Selling plan allocation prices are pre-serialised into a `data-allocations` JSON attribute on each radio — avoids any fetch calls on card switch

### Picker 2: Purchase option
- Always exactly two cards: Subscribe + One-Time
- Separate radio group: `mo-purchase-{section.id}`
- Subscribe is hardcoded `checked` in Liquid (pre-selected on load)
- Subscribe price = `variant.selling_plan_allocations.first.price` (Liquid render)
- One-time price = `variant.price`
- A "Deliver Every" info row below reads `selling_plan.description` from Liquid; hidden if no selling plan exists

---

## Data flow

```
Page load
  └── Liquid renders initial state (first variant with selling plan, subscribe mode)
  └── JS applyState() fires immediately
      ├── writes input[name="id"] = variantId
      └── writes input[name="selling_plan"] = sellingPlanId

User picks different quantity card
  ├── JS reads data-allocations from that radio
  ├── Resolves subscribe price for new variant
  ├── Updates price elements in DOM
  └── Calls writeFormValues() with new variantId + selling plan

User switches to One-Time
  ├── selectedMode = 'onetime'
  ├── writeFormValues(variantId, null)  ← clears selling_plan input
  └── No price update needed (one-time price already in DOM)
```

### Writing to the product form

The snippet doesn't receive `product_form_id` — it searches for the form:

```js
function getForm() {
  var shopifySection = document.getElementById('shopify-section-' + sectionId);
  if (shopifySection) {
    var f = shopifySection.querySelector('form[action*="/cart/add"]');
    if (f) return f;
  }
  return document.querySelector('form[action*="/cart/add"]');
}
```

Two inputs are written:
- `input[name="id"]` — the variant ID
- `input[name="selling_plan"]` — the selling plan ID, or `''` to clear it

The selling plan input is created if it doesn't exist (for themes that don't inject it by default). Setting it to `''` (not removing it) is the correct way to indicate one-time purchase to Shopify.

---

## Selling plan allocation prices — the data attribute trick

Shopify's serialised variant JSON (`product.variants | json`) does NOT include selling plan allocation prices. To avoid a fetch call on variant switch, prices are pre-rendered in Liquid into a `data-allocations` attribute:

```liquid
{%- liquid
  assign allocs_json = '['
  for alloc in variant.selling_plan_allocations
    unless forloop.first
      assign allocs_json = allocs_json | append: ','
    endunless
    assign allocs_json = allocs_json | append: '{"selling_plan_id":' | append: alloc.selling_plan.id | append: ',"price":' | append: alloc.price | append: '}'
  endfor
  assign allocs_json = allocs_json | append: ']'
-%}

<input ... data-allocations='{{ allocs_json }}'>
```

JS reads this on variant change:
```js
function getFirstAlloc(variantId) {
  var radio = picker.querySelector('input[data-variant-id="' + variantId + '"]');
  var allocs = JSON.parse(radio.dataset.allocations || '[]');
  return allocs[0] || null;
}
```

---

## Color theming — CSS custom property injection pattern

`{% stylesheet %}` blocks in Shopify are deduplicated — you cannot scope them per-section with `{{ section.id }}`. Instead, CSS custom properties are injected via an inline `style` attribute on the root element, then consumed in the stylesheet block.

```liquid
{%- liquid
  assign card_bg_active = bs.card_bg_active | default: '#093d24'
  {# ... more color assignments ... #}
-%}

<div class="mo-vpicker"
  style="
    --mo-card-bg-active: {{ card_bg_active }};
    --mo-card-text-active: {{ card_text_active }};
    {# ... etc ... #}
  "
>
```

```css
/* In {% stylesheet %} — reads the vars set above */
.mo-vpicker__card.is-selected {
  background: var(--mo-card-bg-active, #093d24);
  color: var(--mo-card-text-active, #ffffff);
}
```

**Rule:** always provide a hardcoded fallback value in the `var()` call. This ensures the component looks correct even before the merchant has set any values in the editor.

The block schema exposes these as `"type": "color"` fields. The Liquid assigns `bs.field_name | default: '#fallback'` to handle the case where a merchant hasn't set a value yet.

---

## Metafields schema (namespace: `custom`)

Set these on variants in the Shopify admin (Settings → Custom Data → Variants):

| Metafield key | Type | Example value | Used for |
|---|---|---|---|
| `subtitle` | Single line text | `SAVE 15%` / `1 BOTTLE` | Second line under variant title |
| `badge_label` | Single line text | `BEST VALUE` / `POPULAR` | Right-aligned pill badge on card |
| `first_purchase_discount` | Single line text | `44%` | Subtitle on subscribe card |
| `recurring_discount` | Single line text | `15%` | "SAVE X%" badge on subscribe card |

Metafields are read in Liquid at render time. They are not available in the serialised `product.variants | json`, so any metafield-driven content (badge text, discount labels) is server-rendered and does not update dynamically on variant switch. This is acceptable when discounts are consistent across variants; if they differ per variant, a separate data blob or fetch is required.

---

## Block schema settings

### Labels (type: text)
```json
{ "id": "quantity_label",  "default": "QUANTITY" },
{ "id": "purchase_label",  "default": "PURCHASE OPTION" },
{ "id": "subscribe_title", "default": "Subscribe &" },
{ "id": "onetime_title",   "default": "One-Time Purchase" },
{ "id": "deliver_prefix",  "default": "DELIVER EVERY" }
```

### Colors (type: color)
```json
{ "id": "card_bg_inactive",    "default": "#ffffff"   },
{ "id": "card_border_inactive","default": "#e8e6df"   },
{ "id": "card_bg_active",      "default": "#093d24"   },
{ "id": "card_border_active",  "default": "#093d24"   },
{ "id": "card_text_active",    "default": "#ffffff"   },
{ "id": "bubble_bg",           "default": "#ffd5f7"   },
{ "id": "badge_save_bg",       "default": "#1fa567"   },
{ "id": "badge_save_text",     "default": "#b8f3d8"   },
{ "id": "badge_value_bg",      "default": "#ffffff"   },
{ "id": "badge_value_text",    "default": "#0d1b14"   },
{ "id": "badge_value_border",  "default": "#c4c1ba"   }
```

---

## CSS patterns worth keeping

### Radio circle that can't get squished
```css
.mo-vpicker__radio-visual {
  flex-shrink: 0;
  flex-grow: 0;
  width: 24px;
  height: 24px;
  min-width: 24px;           /* belt-and-suspenders for flex edge cases */
  margin-inline-end: 4px;    /* explicit spacing on top of flex gap */
}
```
`gap` alone on the parent is not reliable enough when the circle has a fixed size and siblings compete for space. The `margin-inline-end` forces the gap from the circle's side directly.

### Checkmark via SVG data URI
CSS custom properties cannot be used inside `url()` data URIs. The checkmark colour is hardcoded in the SVG string. If you need a different colour, URL-encode the hex without the `#`:

```css
background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 10'%3E%3Cpath d='M1 5l3.5 3.5L11 1' stroke='%23093d24' stroke-width='2.2' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
```

`%23` = `#`. Change `093d24` to your target colour (no `#`).

### Card selection state — single class toggle
All visual state lives on the `.is-selected` class. JS adds/removes it; CSS handles every visual change (background, text colour, border, radio circle fill, checkmark visibility, badge colour). No JS style manipulation.

```js
function selectCard(card) {
  var group = card.dataset.card; // 'qty' or 'purchase'
  picker.querySelectorAll('.mo-vpicker__card[data-card="' + group + '"]')
    .forEach(function (c) { c.classList.remove('is-selected'); });
  card.classList.add('is-selected');
}
```

### Two independent fieldsets, one JS state object
The qty and purchase pickers use separate `name` attributes so the browser handles mutual exclusion within each group independently. JS tracks `selectedVariantId` and `selectedMode` as two separate state variables and combines them in `applyState()`.

---

## Horizon-specific gotchas

- **`{% stylesheet %}` is deduplicated** — never scope with `{{ section.id }}`. Use CSS custom properties on the root element instead.
- **`block.settings` requires `block: block` in the render call** — this is often forgotten.
- **Selling plan description is not in variant JSON** — always read it from Liquid at render time; it rarely changes across variants so static rendering is acceptable.
- **Do not touch `input[name="selling_plan"]` on page load if Seal Subscriptions is active** — Seal initialises its own input ~600ms after DOM ready. Writing to it on load may get overwritten. Write only on user-initiated card changes; let Seal own the initial state.
- **`--color-white-rgb`** — this Horizon token may not exist in all themes. Test before using; fall back to `255 255 255` directly.
