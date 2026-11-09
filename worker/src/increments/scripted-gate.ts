import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { GateResult, SuiteResult, TestGate } from './test-gate.ts';

/**
 * A stand-in gate for the e2e stack, next to the scripted agent: the new acceptance tests fail until the
 * increment's implementation exists (`scriptedImplementation(testFile)`, which the scripted agent writes), and the full gate reports one passing test per acceptance test plus fixed backend and frontend counts.
 */
export class ScriptedTestGate implements TestGate {
  async acceptance(directory: string, testFiles: string[]): Promise<SuiteResult> {
    const failed = testFiles.filter((f) => !implemented(directory, f)).length;
    return suite('e2e', 'npx playwright test', failed === 0, testFiles.length - failed, failed);
  }

  async full(directory: string, testFiles: string[]): Promise<GateResult> {
    const red = await this.acceptance(directory, testFiles);
    const suites = [
      suite('backend', 'dotnet test', true, 1, 0),
      suite('frontend lint', 'npm run lint', true, 0, 0),
      suite('frontend unit', 'npm test', true, 1, 0),
      { ...red, commandLine: 'npx playwright test' },
    ];
    return {
      passed: suites.every((s) => s.passed),
      suites,
      failing: testFiles.filter((f) => !implemented(directory, f)).map((f) => `e2e: ✘ ${f}`),
    };
  }
}

/** Where the scripted agent puts the code that makes `testFile` pass: `e2e/tests/sign-in.spec.ts` → `frontend/src/app/increments/sign-in.ts`. */
export function scriptedImplementation(testFile: string): string {
  const name = testFile
    .split('/')
    .at(-1)!
    .replace(/\.(spec|test)\.[cm]?[jt]sx?$/, '');
  return `frontend/src/app/increments/${name}.ts`;
}

function implemented(directory: string, testFile: string): boolean {
  return existsSync(join(directory, scriptedImplementation(testFile)));
}

function suite(name: string, commandLine: string, passed: boolean, p: number, f: number): SuiteResult {
  return { suite: name, commandLine, passed, counts: { passed: p, failed: f }, output: '' };
}
