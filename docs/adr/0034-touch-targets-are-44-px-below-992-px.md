# 0034. Touch targets are 44 px below 992 px

- **Status:** Accepted
- **Date:** 2026-11-11
- **Requirements:** L2-046

## Context

L2-046 AC4 asked for 44×44 px touch targets at every width. The design system gives nav links, tabs and icon
actions 44 px below lg, but buttons, inputs and selects were 32 px (small) and 40 px (medium) at every width, and the
mocks are drawn with those sizes at desktop widths. Journey 33's sweep found 66 controls under 44 px at 375 and
768 px.

## Decision

- Below 992 px, `--control-height-sm` and `--control-height-md` are 44 px (`2.75rem`), and a tab is at least 44 px
  wide. From 992 px they return to 32 and 40 px.
- L2-046 AC4 reads: touch targets are at least 44×44 px below 992 px and at least 24×24 px from 992 px (WCAG 2.2
  2.5.8, Target Size (Minimum)).
- An acceptance test measures every visible control on every page at 375, 768 and 1280 px.

## Alternatives

- **44 px at every width.** Every desktop row, table and toolbar grows by a quarter, the mocks no longer match the
  product at 1280 px, and a mouse needs no such target.
- **Drop the 44 px rule.** 24 px meets WCAG AA, but phones and tablets are where a finger is the pointer, and the
  design system already promised 44 px there.
- **Size by `pointer: coarse` instead of width.** A touch laptop at 1280 px would change layout under the mocks, and
  the tests couldn't hold one width to one size.

## Consequences

- Phone and tablet layouts are a little taller; the mocks show the same, because they read the same tokens.
- A new control that sets its own height must use the control height tokens, or the sweep fails below 992 px.
