// PreToolUse (Edit|Write|MultiEdit). Blocks new content that contains any UUID or the Supabase
// project ref from CLAUDE.local.md (gitignored), or a Stripe key-like string. Exempt targets:
// CLAUDE.local.md, .env*, supabase/config.toml. Exit 2 = block. Fail-open on bad input.
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

let input = {};
try { input = JSON.parse(readFileSync(0, "utf8")); } catch { process.exit(0); }

const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
const norm = (p) => String(p ?? "").replace(/\\/g, "/");
const filePath = norm(input.tool_input?.file_path);
const base = basename(filePath);

const exempt =
  base === "CLAUDE.local.md" ||
  base.startsWith(".env") ||
  filePath.toLowerCase().endsWith("/supabase/config.toml");
if (exempt) process.exit(0);

const ti = input.tool_input ?? {};
const content =
  input.tool_name === "Write" ? String(ti.content ?? "")
  : input.tool_name === "MultiEdit" ? (ti.edits ?? []).map((e) => String(e.new_string ?? "")).join("\n")
  : String(ti.new_string ?? "");
if (!content) process.exit(0);

// --- Stripe key-like strings (checked regardless of CLAUDE.local.md) ------------------------
const KEY_RE = /\b(sk_live_|sk_test_|whsec_|pk_live_)[A-Za-z0-9]{10,}/;
const keyHit = KEY_RE.exec(content);
if (keyHit) {
  process.stderr.write(`block-secrets: Stripe key-like string (${keyHit[1]}…) in ${filePath}\n`);
  process.exit(2);
}

// --- identifiers from CLAUDE.local.md -----------------------------------------------------
const localMd = join(root, "CLAUDE.local.md");
if (!existsSync(localMd)) {
  process.stderr.write("block-secrets: CLAUDE.local.md not found; identifier check skipped\n");
  process.exit(0);
}
const local = readFileSync(localMd, "utf8");
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const ids = new Set((local.match(UUID_RE) ?? []).map((s) => s.toLowerCase()));
for (const line of local.split(/\r?\n/)) {
  if (!/project/i.test(line)) continue;
  for (const m of line.match(/\b[a-z0-9]{20}\b/g) ?? []) ids.add(m.toLowerCase());
}

const lower = content.toLowerCase();
for (const id of ids) {
  if (lower.includes(id)) {
    process.stderr.write(
      `block-secrets: real identifier from CLAUDE.local.md in tracked file — use a placeholder (${id.slice(0, 8)}… in ${filePath})\n`,
    );
    process.exit(2);
  }
}
process.exit(0);
