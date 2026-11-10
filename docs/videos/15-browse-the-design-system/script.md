# 15 · Browse the design system

This is journey fifteen of Hewn, the software factory: browse the design system. Stage three extracts a design system from the exported mocks, with tokens for colour, type, spacing, radius, elevation and motion, and a page for every component. Owners and Viewers want to look through it without leaving Mission Control, in light and in dark. This video walks through how it was built: the design system endpoint, the token pages stage three now writes, the tab that reuses journey fourteen's sandboxed preview, and the tests.

## The goal

A user opens a project's Design system and sees its token pages under Foundations and its component pages under Components. Choosing one opens it in the same sandboxed preview as Designs, served from the separate preview origin, at any width from X S to X L, in light or dark.

## The flow

Here is the flow. The tab asks the API for the design system. The API reads tokens dot json at the head of the default branch, lists the token and component pages at that same commit, and signs one preview link for it. The frame then loads each page from the preview host that journey fourteen built, in the same sandbox.

## The components

The new pieces sit beside the old ones. A design system component and a design system handler are new; the sandboxed preview, the preview tokens and the preview host are reused unchanged, and the width and theme controls moved into a small component that both tabs share.

## Listing the pages

Stage three writes no manifest, so the folders are the list. A project has a design system once tokens dot json exists at the head. The handler reads it, then lists the files under foundations and components at the commit it was read at, so one signed token covers every page and its links. If the tokens can't be parsed, or GitHub can't list the folders, the answer is a five oh two that names the commit.

Token pages come in the order of the token groups, colour first, each with its group's token count. Colour has light and dark values, so it counts one theme and says light and dark.

## The token pages

The token pages come from stage three itself. Its task now asks for a page per token group under foundations, following the html element's data theme attribute as the mocks do. The scripted agent the tests and videos use writes them from the tokens it extracted, with the dark values under data theme dark.

## The tab

In Mission Control, the tab shows the page's title with its token count, the shared width and theme controls, and the same sandboxed preview component as Designs. The caption says it was served from the preview origin in the same sandboxed frame, at what width, and from which path.

## Served from the preview origin

Here is what the preview host answers for the colour page in dark. A sandbox content security policy, no sniffing, no referrer, a short private cache, and no cookie at all. The page runs in an opaque origin on another host name, so it can't reach Mission Control's cookies or storage.

## Tests

The backend tests came first, and failed with not found: there was no route. Six tests now cover the listing in the token order, the token counts, both kinds of page opening in the same sandbox with their own links, a project before stage three, unreadable tokens, and Viewers.

End to end, a test checks the frame's source is on the preview origin and sandboxed, reads the theme and background inside the real frame as it switches from light to dark, then opens a component page that keeps the theme and the width.

All green, the backend has two hundred and twenty eight tests, the worker one hundred and forty four, and the frontend four new view tests. End to end, there are twelve new tests: four for behaviour, four visual comparisons with the mocks, and four accessibility checks.

## The screens

Here is Kiln Booking, after a real worker ran stages zero to three. Its Design system tab lists six token pages and the button. Typography, spacing, then colour, in dark, then the button, back to light, and phone width.

The colour tokens in light, then in dark, where every swatch takes its dark value from the tokens. The button in dark, then in light, with the accent colour following the theme.

The tab works in Mission Control's dark mode and on a phone. A project before stage three says it has no design system yet, while unreadable tokens name their commit, with try again.

## Recap

Journey fifteen is complete. The design system tab lists token and component pages from the folders stage three wrote, with token counts from tokens dot json. Every page opens in the same signed, sandboxed preview as Designs, on its own origin. And light and dark, and every width, work just as they do for the mocks. Next comes journey sixteen.
