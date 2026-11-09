import { kebab, pascal, type ScaffoldFile, type StackTemplate } from './stack-template.ts';

/**
 * The default stack (L2-013): an ASP.NET Core API on the current LTS .NET with xUnit tests, an Angular workspace
 * with ESLint and Vitest unit tests, a Playwright project with an empty suite, and a GitHub Actions workflow whose
 * jobs `backend`, `frontend` and `e2e` become the default branch's required checks. Versions match the toolchain
 * Hewn itself builds with; the `Scaffold template` CI job builds this output on every change.
 */
export const dotnetAngularTemplate: StackTemplate = {
  id: 'dotnet-angular',
  matches: (decision) => /\.NET\b/i.test(decision) && /\bAngular\b/i.test(decision),
  checks: ['backend', 'frontend', 'e2e'],
  gate: [
    { suite: 'backend', cwd: 'backend', command: 'dotnet', args: ['test'] },
    {
      suite: 'frontend lint',
      cwd: 'frontend',
      command: 'npm',
      args: ['run', 'lint'],
      before: [{ command: 'npm', args: ['install', '--no-audit', '--no-fund'] }],
    },
    { suite: 'frontend unit', cwd: 'frontend', command: 'npm', args: ['test'] },
    {
      suite: 'e2e',
      cwd: 'e2e',
      command: 'npx',
      args: ['playwright', 'test'],
      acceptance: true,
      stripPrefix: 'e2e/',
      before: [{ command: 'npm', args: ['install', '--no-audit', '--no-fund'] }],
    },
  ],
  generate(projectName) {
    const P = pascal(projectName);
    const k = kebab(projectName);
    const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
    const files: ScaffoldFile[] = [
      { path: '.gitignore', content: GITIGNORE },
      { path: 'README.md', content: readme(projectName, P) },
      { path: '.github/workflows/ci.yml', content: ci(P) },

      { path: 'backend/global.json', content: json({ sdk: { version: '10.0.100', rollForward: 'latestFeature' } }) },
      {
        path: `backend/${P}.slnx`,
        content: `<Solution>\n  <Folder Name="/src/">\n    <Project Path="src/${P}.Api/${P}.Api.csproj" />\n  </Folder>\n  <Folder Name="/tests/">\n    <Project Path="tests/${P}.Api.Tests/${P}.Api.Tests.csproj" />\n  </Folder>\n</Solution>\n`,
      },
      {
        path: `backend/src/${P}.Api/${P}.Api.csproj`,
        content: `<Project Sdk="Microsoft.NET.Sdk.Web">\n\n  <PropertyGroup>\n    <TargetFramework>net10.0</TargetFramework>\n    <Nullable>enable</Nullable>\n    <ImplicitUsings>enable</ImplicitUsings>\n    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>\n  </PropertyGroup>\n\n</Project>\n`,
      },
      {
        path: `backend/src/${P}.Api/Program.cs`,
        content: `var builder = WebApplication.CreateBuilder(args);\nvar app = builder.Build();\n\napp.MapGet("/health", () => Results.Ok(new { status = "Healthy" }));\n\napp.Run();\n\n/// <summary>Visible to the API tests' WebApplicationFactory.</summary>\npublic partial class Program;\n`,
      },
      {
        path: `backend/src/${P}.Api/appsettings.json`,
        content: json({
          Logging: { LogLevel: { Default: 'Information', 'Microsoft.AspNetCore': 'Warning' } },
          AllowedHosts: '*',
        }),
      },
      {
        path: `backend/tests/${P}.Api.Tests/${P}.Api.Tests.csproj`,
        content: `<Project Sdk="Microsoft.NET.Sdk">\n\n  <PropertyGroup>\n    <TargetFramework>net10.0</TargetFramework>\n    <Nullable>enable</Nullable>\n    <ImplicitUsings>enable</ImplicitUsings>\n    <IsPackable>false</IsPackable>\n  </PropertyGroup>\n\n  <ItemGroup>\n    <PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" Version="10.0.14" />\n    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.14.1" />\n    <PackageReference Include="xunit" Version="2.9.3" />\n    <PackageReference Include="xunit.runner.visualstudio" Version="3.1.4" />\n  </ItemGroup>\n\n  <ItemGroup>\n    <Using Include="Xunit" />\n  </ItemGroup>\n\n  <ItemGroup>\n    <ProjectReference Include="../../src/${P}.Api/${P}.Api.csproj" />\n  </ItemGroup>\n\n</Project>\n`,
      },
      {
        path: `backend/tests/${P}.Api.Tests/HealthTests.cs`,
        content: `using System.Net;\nusing Microsoft.AspNetCore.Mvc.Testing;\n\nnamespace ${P}.Api.Tests;\n\npublic sealed class HealthTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>\n{\n    [Fact]\n    public async Task The_health_endpoint_reports_healthy()\n    {\n        var response = await factory.CreateClient().GetAsync("/health");\n\n        Assert.Equal(HttpStatusCode.OK, response.StatusCode);\n    }\n}\n`,
      },

      {
        path: 'frontend/package.json',
        content: json({
          name: k,
          version: '0.0.0',
          private: true,
          scripts: { start: 'ng serve', build: 'ng build', test: 'ng test --watch=false', lint: 'ng lint' },
          dependencies: {
            '@angular/common': '^21.2.0',
            '@angular/compiler': '^21.2.0',
            '@angular/core': '^21.2.0',
            '@angular/forms': '^21.2.0',
            '@angular/platform-browser': '^21.2.0',
            '@angular/router': '^21.2.0',
            rxjs: '~7.8.0',
            tslib: '^2.3.0',
          },
          devDependencies: {
            '@angular/build': '^21.2.29',
            '@angular/cli': '^21.2.29',
            '@angular/compiler-cli': '^21.2.0',
            '@eslint/js': '^10.0.1',
            'angular-eslint': '21.4.0',
            eslint: '^10.3.0',
            jsdom: '^28.0.0',
            typescript: '~5.9.2',
            'typescript-eslint': '8.59.2',
            vitest: '^4.0.8',
          },
        }),
      },
      {
        path: 'frontend/angular.json',
        content: json({
          $schema: './node_modules/@angular/cli/lib/config/schema.json',
          version: 1,
          cli: { packageManager: 'npm', analytics: false },
          projects: {
            web: {
              projectType: 'application',
              root: '',
              sourceRoot: 'src',
              prefix: 'app',
              architect: {
                build: {
                  builder: '@angular/build:application',
                  options: { browser: 'src/main.ts', tsConfig: 'tsconfig.app.json', styles: ['src/styles.css'] },
                  configurations: {
                    production: {
                      budgets: [{ type: 'initial', maximumWarning: '500kB', maximumError: '1MB' }],
                      outputHashing: 'all',
                    },
                    development: { optimization: false, extractLicenses: false, sourceMap: true },
                  },
                  defaultConfiguration: 'production',
                },
                serve: {
                  builder: '@angular/build:dev-server',
                  configurations: {
                    production: { buildTarget: 'web:build:production' },
                    development: { buildTarget: 'web:build:development' },
                  },
                  defaultConfiguration: 'development',
                },
                test: { builder: '@angular/build:unit-test', options: { tsConfig: 'tsconfig.spec.json' } },
                lint: {
                  builder: '@angular-eslint/builder:lint',
                  options: { lintFilePatterns: ['src/**/*.ts', 'src/**/*.html'] },
                },
              },
            },
          },
        }),
      },
      {
        path: 'frontend/tsconfig.json',
        content: json({
          compileOnSave: false,
          compilerOptions: {
            strict: true,
            noImplicitOverride: true,
            noPropertyAccessFromIndexSignature: true,
            noImplicitReturns: true,
            noFallthroughCasesInSwitch: true,
            skipLibCheck: true,
            isolatedModules: true,
            experimentalDecorators: true,
            importHelpers: true,
            target: 'ES2022',
            module: 'preserve',
          },
          angularCompilerOptions: {
            enableI18nLegacyMessageIdFormat: false,
            strictInjectionParameters: true,
            strictInputAccessModifiers: true,
            strictTemplates: true,
          },
          files: [],
          references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.spec.json' }],
        }),
      },
      {
        path: 'frontend/tsconfig.app.json',
        content: json({
          extends: './tsconfig.json',
          compilerOptions: { outDir: './out-tsc/app', types: [] },
          include: ['src/**/*.ts'],
          exclude: ['src/**/*.spec.ts'],
        }),
      },
      {
        path: 'frontend/tsconfig.spec.json',
        content: json({
          extends: './tsconfig.json',
          compilerOptions: { outDir: './out-tsc/spec', types: ['vitest/globals'] },
          include: ['src/**/*.d.ts', 'src/**/*.spec.ts'],
        }),
      },
      { path: 'frontend/eslint.config.js', content: ESLINT },
      {
        path: 'frontend/src/index.html',
        content: `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <title>${escapeHtml(projectName)}</title>\n  <base href="/">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body>\n  <app-root></app-root>\n</body>\n</html>\n`,
      },
      {
        path: 'frontend/src/main.ts',
        content: `import { bootstrapApplication } from '@angular/platform-browser';\nimport { App } from './app/app';\nimport { appConfig } from './app/app.config';\n\nbootstrapApplication(App, appConfig).catch((err: unknown) => console.error(err));\n`,
      },
      { path: 'frontend/src/styles.css', content: 'body {\n  margin: 0;\n  font-family: system-ui, sans-serif;\n}\n' },
      {
        path: 'frontend/src/app/app.config.ts',
        content: `import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';\n\nexport const appConfig: ApplicationConfig = {\n  providers: [provideBrowserGlobalErrorListeners()],\n};\n`,
      },
      {
        path: 'frontend/src/app/app.ts',
        content: `import { ChangeDetectionStrategy, Component } from '@angular/core';\n\n@Component({\n  selector: 'app-root',\n  changeDetection: ChangeDetectionStrategy.OnPush,\n  template: '<main><h1>{{ name }}</h1></main>',\n})\nexport class App {\n  protected readonly name = ${JSON.stringify(projectName).replace(/'/g, "\\'").replace(/^"|"$/g, "'")};\n}\n`,
      },
      {
        path: 'frontend/src/app/app.spec.ts',
        content: `import { TestBed } from '@angular/core/testing';\nimport { App } from './app';\n\ndescribe('App', () => {\n  it('shows the product name', async () => {\n    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();\n\n    const fixture = TestBed.createComponent(App);\n    fixture.detectChanges();\n\n    expect((fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent).toContain(${JSON.stringify(projectName)});\n  });\n});\n`,
      },

      {
        path: 'e2e/package.json',
        content: json({
          name: `${k}-e2e`,
          version: '0.0.0',
          private: true,
          type: 'module',
          scripts: { test: 'playwright test --pass-with-no-tests' },
          devDependencies: { '@playwright/test': '^1.65.0', '@types/node': '^24.0.0', typescript: '~5.9.2' },
        }),
      },
      {
        path: 'e2e/playwright.config.ts',
        content: `import { defineConfig, devices } from '@playwright/test';\n\nexport default defineConfig({\n  testDir: './tests',\n  forbidOnly: !!process.env['CI'],\n  reporter: 'list',\n  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],\n});\n`,
      },
      {
        path: 'e2e/tsconfig.json',
        content: json({
          compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'bundler',
            strict: true,
            noEmit: true,
            types: ['node'],
          },
          include: ['**/*.ts'],
        }),
      },
      { path: 'e2e/tests/README.md', content: 'Acceptance tests go here, one file per journey, using page objects.\n' },
    ];
    return files;
  },
};

function ci(P: string): string {
  return `name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          global-json-file: backend/global.json
      - run: dotnet build ${P}.slnx
      - run: dotnet test ${P}.slnx --no-build

  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npm install
      - run: npm run lint
      - run: npm run build
      - run: npm test

  e2e:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: e2e
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npm install
      - run: npm test
`;
}

function readme(name: string, P: string): string {
  return `# ${name}

Scaffolded by Hewn. Product documents live in \`docs/\`: the brief, the stack decision, requirements, designs and
user journeys.

## Folder structure

| Folder | What it holds |
|---|---|
| \`backend/\` | ASP.NET Core API (\`src/${P}.Api\`) and its xUnit tests (\`tests/${P}.Api.Tests\`) |
| \`frontend/\` | Angular workspace with ESLint and Vitest unit tests |
| \`e2e/\` | Playwright acceptance tests |
| \`docs/\` | Brief, ADRs, requirements, mocks, design system, designs and journeys |
| \`.github/workflows/\` | CI: \`backend\`, \`frontend\` and \`e2e\` jobs, required on \`main\` |

## Build, test and run

\`\`\`sh
# Backend (.NET 10 SDK)
cd backend
dotnet build ${P}.slnx
dotnet test ${P}.slnx
dotnet run --project src/${P}.Api

# Frontend (Node 24)
cd frontend
npm install
npm run lint
npm run build
npm test
npm start            # http://localhost:4200

# End to end
cd e2e
npm install
npx playwright install chromium
npm test
\`\`\`
`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const GITIGNORE = `bin/
obj/
node_modules/
dist/
out-tsc/
.angular/
test-results/
playwright-report/
*.db
.DS_Store
`;

const ESLINT = `// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [eslint.configs.recommended, tseslint.configs.recommended, tseslint.configs.stylistic, angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);
`;
