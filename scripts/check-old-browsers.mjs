// Fails when the built browser code uses syntax that older phones cannot parse.
//
// One unparsable file stops the whole app on that phone: the page shows, but no button works.
// That happened to the pilot on an iPhone. package.json "browserslist" makes the build convert
// newer syntax; this check proves it did. Run after `next build`:  node scripts/check-old-browsers.mjs
//
// Checked (all are parse errors, not missing functions, so a polyfill cannot help):
//   class static blocks  `static { … }`      Safari 16.4
//   regex lookbehind     `(?<=…)` `(?<!…)`   Safari 16.4
//   regex `v` flag       `/…/v`              Safari 17
import fs from "node:fs";
import path from "node:path";
import { parse } from "acorn";
import { full } from "acorn-walk";

const root = path.join(process.cwd(), ".next", "static", "chunks");
if (!fs.existsSync(root)) {
  console.error("No .next/static/chunks: run `next build` first.");
  process.exit(2);
}

const files = [];
(function collect(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full);
    else if (entry.name.endsWith(".js")) files.push(full);
  }
})(root);

const lookbehind = /\(\?<[=!]/;
const problems = [];
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  let ast;
  try {
    ast = parse(source, { ecmaVersion: "latest", sourceType: "script", allowHashBang: true });
  } catch {
    ast = parse(source, { ecmaVersion: "latest", sourceType: "module", allowHashBang: true });
  }
  full(ast, (node) => {
    let feature;
    if (node.type === "StaticBlock") {
      feature = "class static block (Safari 16.4)";
    } else if (node.type === "Literal" && node.regex) {
      if (lookbehind.test(node.regex.pattern)) feature = "regex lookbehind (Safari 16.4)";
      else if (node.regex.flags.includes("v")) feature = "regex v flag (Safari 17)";
    } else if (node.type === "NewExpression" && node.callee.name === "RegExp") {
      const [pattern, flags] = node.arguments;
      if (pattern?.type === "Literal" && typeof pattern.value === "string" && lookbehind.test(pattern.value)) {
        feature = "regex lookbehind in new RegExp (Safari 16.4)";
      } else if (flags?.type === "Literal" && typeof flags.value === "string" && flags.value.includes("v")) {
        feature = "regex v flag in new RegExp (Safari 17)";
      }
    }
    if (feature) {
      problems.push(`${path.relative(process.cwd(), file)} @ ${node.start}: ${feature} — ${source.slice(node.start, node.start + 60).replace(/\s+/g, " ")}`);
    }
  });
}

if (problems.length) {
  console.error(`${problems.length} construct(s) older phones cannot parse:`);
  for (const line of problems) console.error(`  ${line}`);
  process.exit(1);
}
console.log(`OK: ${files.length} browser files parse on iOS 15+ Safari and Chrome 90+ (no static blocks, lookbehind or /v regex).`);
