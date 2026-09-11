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

/*
 * The command every install path ends in. On 2026-09-09 seven skills told an agent to run
 * `npx trustycap`, a package that has never existed on npm, and every agent that followed them
 * failed on its first command while every link check here stayed green. The CLI is @trustycap/cli.
 * So a skill may name exactly two things after `npx`: the skills CLI that installs it, and the
 * canonical TrustyCap CLI. Live, that CLI has to resolve on the registry and carry the `trustycap`
 * binary the skills invoke, so a rename or an unpublish fails here rather than in a builder's shell.
 */
const CANONICAL_CLI = "@trustycap/cli";
const CLI_BINARY = "trustycap";
const npxPackages = new Set();

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

  for (const m of body.matchAll(/\bnpx\s+(?:-y\s+)?(@?[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9._-]+)?)/g)) {
    const pkg = m[1];
    if (pkg === "skills") continue;
    if (pkg !== CANONICAL_CLI)
      note(`${rel}: runs \`npx ${pkg}\`; the only CLI a skill may name is ${CANONICAL_CLI}`);
    npxPackages.add(pkg);
  }

  // The method matters. A skill that tells an agent to POST to a route and a checker that GETs it
  // are testing different things, and the checker will be wrong first: /v1/workspaces is POST only
  // and answers 404 to a GET, which read as a dead link for a route that was working perfectly.
  for (const m of body.matchAll(
    /(?:\b(POST|GET|PUT|PATCH|DELETE)\s+|-X\s+(POST|GET|PUT|PATCH|DELETE)\b[^\n]{0,80}?)?(https:\/\/[a-z0-9.]*trustycap\.com[^\s`)"']*)/g,
  )) {
    const method = (m[1] ?? m[2] ?? "GET").toUpperCase();
    urls.add(`${method} ${m[3]}`);
  }
}
if (!npxPackages.has(CANONICAL_CLI)) note(`no skill names ${CANONICAL_CLI}; the install path has gone missing`);

// --- live checks --------------------------------------------------------------------

/**
 * The bodies a POST route needs, and what its answer has to contain.
 *
 * A route a skill tells an agent to POST to is only proven by posting to it. Every entry here is a
 * real call against production with a real assertion on the shape that matters, because a 200 with
 * the wrong body is the failure these skills would actually suffer from.
 *
 * The user agent is the whole safety story for the one route that writes. TrustyCap classifies any
 * `TrustyCap-` prefixed caller as itself, and a workspace provisioned by one is labelled
 * internal_proof when it is created, which puts it outside every external-builder number by
 * construction rather than by anybody remembering. It is test mode only, it can never hold a live
 * key, and its claim link expires unclaimed.
 */
const PROBE = {
  "/v1/workspaces": {
    body: { name: "Skills live check", platform: "claude_code", origin: "skill" },
    expect: 201,
    assert: (d) => {
      const wrong = [];
      if (!/^org_/.test(String(d.workspace_id ?? ""))) wrong.push("workspace_id");
      if (!/^app_/.test(String(d.application_id ?? ""))) wrong.push("application_id");
      if (!/^sk_test_/.test(String(d.api_key ?? ""))) wrong.push("a test api_key");
      if (!String(d.claim_url ?? "").includes("/claim/")) wrong.push("claim_url");
      if (d.claimed !== false) wrong.push("claimed: false");
      return wrong;
    },
    // The per-address ceiling refusing the call is the other property this route has to hold, and
    // it proves the same thing a 201 does: the route is mounted and it is not answering 404.
    tolerate: [429],
  },
  "/v1/autopilot/route": {
    body: { platform: "lovable", intent: "somewhere to keep customer bookings" },
    expect: 200,
    assert: (d) => {
      const wrong = [];
      if (!Array.isArray(d.already_handled)) wrong.push("already_handled");
      if (!Array.isArray(d.still_needed)) wrong.push("still_needed");
      if (!Array.isArray(d.refused)) wrong.push("refused");
      // The one thing this surface exists to do. A Lovable build has a database already.
      if (!(d.refused ?? []).some((r) => r.target === "data")) wrong.push("a refusal for the data family");
      return wrong;
    },
    tolerate: [],
  },
  "/v1/guide/compose": {
    body: { intent: "bookings, files and reminders", platform: "v0" },
    expect: 200,
    assert: (d) => {
      const wrong = [];
      if (!Array.isArray(d.capabilities) || d.capabilities.length === 0) wrong.push("capabilities");
      if (!Array.isArray(d.excluded)) wrong.push("excluded");
      if (!Array.isArray(d.install?.steps) || d.install.steps.length === 0) wrong.push("install.steps");
      return wrong;
    },
    tolerate: [],
  },
};

if (live) {
  const UA = "TrustyCap-Skills-Check/1.0";

  const check = async (url, method = "GET") => {
    const path = (() => {
      try {
        return new URL(url).pathname;
      } catch {
        return "";
      }
    })();
    const probe = method === "POST" ? PROBE[path] : null;
    if (method !== "GET" && !probe) {
      // Never silently skipped. A skill that starts naming a new POST route has to bring a probe
      // with it, or this says so rather than leaving the route untested and looking green.
      note(`${method} ${url} has no probe; add one to PROBE in this file rather than leaving it unchecked`);
      return null;
    }
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "user-agent": UA,
          ...(probe ? { "content-type": "application/json" } : {}),
        },
        ...(probe ? { body: JSON.stringify(probe.body) } : {}),
        redirect: "follow",
      });
      if (!probe) {
        if (!res.ok) note(`GET ${url} answered ${res.status}`);
        return res;
      }
      if (probe.tolerate.includes(res.status)) return res;
      if (res.status !== probe.expect) {
        note(`${method} ${url} answered ${res.status}, expected ${probe.expect}`);
        return res;
      }
      const wrong = probe.assert(await res.json().catch(() => ({})));
      if (wrong.length) note(`${method} ${url} answered ${res.status} without ${wrong.join(", ")}`);
      return res;
    } catch (err) {
      note(`${method} ${url} was unreachable: ${String(err).slice(0, 60)}`);
      return null;
    }
  };

  for (const entry of urls) {
    const [method, ...rest] = entry.split(" ");
    await check(rest.join(" "), method);
  }

  // The package a skill tells an agent to run has to exist, today, with the binary the skill invokes.
  for (const pkg of npxPackages) {
    const res = await check(`https://registry.npmjs.org/${encodeURIComponent(pkg)}`);
    if (!res?.ok) continue;
    const doc = await res.json();
    const latest = doc["dist-tags"]?.latest;
    const bin = latest ? doc.versions?.[latest]?.bin ?? {} : {};
    if (!latest) note(`${pkg} has no latest version on npm`);
    else if (!(CLI_BINARY in bin))
      note(`${pkg}@${latest} does not carry the \`${CLI_BINARY}\` binary the skills invoke (bin: ${Object.keys(bin).join(", ") || "none"})`);
  }

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
    `is not for and routes to the decision surface; every install command runs ${CANONICAL_CLI}` +
    (live
      ? `; ${urls.size} linked surfaces answer the method the skills use, ${Object.keys(PROBE).length} of them ` +
        `POST contracts asserted against production, and ${CANONICAL_CLI} resolves on npm with the ${CLI_BINARY} binary`
      : ""),
);
