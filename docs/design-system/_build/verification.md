Run on 8 November 2026 after the last build:

| Check | Command | Result |
|---|---|---|
| Mocks gate | `python3 .claude/skills/writing-html-mocks/scripts/check_mocks.py docs/mocks` | 29 screens, 154 mocks, 0 errors, 0 warnings (before and after the mocks were pointed at this system) |
| Contrast, both themes | `python3 .claude/skills/extracting-design-systems/scripts/check_contrast.py docs/design-system/tokens/tokens.css` | 179 pairs passed, 0 failed |
| Structure | `python3 .claude/skills/extracting-design-systems/scripts/check_design_system.py docs/design-system` | 71 pages (50 components, 12 foundations, 8 patterns, index), 0 errors, 0 warnings |
| Token coverage | parse `tokens.css` and every `data-token` on `foundations/*.html` | 243 tokens, each on exactly one foundation page |
| DTCG export | `tokens_to_json.py docs/design-system/tokens/tokens.css` | `tokens/tokens.json`, 325 entries |
| Reflow and live contrast | Playwright, every page at 360 px in light and dark | No page wider than the viewport; no live contrast badge failing; no console errors |
| Screenshots | index, color, button, dialog, text field, toast at 360 and 1280 px, both themes; mocks dashboard, new direction (invalid), delete-project sheet, projects, settings, sign-in, pipeline, stacked toasts at 375 and 1280 px | Reviewed. Fixed during review: unwrapped key tables overflowing at 360 px, documentation lists losing bullets under the component reset, the phone nav opening the 50-item component group above the content. |

Known gaps, deliberately left open:

- Inter and JetBrains Mono are named but not bundled (the mocks never loaded them either); the system font stack renders until the app ships the fonts.
- Menu, checkbox, switch, tooltip, pagination and chip are core-set components no mock uses yet. Their pages are marked as such, and the places they belong are named.
- The drift entries below describe fixes for the mocks and the product; the mock generator has not been changed except for its stylesheet links.
- L2-046 AC4 asks for 44×44 px targets at every width; the system uses 32–40 px controls from lg (above the WCAG 2.5.8 24 px minimum). The requirement or the system needs a decision.
