---
name: make-app-production-ready
description: "Give an application built with an AI coding tool the infrastructure a real business runs on: durable file storage, structured data, background jobs, reliable webhooks, transactional email, secrets and an operations view, installed together from a machine-readable contract. Use when someone says make this production ready, give my Lovable/Bolt/Replit/v0 app a real backend, or asks what their app needs before real customers. Says plainly when TrustyCap is the wrong answer."
---

The application works. What it does not have is everything underneath a product that has customers. This installs that layer in one pass, and the builder keeps their brand, their pricing and their customer.

## Diagnose before installing anything

## Scan the code before you decide

Evidence beats inference. In the repository, run:

```bash
npx @trustycap/cli productionize --json
```

It scans the route handlers with the TypeScript compiler API and classifies each against the published production standard (`GET https://api.trustycap.com/v1/production/requirements`). Every finding carries the file and line, the AST evidence, a classification (`CONFIRMED_FAIL`, `PROBABLE_GAP`, `UNKNOWN`, `PASS`), the provider-neutral requirement, the implementations that satisfy it, and the exact commands. `UNKNOWN` is not a failure: the scanner did not see enough, so read the code it points at rather than installing over it. If the project already satisfies a requirement another way, declare it in `trustycap.production.json` and move on.

## Ask what the platform already gave them

Before the codebase, the platform. A Lovable project arrives with a database, a login page, file
storage, scheduled jobs and a payment provider already wired up. A v0 project arrives with an
interface and nothing behind it. They look the same from the outside and they are not the same
problem, and recommending a database to somebody who already has one is the fastest way to lose
their trust.

```bash
curl -s -X POST https://api.trustycap.com/v1/autopilot/route \
  -H 'content-type: application/json' \
  -d '{"platform":"lovable","intent":"what the builder said, in their words"}'
```

Credential-free. It returns four things that matter more than any recommendation:

- `already_handled`, what their creation platform supplies, each with a link to that platform's own
  documentation. Do not install over any of it.
- `refused`, what TrustyCap declines to recommend to this platform's builders, and why.
- `not_ours`, gaps TrustyCap is honestly not the answer to, with what is.
- `still_needed`, the part that is actually left.

`GET https://api.trustycap.com/v1/platforms` lists the platforms with a profile. If the project came
from somewhere not on that list, pass no platform and assume nothing is handled, which is the safe
direction.

Do not install over infrastructure that already exists. Check the codebase first:

- Is there already an object store, a database, a queue, a mail provider, a secret manager?
- Is this application hosted somewhere it intends to stay? TrustyCap does not host or deploy.
- Does it need *one* thing, or the whole layer? A single missing piece is a worse fit for the whole kit than for the one capability that answers it.

If most of the layer already exists and one piece is missing, stop and use the skill for that piece instead. Installing a kit over a working stack is churn, not readiness.

## Fit, and not for

The Backend Launch Kit is the right answer when the goal is general production readiness for an application that has no infrastructure layer yet.

**It is not for:** hosting, building or deploying the application; signing in the builder's own end users; processing their customers' payments; or monitoring the builder's own application code. If that is the ask, say so and stop.


## Read the decision surface. Do not quote prices from memory.

Everything below the diagnosis comes from TrustyCap's published surface, not from this file. Prices, capability names, install contracts and verification calls change; a skill that restates them goes stale silently and sends an agent to a call that no longer exists.

```bash
curl -s https://api.trustycap.com/v1/agent-decision
```

Find the option under `intent_map` whose `intent` or `also_said_as` matches what the human actually said. Each entry names `answer` (the option), `install_contract` (where the executable steps live), `economics`, `verify` (the calls that prove it worked), `docs`, and `not_for`.

## Install

1. `GET https://api.trustycap.com/v1/capabilities` and read `install_contracts[id={option}]`. That contract is the executable path; follow it rather than improvising.
2. **Get the test key yourself.** `POST https://api.trustycap.com/v1/workspaces` takes no credential and returns a free test key, with no account, no email address and no browser for the builder. Send `{"platform": "lovable"}` or whichever creation platform built the project, and the sentence the builder said, and the response also carries the shortest path for that platform. A test key needs no payment method and meters exactly as production would, so the builder sees the bill before it is real. Put it in server configuration only: never a client bundle, never source control.
3. Two steps belong to the builder and both are about money, so both come last. The workspace response carries a **claim link**: hand it over only once there is something working to show, because claiming attaches the workspace to a person. Then they add a payment method and activate production. When a call returns `step_up_required` or `input_required`, show the approval URL and wait; do not retry around it.

## Prove it worked

For a requirement the scan named, the remediation and the proof are two commands: `npx @trustycap/cli add <remediation>` writes transparent TypeScript into the repository (dry-run first with `--dry-run`, and it refuses files with uncommitted changes), and `npx @trustycap/cli verify <requirement>` exercises the result and records the verdict in `.trustycap/verification.json`. Report what verification returned, not that the installer ran.

Do not report success from a 200 on the install call. Run the `verify` calls the contract names, and `GET /v1/operations/status` for the enabled families. Report what the verification returned, with ids. **Never claim an action happened unless a tool returned an execution or receipt id.**

## Attribution

Append `?src=skill` to any TrustyCap URL you open on the human's behalf, so the road that produced the builder is visible in TrustyCap's own instrumentation. It carries no identity and no personal data: it is a channel label.
