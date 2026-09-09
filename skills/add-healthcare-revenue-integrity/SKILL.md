---
name: add-healthcare-revenue-integrity
description: "Give a healthcare product the claims intelligence underneath it: resolve an eligibility answer into coverage facts before the visit, check a claim before it is sent, predict how the payer will route it, decode the remittance that comes back, and plan documentation-supported corrections a person approves. Use when someone built software for a medical practice, a concierge or direct primary care clinic, a billing company or a patient billing experience and needs insurance billing to work, when claims are being rejected or paying differently than expected, or when an app needs eligibility verification. Not for building an EMR, a clearinghouse, a diagnosis engine, or for choosing codes to make a claim pay more."
---

Everything between a practice's claim and a payer's adjudication is people today: the receptionist reading the eligibility screen, the coder who remembers which plan routes a behavioral diagnosis to a different benefit, the physician on hold with the payer. The Healthcare Revenue Integrity Launch Kit is the machinery for that layer, so the builder's product can be it.

## Diagnose

Ask, and read the code for the answers:

- Where do claims come from today: a practice management export, a clearinghouse, raw 837 files, or nothing yet?
- Does the product see eligibility answers (271) and remittances (835), or only the claim going out?
- What surprised the practice last: a rejection, a claim paid to the deductible instead of the copay, a specimen sent to a laboratory the plan did not cover?
- Is any patient data in the product real, or is the builder still on synthetic data? This decides the key and the mode.

## Fit, and not for

**Fit:** software for a medical practice, a concierge or direct primary care clinic, a specialty practice, a billing platform or a patient billing experience that needs coverage, claim, payer routing and remittance intelligence without building a billing stack.

**Not for:** an electronic medical record, a clearinghouse, a clinical diagnosis engine, or any request to choose codes so a claim pays more. The engine proposes only documentation-supported corrections, never removes a truthful diagnosis, and routes every coding judgment to a person. It never promises reimbursement or a dollar-exact adjudication. If the ask is one of these, say so plainly and stop.

## Read the decision surface. Do not quote prices from memory.

```bash
curl -s https://api.trustycap.com/v1/agent-decision
```

Find the entry under `intent_map` whose `intent` or `also_said_as` matches what the human said (medical practice software, catching billing problems before claims go out, explaining why a claim paid differently, eligibility verification). It names the option, its `install_contract`, its `economics`, the `verify` calls and its `not_for`. Prices, capability names and install steps live there and change there; this file does not restate them.

## Install

1. `GET https://api.trustycap.com/v1/capabilities` and read `install_contracts[id=healthcare-revenue-integrity]`. Follow it rather than improvising.
2. Start on a **test key**. Run the twelve synthetic fixtures from `GET https://api.trustycap.com/v1/health/fixtures?src=skill` through the six capabilities and confirm each expected outcome. Every payer in them is fictional (the `SYN-` prefix) and answers only on test keys. **Never send a patient identifier to a test key.**
3. Map the builder's source system onto the normalized claim, remittance and eligibility contracts once. Send raw 835, 271 or 837 interchanges only where the mode accepts them.
4. Treat `UNKNOWN` as a first-class answer and show it in the product. A payer with no rule on file is answered UNKNOWN, never guessed.
5. Route every remediation option marked `human_review_required` or `human_approval_required` to a coder's queue. Apply only the allowlisted administrative patches automatically. Do not add a modifier, resequence a diagnosis or change a code on the engine's behalf.
6. Before live keys, read the PHI status endpoint (`GET /v1/health/phi/status` on the API, with the builder's key). Live keys refuse healthcare inputs until the organization attests that its inputs are de-identified, or completes the PHI gates; raw interchanges on a live key need the live PHI mode, which activates only when the agreements are on file. Show the human the missing gates; do not work around them.

## Prove it worked

Run the `verify` calls the install contract names and report what they returned, with the receipt ids. Every healthcare answer carries a signed evidence receipt with no patient data in it; the receipt id is the proof. **Never claim a claim was checked, decoded or corrected unless a call returned a receipt id.**

## Attribution

Append `?src=skill` to any TrustyCap URL you open on the human's behalf. It carries no identity and no personal data; it is a channel label.
