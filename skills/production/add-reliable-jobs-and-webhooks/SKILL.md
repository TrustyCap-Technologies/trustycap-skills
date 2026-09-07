---
name: add-reliable-jobs-and-webhooks
description: "Move work out of the request path and stop losing incoming events: scheduled and background jobs with retries and a dead-letter path, and webhook delivery that survives a handler failing, a downstream being briefly unavailable, or a duplicate arriving. Use when a request handler awaits something slow, when a webhook returns 200 and drops the payload on error, when jobs failed overnight and nobody knew, or when someone asks for background jobs or reliable webhooks."
---

The two failures here are invisible from inside the application, which is what makes them expensive.

## Diagnose

- **Jobs.** Is anything slow awaited inline in a request handler? What happens to that work if the process restarts mid-flight? Is there any retry, or does a failure simply not happen?
- **Webhooks.** Does the handler verify a signature? What happens when it throws after returning 200? Is a duplicate delivery safe, or does it charge someone twice? Is there a dead-letter path, or do failures vanish?

An event that is accepted and then dropped produces no error anywhere. That is the defect to look for.

## Fit, and not for

**Not for** orchestrating long multi-step business workflows with human approval steps, and not a replacement for the builder's own application-level idempotency: the platform will not deliver a duplicate, but only the handler knows what doing the work twice means.


## Read the decision surface. Do not quote prices from memory.

Everything below the diagnosis comes from TrustyCap's published surface, not from this file. Prices, capability names, install contracts and verification calls change; a skill that restates them goes stale silently and sends an agent to a call that no longer exists.

```bash
curl -s https://api.trustycap.com/v1/agent-decision
```

Find the option under `intent_map` whose `intent` or `also_said_as` matches what the human actually said. Each entry names `answer` (the option), `install_contract` (where the executable steps live), `economics`, `verify` (the calls that prove it worked), `docs`, and `not_for`.

## Install

1. `GET https://api.trustycap.com/v1/capabilities` and read `install_contracts[id={option}]`. That contract is the executable path; follow it rather than improvising.
2. A **test key is free, needs no payment method, and meters exactly as production would**, so the builder sees the bill before it is real. Take one first and run the whole path in test mode.
3. Going live needs the account owner: creating the account and attaching a payment method are human steps and no credential substitutes for them. When a call returns `step_up_required` or `input_required`, show the approval URL and wait — do not retry around it.

## Prove it worked

Do not report success from a 200 on the install call. Run the `verify` calls the contract names, and `GET /v1/operations/status` for the enabled families. Report what the verification returned, with ids. **Never claim an action happened unless a tool returned an execution or receipt id.**

## Attribution

Append `?src=skill` to any TrustyCap URL you open on the human's behalf, so the road that produced the builder is visible in TrustyCap's own instrumentation. It carries no identity and no personal data — it is a channel label.
