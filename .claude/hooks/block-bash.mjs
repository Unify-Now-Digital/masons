// PreToolUse (Bash). Exit 2 = block; stderr goes back to the model. Fail-open on bad input.
import { readFileSync } from "node:fs";
import path from "node:path";

let input = {};
try { input = JSON.parse(readFileSync(0, "utf8")); } catch { process.exit(0); }

const cmd = String(input.tool_input?.command ?? "");
const RULES = [
  // `git` at command start, or after ; && || | newline $( `
  [/(^|[;&|\n]|\$\(|`)\s*git(?=\s|$)/, "git is Giorgi's (CLAUDE.md §Git)"],
  [/\bsupabase\s+db\s+push\b/, "supabase db push is forbidden (CLAUDE.md §Database)"],
  [/\bsupabase\s+db\s+reset\b/, "supabase db reset is forbidden"],
  [/\brm\s+-(rf|fr|Rf|fR|rF|RF|FR)\b/, "rm -rf is forbidden"],
  [/\bnpm\s+publish\b/, "npm publish is forbidden"],
];

function block(why) {
  const first = cmd.split("\n")[0].slice(0, 120);
  process.stderr.write(`block-bash: ${why} — blocked: ${first}\n`);
  process.exit(2);
}

for (const [re, why] of RULES) if (re.test(cmd)) block(why);

// ---- Shell writes into the repo (`>`, `>>`, tee, sed -i, perl -i) ------------------------
// Files must go through Edit/Write so block-secrets can inspect them. Targets under
// node_modules/, dist/, a temp dir, /dev/*, or outside the repo are allowed. Reads, pipes and
// fd redirects (2>&1, >&2, 2>/dev/null) are untouched.
const WRITE_MSG = "write files with the Edit/Write tool so block-secrets can check them";
const norm = (p) => path.resolve(String(p)).replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
const projectDir = norm(process.env.CLAUDE_PROJECT_DIR || process.cwd());
const cwd = norm(input.cwd || process.cwd());
const SCRATCH =
  /^(?:\/dev\/|nul$|\/tmp(?:\/|$)|\$\{?(?:TMP|TMPDIR|TEMP)\b|%(?:TMP|TEMP)%)|(?:^|[\/\\])(?:node_modules|dist|tmp|temp)(?:[\/\\]|$)/i;

function isRepoWrite(raw) {
  const t = raw.replace(/^(["'])(.*)\1$/s, "$2");
  if (!t || t[0] === "&" || t[0] === "(" || t[0] === "~") return false; // fd dup, >(proc), $HOME
  if (SCRATCH.test(t)) return false;
  if (/[$%]/.test(t)) return true; // unexpandable variable → assume repo
  const abs = norm(path.resolve(cwd, t.replace(/^\/([a-z])\//i, "$1:/")));
  return abs === projectDir || abs.startsWith(projectDir + "/");
}

// Same length as cmd with quoted contents x-ed out, so operator matches ignore string
// literals while indices still line up with the original for target extraction.
const masked = cmd.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, (m) => m[0] + "x".repeat(m.length - 2) + m[0]);
const tokensOf = (s) => s.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
// The captured group is always the tail of the match; read it back from the unmasked cmd.
const slice = (m, group) => { const s = m.index + m[0].length - group.length; return cmd.slice(s, s + group.length); };

// `>`, `>>`, `>|`, `N>`, `&>` followed by a target.
const REDIR = /(?<![-=<>])(?:\d+|&)?>(?:>|\|)?\s*("[^"]*"|'[^']*'|[^\s;&|)]+)/g;
for (const m of masked.matchAll(REDIR)) {
  if (isRepoWrite(slice(m, m[1]))) block(WRITE_MSG);
}

// `tee [-a] file…` in command position.
const TEE = /(?:^|[;&|\n]|\$\(|`)\s*tee\b([^;&|\n)`]*)/g;
for (const m of masked.matchAll(TEE)) {
  for (const t of tokensOf(slice(m, m[1]))) {
    if (!t.startsWith("-") && isRepoWrite(t)) block(WRITE_MSG);
  }
}

// `sed -i` / `perl -i` (also -Ei, -pi, -i.bak, --in-place). Skip the script argument
// (first non-flag token, or the token after -e/-f/--expression/--file) and check the files.
const INPLACE = /(?:^|[;&|\n]|\$\(|`)\s*(?:sed|perl)\b([^;&|\n)`]*)/g;
const IN_PLACE_FLAG = /(?:^|\s)(?:-[a-zA-Z]*i(?:\.\S*)?|--in-place(?:=\S*)?)(?=[\s'"]|$)/;
const SCRIPT_FLAG = /^(?:-[a-zA-Z]*[ef]|--expression|--file)$/;
for (const m of masked.matchAll(INPLACE)) {
  if (!IN_PLACE_FLAG.test(m[1])) continue;
  const toks = tokensOf(slice(m, m[1]));
  const files = [];
  let sawScript = false;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.startsWith("-")) {
      if (SCRIPT_FLAG.test(t)) { i++; sawScript = true; }
      continue;
    }
    if (!sawScript) { sawScript = true; continue; } // bare script argument
    files.push(t);
  }
  if (files.some(isRepoWrite)) block(WRITE_MSG);
}

process.exit(0);
