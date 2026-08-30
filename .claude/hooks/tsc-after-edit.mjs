// PostToolUse (Edit|Write|MultiEdit). For .ts/.tsx under src/, runs scripts/gate-tsc.mjs and
// surfaces its output (systemMessage → user; additionalContext → model). Never blocks (exit 0).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

let input = {};
try { input = JSON.parse(readFileSync(0, "utf8")); } catch { process.exit(0); }

const root = (process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd()).replace(/\\/g, "/");
const filePath = String(input.tool_input?.file_path ?? "").replace(/\\/g, "/");

const isTs = /\.tsx?$/i.test(filePath);
const underSrc = filePath.toLowerCase().startsWith(`${root.toLowerCase()}/src/`);
if (!isTs || !underSrc) process.exit(0);

const r = spawnSync(process.execPath, ["scripts/gate-tsc.mjs"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
const out = ((r.stdout ?? "") + (r.stderr ?? "")).trim();
const summary = out
  .split(/\r?\n/)
  .filter((l) => /gate:tsc|^\s+(NEW|RESOLVED)\s/.test(l))
  .join("\n");

process.stdout.write(
  JSON.stringify({
    systemMessage: `tsc-after-edit (${filePath.slice(root.length + 1)}):\n${summary || out}`,
    hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: out },
  }),
);
process.exit(0);
