#!/usr/bin/env node
// Scans all .ts/.tsx files for import issues:
//   1. Malformed dynamic imports (await import { ... })
//   2. Static imports pointing to files that don't exist (resolves @/* aliases)

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, extname } from 'path';
import { glob } from 'fs/promises';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

// Path aliases from tsconfig
const ALIASES = { '@/': ROOT + '/' };

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs'];

// Try to resolve an import specifier to an actual file path
function resolveImport(specifier, fromFile) {
  if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('@/')) {
    let base = specifier;
    for (const [alias, target] of Object.entries(ALIASES)) {
      if (base.startsWith(alias)) {
        base = target + base.slice(alias.length);
        break;
      }
    }
    if (base.startsWith('.')) {
      base = resolve(dirname(fromFile), base);
    }
    // Already has extension
    if (extname(base) && existsSync(base)) return { ok: true };
    // Try with extensions
    for (const ext of EXTENSIONS) {
      if (existsSync(base + ext)) return { ok: true };
    }
    // Try index file
    for (const ext of EXTENSIONS) {
      if (existsSync(base + '/index' + ext)) return { ok: true };
    }
    return { ok: false, resolved: base };
  }
  // node_modules — skip
  return { ok: true };
}

const MALFORMED_DYNAMIC_IMPORT = /await\s+import\s*\{[^}]*\}[^;,)]+['"]/g;
const STATIC_IMPORT_RE = /^\s*(?:import|export)\s+(?:type\s+)?(?:\{[^}]*\}|[\w*]+(?:\s*,\s*(?:\{[^}]*\}|[\w*]+))?|\*\s+as\s+\w+)?\s*from\s+['"]([^'"]+)['"]/gm;
const DYNAMIC_IMPORT_RE = /await\s+import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

let totalIssues = 0;

async function checkFile(filePath) {
  const source = readFileSync(filePath, 'utf8');
  const issues = [];

  // 1. Malformed dynamic imports
  for (const match of source.matchAll(/await\s+import\s*\{[^}]*\}[^'";\n]*/g)) {
    const lineNum = source.slice(0, match.index).split('\n').length;
    issues.push(`  line ${lineNum}: MALFORMED dynamic import: ${match[0].trim()}`);
  }

  // 2. Check static import paths exist
  for (const match of source.matchAll(STATIC_IMPORT_RE)) {
    const specifier = match[1];
    const result = resolveImport(specifier, filePath);
    if (!result.ok) {
      const lineNum = source.slice(0, match.index).split('\n').length;
      issues.push(`  line ${lineNum}: UNRESOLVED import '${specifier}' (tried: ${result.resolved})`);
    }
  }

  // 3. Check dynamic import paths exist
  for (const match of source.matchAll(DYNAMIC_IMPORT_RE)) {
    const specifier = match[1];
    const result = resolveImport(specifier, filePath);
    if (!result.ok) {
      const lineNum = source.slice(0, match.index).split('\n').length;
      issues.push(`  line ${lineNum}: UNRESOLVED dynamic import '${specifier}' (tried: ${result.resolved})`);
    }
  }

  if (issues.length > 0) {
    const rel = filePath.replace(ROOT + '/', '');
    console.log(`\n${rel}`);
    issues.forEach(i => console.log(i));
    totalIssues += issues.length;
  }
}

// Collect all ts/tsx files (excluding node_modules and .next)
const files = [];
for await (const f of glob(`${ROOT}/**/*.{ts,tsx}`, {
  exclude: (p) => p.includes('node_modules') || p.includes('.next'),
})) {
  files.push(f);
}

console.log(`Checking ${files.length} files...\n`);
for (const f of files.sort()) await checkFile(f);

if (totalIssues === 0) {
  console.log('No import issues found.');
} else {
  console.log(`\n${totalIssues} issue(s) found.`);
}
