import { CONTRACT_VERSION } from './contract'
import sharedCss from './sample/shared.css?raw'
import singleHtml from './sample/single.html?raw'

/** Short contract prompt a merchant pastes into ChatGPT / Claude / Cursor. */
export const LLM_KIT_INSTRUCTIONS = `You are restyling Chargebee Growth chrome. You are not inventing a cancel product, and you are not filling targeting.

Hard rules:
1. Start from the starter kit below. Keep every data-cb-* attribute exactly.
2. Static HTML and optional CSS only. No React, no JavaScript, no build step.
3. Allowed data-cb-kind values: loss_aversion, survey, offer, pricing_table, checkout, confirmation, outcome_saved, outcome_cancelled.
4. Do not encode audience, holdout, offer catalog selection, publish, A/B, subscriber walk, or brand matching.
5. Return the full marked HTML (and CSS if you changed it). The merchant will upload it to Chargebee Growth. Unmarked HTML is rejected — do not ask Growth to guess.

Contract version: ${CONTRACT_VERSION}`

export function kitClipboardPayload(html = singleHtml, css = sharedCss): string {
  return `${LLM_KIT_INSTRUCTIONS}

--- growth-starter.html ---

${html}

--- shared.css ---

${css}
`
}
