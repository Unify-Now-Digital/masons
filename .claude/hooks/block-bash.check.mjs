// Run: node .claude/hooks/block-bash.check.mjs  (not *.test.* — vitest's default include would collect it)
// Feeds each command through block-bash.mjs as a PreToolUse payload and checks the exit code
// (0 = allowed, 2 = blocked). Exits 1 if any case fails.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const hook = process.env.HOOK_UNDER_TEST || path.join(here, "block-bash.mjs");
const projectDir = process.env.CLAUDE_PROJECT_DIR || path.resolve(here, "../..");
const TEMP = "C:/Users/owner/AppData/Local/Temp/claude/x/scratchpad/out.txt";

const ALLOW = 0, BLOCK = 2;
const cases = [
  // ---- existing rules
  ["git status", BLOCK],
  ["npm test && git add .", BLOCK],
  ["echo $(git rev-parse HEAD)", BLOCK],
  ["rm -rf dist", BLOCK],
  ["supabase db push", BLOCK],
  ["gitk", ALLOW],
  ["echo digit", ALLOW],

  // ---- reads / pipes / fd redirects stay allowed
  ["cat .gitignore | head -3", ALLOW],
  ["npm run gate 2>&1 | tail -20", ALLOW],
  ["ls nope 2>/dev/null", ALLOW],
  ["ls nope 2> /dev/null", ALLOW],
  ["cmd > /dev/null", ALLOW],
  ["cmd &>/dev/null", ALLOW],
  ["echo err >&2", ALLOW],
  ["cmd 1>&2", ALLOW],
  ["cmd > NUL", ALLOW],
  ["grep -i foo src/a.ts", ALLOW],
  ["sed -n '1,5p' docs/handoff.md", ALLOW],
  ["sed -e 's/a/b/' src/a.ts", ALLOW],
  ["perl -ne 'print if /x/' src/a.ts", ALLOW],
  ["perl -Mstrict -e 'print 1'", ALLOW],
  ["echo \"a > b\"", ALLOW],
  ["awk '$1 > 5' data.txt", ALLOW],
  ["cat <<'EOF'\nline\nEOF", ALLOW],
  ["node -e 'const f = (a) => a'", ALLOW],

  // ---- writes to allowed locations
  ["echo x > /tmp/out.txt", ALLOW],
  ["echo x >> $TMPDIR/out.txt", ALLOW],
  ["echo x > \"$TEMP/out.txt\"", ALLOW],
  ["echo x > ${TMP}/out.txt", ALLOW],
  [`echo x > ${TEMP}`, ALLOW],
  ["echo x > node_modules/.cache/x", ALLOW],
  ["echo x > dist/x.js", ALLOW],
  ["echo x > ./dist/x.js", ALLOW],
  ["echo x > ../SearsMelvin/notes.txt", ALLOW],
  ["echo x > ~/notes.txt", ALLOW],
  ["echo x | tee /dev/null", ALLOW],
  ["echo x | tee /tmp/log.txt", ALLOW],
  ["echo x | tee -a dist/log.txt", ALLOW],
  ["sed -i 's/a/b/' dist/x.js", ALLOW],
  ["perl -pi -e 's/a/b/' node_modules/x/y.js", ALLOW],
  ["sed -i -e 's/a/b/' -e 's/c/d/' dist/x.js", ALLOW],

  // ---- writes into the repo via shell → blocked
  ["echo x > docs/handoff.md", BLOCK],
  ["printf 'a\\n' >> docs/handoff.md", BLOCK],
  ["printf 'test whsec_abc' >> docs/handoff.md && tail -2 docs/handoff.md", BLOCK],
  ["cat a >| b", BLOCK],
  ["cmd &> out.log", BLOCK],
  ["cmd 1> out.txt", BLOCK],
  ["cmd 2> err.log", BLOCK],
  ["cmd >out.txt", BLOCK],
  ["echo x > \"docs/my file.md\"", BLOCK],
  ["echo x > $OUT", BLOCK],
  ["echo x > docs/x.md; ls", BLOCK],
  ["echo x > C:/Users/owner/Desktop/unify-memorial-mason-main/docs/x.md", BLOCK],
  ["echo x > /c/Users/owner/Desktop/unify-memorial-mason-main/docs/x.md", BLOCK],
  ["ls | tee docs/x.md", BLOCK],
  ["ls | tee -a docs/x.md", BLOCK],
  ["ls | tee /tmp/a docs/x.md", BLOCK],
  ["ls; tee docs/x.md < in", BLOCK],
  ["sed -i 's/a/b/' src/a.ts", BLOCK],
  ["sed -i.bak 's/a/b/' src/a.ts", BLOCK],
  ["sed -Ei 's/a+/b/' src/a.ts", BLOCK],
  ["sed -n -i 's/a/b/' src/a.ts", BLOCK],
  ["sed --in-place 's/a/b/' src/a.ts", BLOCK],
  ["sed --in-place=.bak -e 's/a/b/' src/a.ts", BLOCK],
  ["sed -i -f fix.sed src/a.ts", BLOCK],
  ["sed -i s/a/b/ src/a.ts", BLOCK],
  ["sed -i 's/a/b/' dist/x.js src/a.ts", BLOCK],
  ["perl -pi -e 's/a/b/' src/a.ts", BLOCK],
  ["perl -i.bak -pe 's/a/b/' src/a.ts", BLOCK],
  ["perl -i -pe 's/a/b/' src/a.ts", BLOCK],
  ["perl -i script.pl src/a.ts", BLOCK],
  ["npm run gate 2>&1 | tail -20 > gate.log", BLOCK],
  ["echo $(ls > docs/x.md)", BLOCK],
  ["cat <<EOF > docs/x.md\nhello\nEOF", BLOCK],
];

let fail = 0;
for (const [command, want] of cases) {
  const r = spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ tool_input: { command }, cwd: projectDir }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
    encoding: "utf8",
  });
  const ok = r.status === want;
  if (!ok) fail++;
  const shown = JSON.stringify(command);
  const why = r.stderr.trim().replace(/ — blocked:.*$/s, "");
  console.log(`${ok ? "ok  " : "FAIL"} ${want === BLOCK ? "block" : "allow"}${ok ? "" : ` (got exit ${r.status})`}  ${shown}${why ? `  ← ${why}` : ""}`);
}
console.log(`\n${cases.length - fail}/${cases.length} passed`);
process.exit(fail ? 1 : 0);
