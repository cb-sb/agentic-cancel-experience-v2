/**
 * Run Copilot setup evals against the shipped interpreter.
 *
 *   npm run eval:setup
 *
 * Exit 1 only when a `pass`-grade case misses gold or breaks a spine invariant.
 * `gap` and `stretch` cases print as product signal.
 */

import { compileJourney } from '../src/journey/compile'
import { interpret } from '../src/journey/intake'
import { EMPTY_JOURNEY } from '../src/journey/types'
import {
  compileCheck,
  runAllSetupEvals,
  SETUP_EVAL_CASES,
  type EvalResult,
} from '../src/eval/setupEvals'

function line(r: EvalResult): string {
  const tag = r.gates ? 'FAIL' : r.status === 'pass' ? 'PASS' : r.grade.toUpperCase()
  const gold = r.misses.map((m) => `${m.field}: want ${m.expected}, got ${m.got}`).join('; ')
  const inv = r.invariants.map((i) => `${i.rule}: ${i.detail}`).join('; ')
  const extra = [gold, inv].filter(Boolean).join(' | ')
  return extra
    ? `[${tag}] ${r.id}  "${r.prompt}"  ${extra}`
    : `[${tag}] ${r.id}  "${r.prompt}"  → ${r.got.template} ${r.got.shell} offers=${r.got.offers.join(',') || '—'} matched=${r.got.brandMatched}`
}

const results = runAllSetupEvals()

for (const r of results) {
  const after = interpret(r.prompt, EMPTY_JOURNEY)
  const compiled = compileCheck(after.file)
  if (after.changed && !compiled.ok) {
    console.log(`[FAIL] ${r.id}  compile: ${compiled.detail}`)
  }
  // Touch compileJourney so a broken import fails the script even on empty files.
  if (after.file.steps.length) compileJourney(after.file)
  console.log(line(r))
}

const gated = results.filter((r) => r.gates)
const gaps = results.filter((r) => r.grade !== 'pass')
const passGrade = results.filter((r) => r.grade === 'pass')
const passOk = passGrade.filter((r) => r.status === 'pass').length

console.log('')
console.log(
  `${SETUP_EVAL_CASES.length} cases  ·  ${passOk}/${passGrade.length} pass-grade ok  ·  ${gaps.length} gap/stretch  ·  ${gated.length} gating fail(s)`,
)

if (gated.length) {
  console.error('\nGating failures (shipped parser should land these):')
  for (const r of gated) console.error(`  - ${r.id}`)
  process.exit(1)
}
