// TRANSITIONAL — delete on Day 7 when tsc=0 and lint=0; replace with
// `tsc -p tsconfig.app.json --noEmit` and `eslint . --max-warnings=0`.
//
// Runs `eslint . -f json`, sums errors and warnings, and fails if either exceeds the counts in
// scripts/gate-baselines.json. Counts below baseline are reported as info (lower the baseline).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
// eslint's `exports` map hides ./bin, so locate the CLI via the exported package.json `bin` field.
const eslintPkgPath = require.resolve("eslint/package.json");
const eslintPkg = require("eslint/package.json");
const ESLINT = join(
  dirname(eslintPkgPath),
  typeof eslintPkg.bin === "string" ? eslintPkg.bin : eslintPkg.bin.eslint,
);
const baseline = JSON.parse(readFileSync("scripts/gate-baselines.json", "utf8"));

const r = spawnSync(process.execPath, [ESLINT, ".", "-f", "json"], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});

let results;
try {
  results = JSON.parse(r.stdout);
} catch {
  console.error(`gate:lint — eslint produced no JSON (exit ${r.status}):\n${r.stderr}`);
  process.exit(1);
}

const errors = results.reduce((n, f) => n + f.errorCount, 0);
const warnings = results.reduce((n, f) => n + f.warningCount, 0);

console.log(
  `gate:lint — ${errors} errors / ${warnings} warnings (baseline ${baseline.lintErrors} / ${baseline.lintWarnings})`,
);
if (errors < baseline.lintErrors || warnings < baseline.lintWarnings) {
  console.log("  info: below baseline — lower scripts/gate-baselines.json");
}
if (errors > baseline.lintErrors || warnings > baseline.lintWarnings) {
  console.error("gate:lint FAIL");
  process.exit(1);
}
console.log("gate:lint PASS");
