import { CONTRACT_VERSION, GROWTH_SLOT_SCHEMA, KIND_REQUIREMENTS, CB_KINDS } from './contract'
import { uid } from '../lib/id'
import { hashFiles } from './hash'
import { writeZip } from './pack'
import type { TemplateArtifact, TemplateArtifactFile } from './types'
import sharedCss from './sample/shared.css?raw'
import lossAversionHtml from './sample/primitives/loss_aversion.html?raw'
import surveyPrimitiveHtml from './sample/primitives/survey.html?raw'
import offerPrimitiveHtml from './sample/primitives/offer.html?raw'
import confirmationHtml from './sample/primitives/confirmation.html?raw'
import pricingTableHtml from './sample/primitives/pricing_table.html?raw'
import checkoutPrimitiveHtml from './sample/primitives/checkout.html?raw'
import outcomeSavedHtml from './sample/primitives/outcome_saved.html?raw'
import outcomeCancelledHtml from './sample/primitives/outcome_cancelled.html?raw'
import valueHtml from './sample/value.html?raw'
import surveyHtml from './sample/survey.html?raw'
import offerHtml from './sample/offer.html?raw'
import confirmHtml from './sample/confirm.html?raw'

export const SAMPLE_ZIP_NAME = 'growth-kit.zip'

export interface KitPrimitive {
  path: string
  html: string
}

/** One marked sample per kind. No data-cb-next — this is not an experience. */
export const KIT_PRIMITIVES: KitPrimitive[] = [
  { path: 'primitives/loss_aversion.html', html: lossAversionHtml },
  { path: 'primitives/survey.html', html: surveyPrimitiveHtml },
  { path: 'primitives/offer.html', html: offerPrimitiveHtml },
  { path: 'primitives/confirmation.html', html: confirmationHtml },
  { path: 'primitives/pricing_table.html', html: pricingTableHtml },
  { path: 'primitives/checkout.html', html: checkoutPrimitiveHtml },
  { path: 'primitives/outcome_saved.html', html: outcomeSavedHtml },
  { path: 'primitives/outcome_cancelled.html', html: outcomeCancelledHtml },
]

function kindRequirementLine(kind: (typeof CB_KINDS)[number]): string {
  const req = KIND_REQUIREMENTS[kind]
  const parts: string[] = []
  if (req.fieldOrLaStats) parts.push('at least one data-cb-field or data-cb-slot="la_stats"')
  for (const slot of req.slots ?? []) parts.push(`data-cb-slot="${slot}"`)
  for (const action of req.actions ?? []) parts.push(`data-cb-action="${action}"`)
  return parts.length ? parts.join('; ') : 'no extra required marks — still needs data-cb-step and data-cb-kind'
}

function kindList(): string {
  return CB_KINDS.map((kind) => `- ${kind}: ${kindRequirementLine(kind)}`).join('\n')
}

export function kitReadme(): string {
  return `# Chargebee Growth kit

This zip is a **primitive catalog**, not an experience. Chargebee hosts the HTML you compose from it.
Do not upload this catalog back. Ask your LLM the job, export only the pages you chose, then drop that HTML.

Contract version: ${CONTRACT_VERSION}

## What to do

1. Paste this pack (or the clipboard prompt) into your own LLM.
2. Tell it the job: one-click leave, fair save, acquire, or a custom subset.
3. It should export **only the primitives you chose**, in order, with \`data-cb-action\` and \`data-cb-next\` on composed pages.
4. Strip \`data-cb-kit="catalog"\` from the composed HTML. That mark means “not an experience.”
5. Upload the composed HTML or zip in Chargebee Growth. Unmarked HTML is rejected.

Chargebee does not open ChatGPT or Claude for you.

## Hard rules

1. Static HTML and optional CSS only. No React, no JavaScript, no build step.
2. Keep every \`data-cb-*\` attribute name and value. You may change classes, layout, and copy **outside** \`data-cb-bind\` / \`data-cb-slot\` regions.
3. Regions with \`class="slot"\` are Growth-owned at confirm. Bracketed text (\`[offer title]\`) is dummy — do not invent catalog offers or survey reasons.
4. Do not invent kinds. Unknown \`data-cb-kind\` fails the scan.
5. Do not encode audience, holdout, offer catalog selection, publish, A/B, subscriber walk, or brand matching.

## Optional assembly recipes (examples, not downloads)

- Confirm only — one-click leave: \`confirmation\`
- Fair save: \`loss_aversion\` → \`survey\` → \`offer\` → \`confirmation\`
- Acquire: \`pricing_table\` → \`checkout\`
- Outcomes are optional slices after confirm: \`outcome_saved\`, \`outcome_cancelled\`

## Kind requirements

${kindList()}

## Files in this pack

${KIT_PRIMITIVES.map((p) => `- ${p.path}`).join('\n')}
- shared.css
- contract.v${CONTRACT_VERSION}.json
- CATALOG
- README.md (this file)
`
}

export function kitContractJson(): string {
  return `${JSON.stringify(GROWTH_SLOT_SCHEMA, null, 2)}\n`
}

export function kitCatalogMarker(): string {
  return `Chargebee Growth primitive catalog. This zip is not an experience.
Ask your LLM to compose an experience, then upload that HTML — not this catalog.
`
}

/** Short contract prompt a merchant pastes into ChatGPT / Claude / Cursor. */
export function kitLlmInstructions(): string {
  const kinds = CB_KINDS.map((kind) => `  - ${kind}: ${kindRequirementLine(kind)}`).join('\n')
  return `You are composing Chargebee Growth chrome from a primitive catalog. You are not inventing targeting, offers, or publish.

This pack is a generic catalog — not a journey. Do not tell the merchant to upload this zip back.

First ask the merchant which job this is:
- one-click leave (confirmation only)
- fair save (value → survey → offer → confirm)
- acquire (pricing table → checkout)
- custom subset of the kinds below

Then export only the primitives they chose, in that order. On composed pages:
- keep every data-cb-* attribute name and value
- add data-cb-action, and data-cb-next / href when a next page exists
- strip data-cb-kit="catalog" — that mark means this file is still a catalog sample
- leave class="slot" regions as dummy ([offer title], [reason]) — Growth binds the catalog after upload

Hard rules:
1. Static HTML and optional CSS only. No React, no JavaScript, no build step.
2. Do not invent kinds. Allowed data-cb-kind values: ${CB_KINDS.join(', ')}.
3. Do not encode audience, holdout, offer catalog selection, publish, A/B, subscriber walk, or brand matching.
4. Return the composed HTML files and CSS. Unmarked HTML is rejected — do not ask Growth to guess.

Kind requirements:
${kinds}

Optional assembly recipes (examples, not separate products):
- Confirm only: confirmation
- Fair save: loss_aversion → survey → offer → confirmation
- Acquire: pricing_table → checkout

Contract version: ${CONTRACT_VERSION}`
}

export function kitClipboardPayload(): string {
  const files = [
    ['README.md', kitReadme()],
    ['CATALOG', kitCatalogMarker()],
    ...KIT_PRIMITIVES.map((p) => [p.path, p.html] as const),
    ['shared.css', sharedCss],
    [`contract.v${CONTRACT_VERSION}.json`, kitContractJson()],
  ]
  return [kitLlmInstructions(), ...files.map(([name, body]) => `--- ${name} ---\n\n${body}`)].join('\n\n')
}

function artifact(files: TemplateArtifactFile[]): TemplateArtifact {
  return {
    id: uid('art'),
    checksum: hashFiles(files),
    version: 1,
    files,
  }
}

/** Catalog zip contents — not a scannable experience. */
export function kitArtifact(): TemplateArtifact {
  return artifact(KIT_PRIMITIVES.map((p) => ({ path: p.path, html: p.html, css: sharedCss })))
}

/** Composed Fair save used only for in-app “scan as-is” demo. Not the catalog. */
export function composedDemoArtifact(): TemplateArtifact {
  return artifact([
    { path: 'value.html', html: valueHtml, css: sharedCss },
    { path: 'survey.html', html: surveyHtml, css: sharedCss },
    { path: 'offer.html', html: offerHtml, css: sharedCss },
    { path: 'confirm.html', html: confirmHtml, css: sharedCss },
  ])
}

export function kitZipBytes(): Uint8Array {
  const encoder = new TextEncoder()
  return writeZip([
    { path: 'README.md', bytes: encoder.encode(kitReadme()) },
    { path: 'CATALOG', bytes: encoder.encode(kitCatalogMarker()) },
    { path: `contract.v${CONTRACT_VERSION}.json`, bytes: encoder.encode(kitContractJson()) },
    { path: 'shared.css', bytes: encoder.encode(sharedCss) },
    ...KIT_PRIMITIVES.map((p) => ({ path: p.path, bytes: encoder.encode(p.html) })),
  ])
}

/** @deprecated Use composedDemoArtifact(). */
export function sampleSingleArtifact(): TemplateArtifact {
  return composedDemoArtifact()
}

/** @deprecated Use composedDemoArtifact(). */
export function sampleZipArtifact(): TemplateArtifact {
  return composedDemoArtifact()
}
