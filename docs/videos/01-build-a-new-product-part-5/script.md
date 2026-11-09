# 01 · Build a new product, part five: designs and the design system

Part four gave Hewn its document stages. Part five adds the two design stages. Stage two designs every screen in Magic Patterns and commits the export. Stage three extracts a design system from those screens and checks that every colour has a token.

## What we built

Both stages join the executor from part four as two more stage definitions, each with a hook. Stage two needs Magic Patterns before it starts, and exports designs after its agent finishes. Stage three compares its tokens with the Magic Patterns design system when one exists.

The worker talks to Magic Patterns over the Model Context Protocol, with the same tools the real server offers: create design, get design status, read artifact files and the design system tools.

## How it fits together

All UI design happens in Magic Patterns, so there is no fallback. Before the agent runs, the executor connects. If the server is unreachable or refuses the credential, the run fails with Magic Patterns unavailable and the reason, and the agent never starts, so nothing is hand-written.

Each design holds one raw HTML file per state: default, loading, empty and error. The executor reads them through the protocol and writes them to docs slash mocks, next to a manifest recording every screen's feature, Magic Patterns link and states.

## The code that matters

The mock validator checks that every core feature in the brief has a design, and every screen has all four states or a recorded reason. Every file must parse. Then Chromium loads each file at three hundred seventy-five, seven hundred sixty-eight and twelve hundred eighty pixels, and any horizontal scroll fails the run, with the file and the width.

Stage three's coverage check normalises hex, RGB and HSL colours, and lists every colour in the mocks that no token matches.

## Tests first

A fake Magic Patterns server speaks the real protocol, and twenty new worker tests run against it: the client, including a refused credential that is never echoed; the validators, with real Chromium; and both stages end to end. The backend gained six tests for the new paths, and the Playwright pipeline designs through the fake server for real.

## The screens

Here is the real app, with one worker and the fake Magic Patterns server. The Owner submits a direction. Stage zero creates the repository, and the brief is written. Then stage two designs every core feature and exports the mocks, and stage three extracts the design system, each in a moment. The scripted stages that remain follow, and the direction completes.

And here is what stage two commits: a design's default state at desktop width, and its error state on a phone in the dark theme, exactly as Magic Patterns served it.

## Recap

Screens are designed only in Magic Patterns, exported, and checked at three widths. The design system covers every colour the mocks use. Next, stage six: the scaffold, with continuous integration and branch protection.
