// TRANSITIONAL — delete on Day 7 when tsc=0 and lint=0; replace with
// `tsc -p tsconfig.app.json --noEmit` and `eslint . --max-warnings=0`.
//
// Runs tsc on tsconfig.app.json and item-diffs the errors against the baseline file; then runs
// tsconfig.node.json and fails on any error. Items are keyed on `file(line,col): TScode` —
// message text is ignored because type dumps churn with unrelated edits. Baseline lines are
// CRLF-tolerant. A missing baseline is treated as empty (i.e. zero errors allowed).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const TSC = require.resolve("typescript/bin/tsc");
const BASELINE = "specs/inbox-sidebar-multi-tabs/tsc-baseline-items.txt";
const ITEM_RE = /^(.+?)\((\d+),(\d+)\): error (TS\d+):/;

function runTsc(project) {
  const r = spawnSync(process.execPath, [TSC, "-p", project, "--noEmit"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = (r.stdout ?? "") + (r.stderr ?? "");
  const lines = out.split(/\r?\n/).filter((l) => ITEM_RE.test(l));
  if (r.status !== 0 && lines.length === 0) {
    console.error(`gate:tsc — tsc -p ${project} exited ${r.status} with no TS errors parsed:\n${out}`);
    process.exit(1);
  }
  return lines;
}

function keyOf(line) {
  const m = ITEM_RE.exec(line);
  return `${m[1].replace(/\\/g, "/")}(${m[2]},${m[3]}): ${m[4]}`;
}

function countKeys(lines) {
  const m = new Map();
  for (const line of lines) {
    const k = keyOf(line);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

// --- app tsconfig: item-diff vs baseline -------------------------------------------------
const current = runTsc("tsconfig.app.json");
const baselineLines = existsSync(BASELINE)
  ? readFileSync(BASELINE, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => ITEM_RE.test(l))
  : [];

const cur = countKeys(current);
const base = countKeys(baselineLines);

const added = [];
const budget = new Map(cur); // remaining allowance per key, decremented as lines are matched
for (const line of current) {
  const k = keyOf(line);
  const allowed = base.get(k) ?? 0;
  const seen = budget.get(k);
  if (seen > allowed) {
    added.push(line);
    budget.set(k, seen - 1);
  }
}
const resolved = [...base].filter(([k, n]) => (cur.get(k) ?? 0) < n).map(([k]) => k);

console.log(`gate:tsc app  — ${current.length} errors (baseline ${baselineLines.length})`);
for (const k of resolved) console.log(`  RESOLVED  ${k}`);
for (const l of added) console.log(`  NEW       ${l}`);

// --- node tsconfig: zero tolerance -------------------------------------------------------
const node = runTsc("tsconfig.node.json");
console.log(`gate:tsc node — ${node.length} errors (expected 0)`);
for (const l of node) console.log(`  NEW       ${l}`);

if (added.length || node.length) {
  console.error("gate:tsc FAIL");
  process.exit(1);
}
console.log("gate:tsc PASS");
