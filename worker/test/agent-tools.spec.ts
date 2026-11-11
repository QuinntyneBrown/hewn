// Acceptance Test
// Traces to: L2-042
// Description: An agent that follows instructions planted in a repository, mock or web page has no tool that can
// change Hewn configuration, budgets, secrets or another project: every stage's tools come from one catalogue that
// holds none, the gate denies any other, and a run's commands can neither see the worker's credentials nor reach the
// Hewn API (AC4)

import { describe, expect, it } from 'vitest';
import { STAGE_TOOLS, TOOL_CATALOG } from '../src/agents/tool-catalog.ts';
import { egressAllowList, EgressProxy } from '../src/isolation/egress-proxy.ts';
import { commandEnvironment } from '../src/isolation/run-sandbox.ts';
import { ToolDeniedError, ToolGate } from '../src/isolation/tool-gate.ts';

describe('the tools an agent can have', () => {
  it('come from a catalogue of workspace, shell and Magic Patterns design tools only', () => {
    expect([...TOOL_CATALOG].sort()).toEqual(
      [
        'Bash',
        'Edit',
        'Glob',
        'Grep',
        'Read',
        'Skill',
        'Write',
        'mcp__magic-patterns__create_design',
        'mcp__magic-patterns__get_design_status',
        'mcp__magic-patterns__list_design_systems',
        'mcp__magic-patterns__read_artifact_files',
        'mcp__magic-patterns__send_prompt',
        'mcp__magic-patterns__write_artifact_files',
      ].sort(),
    );
    for (const tool of TOOL_CATALOG) {
      expect(tool).not.toMatch(/hewn|config|setting|budget|spend|secret|credential|token|project|direction|github/i);
    }
    for (const tools of Object.values(STAGE_TOOLS)) {
      for (const tool of tools) expect(TOOL_CATALOG).toContain(tool);
    }
  });

  it('are the only ones a stage’s gate lets through', () => {
    const denied: string[] = [];
    for (const tools of Object.values(STAGE_TOOLS)) {
      const gate = new ToolGate(tools, (tool) => denied.push(tool));
      for (const planted of [
        'mcp__hewn__set_budget',
        'mcp__hewn__set_secret',
        'mcp__github__create_repository',
        'WebFetch',
      ]) {
        expect(() => gate.require(planted)).toThrow(ToolDeniedError);
      }
    }
    expect(denied).toHaveLength(Object.keys(STAGE_TOOLS).length * 4);
  });

  it('cannot reach the Hewn API or see a credential from a run’s commands', () => {
    const worker = {
      PATH: '/usr/bin',
      HEWN_API_URL: 'https://hewn.example.com',
      HEWN_WORKER_TOKEN: 'worker-token-0123456789',
      ANTHROPIC_API_KEY: 'sk-ant-api03-0123456789abcdef',
      HEWN_MAGIC_PATTERNS_TOKEN: 'mp-0123456789',
    };
    const env = commandEnvironment('/tmp/ws', 'http://127.0.0.1:9000', worker);
    expect(Object.keys(env).filter((k) => /HEWN|ANTHROPIC|TOKEN|KEY|SECRET/i.test(k))).toEqual([]);
    expect(Object.values(env).join(' ')).not.toMatch(/worker-token|sk-ant|mp-0123/);

    const proxy = new EgressProxy(egressAllowList({ magicPatternsUrl: 'https://mcp.magicpatterns.com/mcp' }), () => {});
    expect(proxy.allows('hewn.example.com')).toBe(false);
    expect(proxy.allows('localhost')).toBe(false);
    expect(proxy.allows('127.0.0.1')).toBe(false);
  });
});
