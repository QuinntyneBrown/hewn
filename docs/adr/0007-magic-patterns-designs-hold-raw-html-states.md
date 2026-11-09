# 0007. Magic Patterns designs hold one raw HTML file per state, and workers reach Magic Patterns directly

- **Status:** Accepted
- **Date:** 2026-11-09
- **Requirements:** L2-010, L2-012, L2-040

## Context

L2-010 requires every screen to be designed in Magic Patterns through its MCP server, and a static HTML export
of every screen and state committed to `docs/mocks/`. Magic Patterns designs are React prototypes by default,
and its MCP server has no "export as static HTML" tool. Its editor tools read and write a design's artifact
files (`get_design_status` returns the active artifact; `read_artifact_files` returns file contents).

The worker also needs a Magic Patterns credential. The credential store (L2-040) and run isolation, including
the egress proxy that allow-lists the Magic Patterns host, are not built yet.

## Decision

- Stage 2 asks Magic Patterns for each screen as raw, self-contained HTML files named `{state}.html`
  (`default`, `loading`, `empty`, `error`) inside the design. The executor, not the agent, exports them:
  `get_design_status`, then `read_artifact_files` for each state, then writes `docs/mocks/{screen}/{state}.html`.
- `docs/mocks/manifest.json` records each screen's feature, Magic Patterns URL, editor ID, states and
  not-applicable reasons.
- Until the credential store exists, the worker reads `HEWN_MAGIC_PATTERNS_URL` and `HEWN_MAGIC_PATTERNS_TOKEN`
  and connects over streamable HTTP. The token is never logged, and failures report only "credential
  rejected" or "unreachable".
- Tests and the e2e stack use a fake MCP server (`worker/src/magic-patterns/fake-server.ts`) that speaks MCP and
  serves the same tool names and arguments.

## Alternatives considered

- **Exporting the React prototype by rendering it in a browser.** It gives the exact rendering, but needs a
  bundler per design and makes states depend on prototype navigation. Rejected for now.
- **Letting the agent write the exported files.** It blurs "designed in Magic Patterns" with "hand-written",
  which L2-010 AC5 forbids. Rejected.

## Consequences

- Designs must keep their state files as raw HTML; the stage 2 instructions and prompt say so.
- `McpMagicPatterns` parses Magic Patterns' JSON text results. It is verified against the fake, not yet against
  live magicpatterns.com; response shapes are confirmed when a real credential is configured.
- The environment variables move to the credential store with L2-040, and the connection moves behind the
  egress proxy with run isolation.
