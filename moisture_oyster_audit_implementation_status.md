# Moisture Oyster Design Audit — Implementation Status

Updated 2026-07-17. Tracks the 30-item designer audit against what's actually been changed in the repo. Full technical detail (exact CSS/values, file references) lives in `moisture_oyster_audit_checklist.xlsx`; this is the plain-language status view.

Files touched (not yet committed — see `git status`): `assets/mo-design-system.css`, `assets/custom.css`, `sections/custom-{about,clinical-science,eye-health,footer,main-product,range-grid,subscribe-benefits}.liquid`, `blocks/mo-pdp-{badge,rating-link}.liquid`, `snippets/mo-{product-card,review-card,variant-main-picker}.liquid`, `templates/{page.homepage,product}.json`.

A deploy attempt after the first pass surfaced 3 Liquid syntax errors (multi-line `{%- # -%}` comments need `#` on every line) — those are now fixed by converting to `{%- comment -%}` blocks. Not re-deployed/verified live since.

## Done (20 of 30)

1. Header nav — frosted-glass floating pill (backdrop-blur, radius 20px) added over the hero.
3. Button hover states — base button spec corrected (radius, color, type); no explicit hover spec existed in Figma so hover colors were left as previously set.
4. Button shape / "Coming soon" — radius changed from a pill to 10px site-wide; border removed from the disabled "Coming soon" button.
5. Stat cards — radius 16px, padding 20/30/30, 32px number-to-label gap, equal card height.
7. "How it works" heading sizes — were literally swapped in the CSS (64px/44px); corrected to 40px/64px.
9. "How it works" body text width — added a 383px max-width (previously unconstrained).
10. "Premium eye care" green cast — root cause was a 20%-opacity dark-green CSS scrim, not the photo; set to 0%.
11. Icon size — 28px → 40px across trust bar, factor icons, credential row, subscribe-benefit icons.
13. / 24. Review card typography — name/rating sizes, verified-subscriber text styling, card radius/padding all corrected to match Figma.
14. Footer columns — were missing font-family entirely (rendering in body font, not mono); added mono/uppercase, fixed header→list and link-to-link gaps.
16. PDP tag ("GLP Non-Irritant · OECD 492B") — resized from an 11px pill to a 10px, ~9px-radius chip matching Figma.
17. Quantity/purchase picker — border width, padding, number weight, badge padding all corrected.
19. Icon/circle stroke — standardized to 1px across accordion toggles and icon-card borders.
21. FUNCTION/EVIDENCE label — 11px → 14px (this one was a direct instruction in the original audit PDF, not a Figma lookup).
22. GLP Non-Irritant chart — full rebuild: bar track/fill colors, radius, width, threshold line/pill all matched to Figma.
23. 0.25% ingredient cards — radius, padding, bar-track styling corrected; a minor gap inconsistency in Figma itself was flagged rather than "fixed" arbitrarily.
25. FAQ text width — added a 672px max-width on the question text.
26. FAQ accordion toggle — resized 32px → 40px, border 1.5px → 1px.
27. "Why subscribers love it more" — icon size, icon-to-heading gap, heading-to-body gap, card padding/radius all corrected.
29. Sticky add-to-cart bar — reuses the main Add-to-Bag button, whose radius/padding now match the confirmed spec.

## Partially done / flagged (7 of 30)

2. Rating stars & typography (home) — star shape fixed (see #15 below); didn't find a separate homepage-specific typography mismatch to correct beyond that.
6. Card hover-flip — real CSS 3D flip built + a new `back_text` field added to product cards, but it's an approximation (no static "back" spec exists in Figma) and needs `back_text` filled in per card to show anything.
8. Heading hover interaction — left as the existing click/keyboard tab pattern rather than adding hover-switching, to avoid touching shared JS used elsewhere without a clear spec to justify the risk.
12. Review filter chips — left as-is; already reasonably styled, but no matching Figma layer was found to check the exact spec against.
15. PDP star "sharp corners" — root cause fixed (was rendering literal ★/☆ Unicode glyphs, swapped for the shared sharp SVG star), which should resolve the visual complaint.
20. Ingredient tabs / number badge — genuinely unresolved. No Figma layer and no PDF-stated target values for this one; left untouched pending designer input.
28. Remove eye-photo review — not removed. All three reviews on the page share the same base image filename pattern, so I couldn't tell which one is "the" eye photo without guessing — needs Kalvis to confirm which entry.

## Not started / blocked (3 of 30)

18. PDP top padding — no distinct spacer or padding source could be identified with confidence; needs live-site inspection to find the actual element responsible.
30. Product gallery photo cropping — blocked on final images from the designer, as originally noted.
(20 above is effectively also "not started" — listed under flagged since it was actively investigated, not skipped.)

## Suggested next steps

- Re-deploy and confirm the 3 Liquid syntax fixes clear validation.
- Live/preview review of the header nav pill and card hover-flip specifically — both involve new markup/behavior, not just value tweaks.
- Kalvis input needed on: #20 (ingredient tabs/badge sizing), #28 (which review photo to remove), #18 (top padding source).
