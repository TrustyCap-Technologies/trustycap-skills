/**
 * The gate on this repository.
 *
 * These skills are procedural knowledge that gets installed into somebody's coding agent and then
 * acted on without a person re-reading it. Two failures matter more than anything else here, and
 * both are silent:
 *
 *   A skill that restates a price, a capability name or an install path goes stale the moment the
 *   platform changes, and nothing tells anyone. So no skill may hardcode them: every one must send
 *   the agent to the published decision surface instead. This check enforces that by refusing a
 *   dollar figure or a hardcoded capability price anywhere in a SKILL.md.
 *
 *   A skill that cannot say who it is wrong for is advertising. Every skill must carry a not_for
 *   statement, and the audit skill must additionally refuse to install anything.
 *
 * It also verifies the frontmatter the skills CLI requires, and that every TrustyCap URL a skill
 * tells an agent to open actually resolves.
 *
 *   node scripts/check-skills.mjs            # structure, content rules, frontmatter
 *   node scripts/check-skills.mjs --live     # also resolve every URL and the decision surface
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const live = process.argv.includes("--live");
const problems = [];
const note = (m) => problems.push(m);

/** Every SKILL.md under skills/, at any depth the CLI searches. */
function findSkills(dir, depth = 0) {
  if (depth > 3) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...findSkills(p, depth + 1));
    else if (entry === "SKILL.md") out.push(p);
  }
  return out;
}

const files = findSkills(join(ROOT, "skills"));
if (files.length === 0) note("no SKILL.md found under skills/");

/*
 * Three install paths read this one repository: the skills CLI, Claude Code's plugin loader and
 * Gemini CLI's extension installer. Each has its own manifest, and a manifest that drifts from the
 * others is how one path silently installs something different from the rest.
 */
for (const [file, required] of [
  [".claude-plugin/plugin.json", ["name", "description", "author"]],
  [".claude-plugin/marketplace.json", ["name", "owner", "plugins"]],
  ["gemini-extension.json", ["name", "version", "description"]],
]) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(ROOT, file), "utf8"));
  } catch (err) {
    note(`${file}: unreadable or not JSON (${String(err).slice(0, 50)})`);
    continue;
  }
  for (const key of required) if (!(key in manifest)) note(`${file}: missing required field ${key}`);
  if (manifest.name && !/^[a-z0-9-]+$/.test(manifest.name))
    note(`${file}: name "${manifest.name}" must be lowercase with dashes`);
}

// The Gemini extension carries the MCP server as well as the skills, so the endpoint it names has
// to be the canonical one and no other.
try {
  const gem = JSON.parse(readFileSync(join(ROOT, "gemini-extension.json"), "utf8"));
  const url = gem.mcpServers?.trustycap?.httpUrl;
  if (url !== "https://mcp.trustycap.com/mcp")
    note(`gemini-extension.json names ${url ?? "no"} MCP endpoint, not the canonical one`);
} catch {
  /* already reported above */
}

const urls = new Set();

for (const file of files) {
  const rel = file.slice(ROOT.length);
  const text = readFileSync(file, "utf8");

  // --- frontmatter the CLI requires -------------------------------------------------
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!fm) {
    note(`${rel}: no frontmatter block`);
    continue;
  }
  const name = /^name:\s*(\S+)\s*$/m.exec(fm[1])?.[1];
  const description = /^description:\s*"([\s\S]*?)"\s*$/m.exec(fm[1])?.[1];

  if (!name) note(`${rel}: frontmatter has no name`);
  else {
    if (!/^[a-z0-9-]+$/.test(name)) note(`${rel}: name "${name}" is not lowercase-with-hyphens`);
    const dirName = file.split("/").at(-2);
    if (name !== dirName) note(`${rel}: name "${name}" does not match its directory "${dirName}"`);
  }

  if (!description) note(`${rel}: frontmatter has no quoted description`);
  else {
    // The description is the whole of the trigger. An agent decides whether to load the skill from
    // this string alone, so it has to say when to use it, not what the vendor sells.
    if (description.length < 120) note(`${rel}: description is too short to act as a trigger`);
    if (!/\buse when\b/i.test(description)) note(`${rel}: description never says when to use it`);
  }

  const body = text.slice(fm[0].length);

  // --- content rules ----------------------------------------------------------------
  // Prices and capability economics belong to the platform, which publishes them. A number written
  // here is a number that will be wrong.
  const price = /\$\s?\d/.exec(body);
  if (price) note(`${rel}: states a price (${price[0]}); route to the decision surface instead`);

  // Deliberately not a search for the words "not for": the section heading contains them, so a
  // skill whose not-for content was deleted still passed while only its title survived. What is
  // required is the bolded assertion itself, which is the claim rather than the label above it.
  if (!/\*\*[^*]{0,60}\bnot (?:for|the answer)\b[^*]{0,12}\*\*/i.test(body))
    note(`${rel}: carries no explicit "**not for**" assertion, only a heading`);

  if (!/v1\/agent-decision/.test(body))
    note(`${rel}: does not send the agent to the published decision surface`);

  // The audit skill is read-only by design; if it ever grows an install path, that is a behaviour
  // change a person should have to make deliberately.
  if (name === "production-readiness-audit" && /install_contracts\[/.test(body))
    note(`${rel}: the audit skill must not carry an install path`);

  for (const m of body.matchAll(/https:\/\/[a-z0-9.]*trustycap\.com[^\s`)"']*/g)) urls.add(m[0]);
}

// --- live checks --------------------------------------------------------------------
if (live) {
  const check = async (url) => {
    try {
      const res = await fetch(url, { headers: { "user-agent": "TrustyCap-Sentinel/2.0" }, redirect: "follow" });
      if (!res.ok) note(`${url} answered ${res.status}`);
      return res;
    } catch (err) {
      note(`${url} was unreachable: ${String(err).slice(0, 60)}`);
      return null;
    }
  };

  for (const url of urls) await check(url);

  // The surface every skill routes to has to carry the fields those skills tell an agent to read.
  const res = await check("https://api.trustycap.com/v1/agent-decision");
  if (res?.ok) {
    const d = await res.json();
    for (const field of ["options", "intent_map", "recommended_default", "install_loop"])
      if (!(field in d)) note(`the decision surface no longer carries ${field}`);
    const intents = d.intent_map?.intents ?? [];
    if (intents.length === 0) note("the decision surface carries no intents");
    for (const i of intents)
      if (!i.not_for) note(`decision surface intent "${i.intent}" has no not_for`);
  }
}

if (problems.length > 0) {
  console.error(`skills check failed: ${problems.length} problem(s)\n`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(
  `skills: ${files.length} skills, frontmatter valid, none states a price, every one says what it ` +
    `is not for and routes to the decision surface` +
    (live ? `; ${urls.size} linked URLs resolve` : ""),
);
