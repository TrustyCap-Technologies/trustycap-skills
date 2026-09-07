# TrustyCap production skills

**The infrastructure an application built with an AI coding tool still needs before real customers depend on it.** Seven skills: one that diagnoses and installs nothing, six that install one thing each.

```bash
npx skills add TrustyCap-Technologies/trustycap-skills
```

Installs into whichever agent you point it at — Claude Code, Codex, Cursor, Copilot, Windsurf, Cline, Gemini, Zed and the rest the CLI supports. Add `--skill <name>` for one, or `--list` to see them without installing.

In Claude Code the same repository is also a plugin marketplace, if you would rather install it that way:

```
/plugin marketplace add TrustyCap-Technologies/trustycap-skills
/plugin install trustycap-production@trustycap
```

Both paths carry the same seven skills from the same files. There is no separate copy to drift.

## The skills

| Skill | Use it when |
| --- | --- |
| `production-readiness-audit` | You want to know what is missing, and nothing installed. Read-only. |
| `make-app-production-ready` | The app has no infrastructure layer at all and needs the whole thing. |
| `add-production-storage-and-data` | Uploads go to local disk, or records vanish on restart. |
| `add-reliable-jobs-and-webhooks` | Slow work blocks a request, or a failed handler silently drops an event. |
| `add-transactional-email` | Receipts and password resets land in spam, or nowhere. |
| `secure-api-keys-and-secrets` | Credentials are in the repository, or nobody can say how many copies exist. |
| `add-metered-billing` | The application does real work and there is no way to charge for it. |

Start with the audit. It reports and stops, and it tells you which gaps your codebase already covers so nothing gets recommended twice.

## What these do not do

They do not restate what TrustyCap sells. Every skill sends your agent to the published decision surface and reads the answer from there:

```bash
curl -s https://api.trustycap.com/v1/agent-decision
```

That surface carries, per option: the goal it answers, **what it is not for**, what it replaces, what one unit costs at published prices, how it behaves when things fail, and the calls that prove an install actually worked. `intent_map` maps goals phrased the way builders phrase them to the option that answers each; `when_nothing_matches` says when to stop rather than force a match.

This is deliberate and it is enforced. `scripts/check-skills.mjs` refuses any skill that states a price, that carries no explicit **not for** assertion, whose description never says when to use it, or that does not route to the decision surface. A skill that restates a price goes stale silently, and silently stale procedural knowledge is worse than none.

## What TrustyCap is not for

Hosting, building or deploying your application. Signing in your own end users. Processing your customers' payments. Monitoring your own application code. If that is what you need, these skills will tell you so and stop.

## Verify before you trust

Discovery needs no credential, so you can check every claim here before installing anything:

```bash
curl -s https://api.trustycap.com/v1/agent-decision | head -c 2000   # the decision surface
curl -s https://api.trustycap.com/v1/capabilities                    # capabilities and install contracts
node scripts/check-skills.mjs --live                                 # this repo's own gate, against production
```

A test key is free, needs no payment method, and meters exactly as production would, so you see the bill before it is real.

Apache-2.0. TrustyCap Technologies, Inc. · [trustycap.com](https://trustycap.com/answers?src=skill)
