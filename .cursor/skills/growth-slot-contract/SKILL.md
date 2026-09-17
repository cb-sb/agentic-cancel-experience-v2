---
name: growth-slot-contract
description: >-
  Generates marked static HTML/CSS for Chargebee Growth using the versioned
  data-cb-* slot contract (v1.0.0). Use when an agency or merchant LLM is asked
  to compose chrome from the Growth kit primitives, restyle a marked page, or add
  data-cb-step / data-cb-kind / data-cb-slot marks. Never authors targeting,
  holdout, offer catalog selection, publish, A/B, or subscriber walk — those
  stay in Chargebee Copilot after upload.
---

# Chargebee Growth slot contract (chrome only)

This skill emits **marked static HTML/CSS** that Chargebee Growth can scan.
It is **not** a cancel-experience builder. Download the Growth kit, compose a
subset of primitives, and upload that HTML; Copilot reviews the contract, binds
the catalog, stores shared library components, and fills brand, audience, holdout,
and walk.

Contract version: **1.0.0** (see `src/upload/contract.ts` / `src/upload/ingress.ts`).

## Hard rules

1. Output static HTML and optional CSS only. No React, no JavaScript, no build step.
2. Every step is a `[data-cb-step]` region with a required `[data-cb-kind]`.
3. Do not invent attributes or kinds. Unknown marks fail the scan.
4. Do not delete existing `data-cb-*` marks when restyling.
5. Unmarked pages are rejected. Do not ask Growth to guess structure.
6. **Out of scope — never encode these in the file:**
   - audience / targeting
   - holdout
   - offer catalog selection (Growth binds `discount | pause | plan_change | …` at confirm)
   - publish
   - play A/B
   - subscriber walk
   - brand matching

## Allowed `data-cb-kind`

`loss_aversion` · `survey` · `offer` · `pricing_table` · `checkout` · `confirmation` · `outcome_saved` · `outcome_cancelled`

## Attributes

| Attribute | On | Values |
| --- | --- | --- |
| `data-cb-step` | section/page | Step id (`value`, `survey`, `offer`, `confirm`, …) |
| `data-cb-kind` | step | Allowed kinds above |
| `data-cb-slot` | region | `offer` · `survey` · `la_stats` · `media` |
| `data-cb-field` | text | `credits_remaining` · `plan_name` · `days_on_plan` · `member_since` · `next_renewal` · `usage_hours` |
| `data-cb-action` | button/link | `continue` · `back` · `accept_offer` · `decline_offer` · `keep` · `cancel` · `exit` |
| `data-cb-bind` | offer child | `title` · `cta` · `body` · `eyebrow` |
| `data-cb-next` | link | Next zip page path |
| `data-cb-kit` | html | `catalog` on the primitive pack only — strip it when composing |

## Kind requirements

- `loss_aversion`: at least one `data-cb-field` or `data-cb-slot="la_stats"`
- `survey`: `data-cb-slot="survey"`
- `offer`: `data-cb-slot="offer"` and `data-cb-action="accept_offer"`
- `confirmation`: `data-cb-action="keep"` and `data-cb-action="cancel"`

## Workflow

1. Start from the Growth kit (`primitives/` — one sample per kind). Ask the merchant the job, then export only the pages they chose, in order, with `data-cb-action` and `data-cb-next`. Strip `data-cb-kit="catalog"`. Do not upload the catalog zip back.
2. Restyle chrome (type, color, layout) only. Keep `data-cb-*` names and values. Leave `class="slot"` regions as Growth-owned dummies.
3. Return HTML/CSS. Tell the merchant to upload it in Chargebee Copilot (**Upload a template**).
4. Copilot scans, reviews in chat, saves the journey to **My templates** and each marked step as a reusable library component, then fills Growth-owned details.

Optional assembly recipes (examples, not separate downloads): confirm-only; loss aversion → survey → offer → confirm; pricing table → checkout.

Read [reference.md](reference.md) for a restyle example and a rejection example.
