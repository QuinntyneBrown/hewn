# 0003. Mission Control loads the design system's CSS and keeps the mocks' markup

Date: 2026-11-08 · Status: Accepted · Requirements: L2-046, L2-047, L2-048

## Context

`docs/mocks` are the source of truth for the UI and the visual tests compare the app with them region by
region. Copying the styles into the Angular workspace would let the two drift.

## Decision

- `angular.json` loads `docs/design-system/tokens/tokens.css` and `docs/design-system/assets/components.css`
  directly. A style fix goes into the design system first and so reaches the mocks and the app together.
- `hw-*` components keep the mocks' class names and DOM shape. Where the design system uses sibling or child
  selectors (for example `.callout + *` and `.callout > .icon`), the component's host is the styled element
  itself: `hw-field` is the `.field`, `hw-error-summary` is the `.callout.form-summary`, and icons are
  attribute components on the `svg` (`<svg hw-icon name="plus">`). Components never wrap styled elements in
  extra boxes.

## Consequences

Selectors such as `svg[hw-icon]` need an angular-eslint exception at their declaration. Visual tests stay
simple: app and mock render with the same CSS in the same browser, so a small pixel tolerance (2%) is enough.
