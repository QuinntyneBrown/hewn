// Writes the default scaffold to a folder, for the CI job that builds it: node src/scaffold/generate-cli.ts <dir> [name]
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { dotnetAngularTemplate } from './dotnet-angular-template.ts';

const [dir, name = "Kiln Booking's 2nd App"] = process.argv.slice(2);
if (!dir) {
  console.error('Usage: generate-cli.ts <dir> [project name]');
  process.exit(2);
}
for (const file of dotnetAngularTemplate.generate(name)) {
  mkdirSync(dirname(join(dir, file.path)), { recursive: true });
  writeFileSync(join(dir, file.path), file.content);
}
console.log(`Wrote the ${dotnetAngularTemplate.id} scaffold for "${name}" to ${dir}`);
