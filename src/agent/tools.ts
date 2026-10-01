import { compileBrand } from '../brand/theme'
import { matchMerchantBrand } from '../brand/matchSite'
import type { JourneyFile, JourneyStepFile, JourneyTemplate, OfferKey } from '../journey/types'
import { isTailKind } from '../journey/types'
import { LIBRARY, startFromTemplate, withLive } from '../journey/templates'
import { playVariants, topSplit } from '../play/resolve'
import { CANCEL_ROUTE, type NavLeafId } from '../shell/nav'
import { useGrowthShell } from '../shell/useGrowthShell'
import { useJourney } from '../store/useJourney'
import { useOrchestration } from '../store/useOrchestration'
import { AUDIENCE_LIBRARY } from '../types/orchestration'
import { openTab } from '../workspace/paneTabs'
import { useCancelSettings } from '../workspace/useCancelSettings'
import { useWorkspace } from '../workspace/useWorkspace'
import type { PaneTab } from '../workspace/useWorkspaceUi'
import { cancelPageEmpty, createCancelPage, moveCancelPage, openCancelPage } from '../concierge/cancelPages'
import { CATALOG_PLANS, type Objective, type OfferCategory } from '../concierge/model'
import { openGrowthExperience } from '../concierge/objective/useGrowthUi'
import { addGrowthExperience, growthExperience, updateGrowthExperience, useGrowthExperiences } from '../concierge/useGrowthExperiences'
import { experienceTabs, usedIn } from '../concierge/useGrowthPlays'
import { useGrowthLibrary } from '../concierge/useGrowthLibrary'
import { cancelReadiness, detailFor, experienceSummaries, ownerOf, parseOwner } from './context'
import { useAgentStore, type OwnerKey, type Triage } from './useAgentStore'

type Input = Record<string, unknown>
type Result = Record<string, unknown>

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

// ---------- where the chat is ----------

/** The experience a tool acts on: the one named, or the chat's own. */
function targetOwner(chatId: string, id?: unknown): OwnerKey | null {
  const given = str(id)
  if (given) {
    if (useWorkspace.getState().threads.some((t) => t.id === given)) return `cancel:${given}`
    if (useGrowthExperiences.getState().items.some((x) => x.id === given)) return `growth:${given}`
    return null
  }
  const owner = ownerOf(chatId)
  return owner === 'home' ? null : owner
}

export function openOwner(owner: OwnerKey) {
  const o = parseOwner(owner)
  if (o.kind === 'cancel') {
    const route = useGrowthShell.getState().route
    if (route !== CANCEL_ROUTE || useWorkspace.getState().activeId !== o.id) openCancelPage(o.id)
  }
  if (o.kind === 'growth') {
    const x = growthExperience(o.id)
    if (x) openGrowthExperience(experienceTabs(x.id)[0] ?? x.objective, x.id)
  }
}

function isBlankOwner(owner: OwnerKey): boolean {
  const o = parseOwner(owner)
  if (o.kind === 'cancel') return cancelPageEmpty(o.id)
  if (o.kind === 'growth') return !growthExperience(o.id)?.refId
  return false
}

/** Parts of Growth this prototype answers with a sample card. */
const SAMPLE_AREA: Record<string, string> = { report: 'reports', renewal: 'renewal', settings: 'settings' }

/** How the merchant asked to start, read from their own words. */
function startFrom(said: string): 'template' | 'upload' | 'described' | null {
  if (/\btemplates?\b/i.test(said)) return 'template'
  if (/\b(upload|import)\b|\bmy own\b|\bown (design|pages?)\b/i.test(said)) return 'upload'
  if (said.trim().split(/\s+/).length >= 8) return 'described'
  return null
}

/** The card a blank experience opens with, so the first step does not depend on the model. */
function firstStep(owner: OwnerKey, said: string): Result {
  const how = startFrom(said)
  const cancel = parseOwner(owner).kind === 'cancel'
  if (how === 'described') return { next: 'Build it from what they said.' }
  const call = !cancel ? 'show_doors' : how === 'upload' ? 'show_kit' : how === 'template' ? 'show_templates' : 'show_doors'
  return { call, next: `Call ${call}.` }
}

/** Moves a Home chat into the experience it just made, so the conversation carries on there. */
function handOff(chatId: string, owner: OwnerKey) {
  const store = useAgentStore.getState()
  if (store.chats[chatId]?.owner === owner) return
  store.moveChat(chatId, owner)
}

function cancelOwner(chatId: string): string | null {
  const owner = ownerOf(chatId)
  const o = parseOwner(owner)
  if (o.kind !== 'cancel') return null
  openOwner(owner)
  return o.id
}

// ---------- cancel page edits ----------

const undoStack: JourneyFile[] = []

function beforeEdit() {
  undoStack.push(useJourney.getState().file)
  if (undoStack.length > 30) undoStack.shift()
}

export function undoLast(): boolean {
  const prev = undoStack.pop()
  if (!prev) return false
  useJourney.getState().replaceFile(prev)
  return true
}

export function landTemplate(template: Exclude<JourneyTemplate, 'none'>) {
  beforeEdit()
  const next = startFromTemplate(useJourney.getState().file, template)
  useJourney.getState().replaceFile({ ...next, steps: withLive(next.steps, true) })
  useOrchestration.setState({ setupDoor: 'library', setupDoorConsumed: true })
  useOrchestration.getState().enterWorkEditor()
  openTab('editor')
}

const OFFER_HEADLINE: Record<OfferKey, string> = {
  discount: '50% off for 3 months',
  pause: 'Take a break instead',
  plan_change: 'Try a smaller plan',
  extension: '1 month on us',
  skip: 'Skip your next bill',
  addon: 'Add what you need',
}

function newStep(kind: 'loss_aversion' | 'survey' | 'offer', offer?: OfferKey): JourneyStepFile {
  const id = `${kind}-${Math.random().toString(36).slice(2, 6)}`
  if (kind === 'offer') return { id, kind, live: true, offer: offer ?? 'discount', headline: OFFER_HEADLINE[offer ?? 'discount'] }
  if (kind === 'survey') return { id, kind, live: true, headline: 'Why are you cancelling?' }
  return { id, kind, live: true, headline: 'Before you go' }
}

// ---------- growth experiences ----------

/** In-app offers and pricing tables get their audience, control, split, order and status from plays. */
const ON_PLAYS =
  'For in-app offers and pricing tables, the audience, control group, split, order and going live are set on the play, in the Acquisition or Expansion tab. Copilot cannot change plays yet, so point the merchant there.'

function growthId(owner: OwnerKey | null): string | null {
  if (!owner) return null
  const o = parseOwner(owner)
  return o.kind === 'growth' ? o.id : null
}

// ---------- approvals (called from the cards) ----------

export function applyControl(chatId: string, input: Input): Result {
  const owner = targetOwner(chatId, input.id)
  const percent = Math.round(Number(input.percent) || 0)
  const gid = growthId(owner)
  if (gid) return { approved: false, error: ON_PLAYS }
  useCancelSettings.getState().setGlobalControl(percent)
  useOrchestration.getState().confirmSetupItem('holdout')
  return { approved: true, globalControl: percent, note: 'Global control applies to every cancel page.' }
}

export function applySplit(chatId: string, input: Input): Result {
  const owner = targetOwner(chatId, input.id)
  const variants = (input.variants as { label: string; refId?: string | null; percent: number }[]) ?? []
  const gid = growthId(owner)
  if (gid) return { approved: false, error: ON_PLAYS }
  if (!cancelOwner(chatId)) return { approved: false, error: 'No cancel page is open.' }
  const orch = useOrchestration.getState()
  let split = topSplit(orch.play)
  if (split && split.mode === 'single') {
    orch.setSplitMode(split.id, 'percent')
    split = topSplit(useOrchestration.getState().play)
  }
  if (split) {
    while (playVariants(useOrchestration.getState().play).length < variants.length) {
      useOrchestration.getState().addVariant(split.id)
    }
    const now = playVariants(useOrchestration.getState().play)
    const percents: Record<string, number> = {}
    now.forEach((v, i) => {
      if (variants[i]) percents[v.branchId] = Math.round(variants[i].percent)
    })
    useOrchestration.getState().setSplitPercents(split.id, percents)
  }
  useOrchestration.getState().confirmSetupItem('experiment')
  openTab('targeting')
  return { approved: true, split: playVariants(useOrchestration.getState().play).map((v) => `${v.label} ${v.percent}%`) }
}

export function publishGaps(chatId: string, input: Input): string[] {
  const owner = targetOwner(chatId, input.id)
  const detail = owner ? detailFor(owner) : undefined
  return ((detail?.leftBeforeLive as string[] | undefined) ?? []).slice(0, 6)
}

export function applyPublish(chatId: string, input: Input): Result {
  const owner = targetOwner(chatId, input.id)
  if (!owner) return { approved: false, error: 'No experience to publish.' }
  const gid = growthId(owner)
  if (gid) return { approved: false, error: ON_PLAYS }
  openOwner(owner)
  if (useOrchestration.getState().play.publishState !== 'live') useOrchestration.getState().togglePublish()
  return { approved: true, status: 'live' }
}

export function applyCreateOffer(input: Input): Result {
  const offer = useGrowthLibrary.getState().addOffer({
    name: String(input.name),
    objective: input.objective as Objective,
    widget: input.widget as never,
    category: input.category as OfferCategory,
    title: String(input.title),
    description: String(input.description),
    cta: String(input.cta),
    value: String(input.value),
    processing: input.processing as never,
    acceptStep: input.acceptStep as never,
    languages: ['English'],
    status: 'published',
  })
  return { approved: true, offerId: offer.id }
}

export function applyUpdateOffer(input: Input): Result {
  const id = String(input.id)
  const patch = Object.fromEntries(Object.entries(input).filter(([k, v]) => k !== 'id' && v !== null && v !== undefined))
  useGrowthLibrary.getState().updateOffer(id, patch)
  return { approved: true, offerId: id }
}

export function archiveBlockers(input: Input): string[] {
  return usedIn(String(input.id))
}

export function applyArchiveOffer(input: Input): Result {
  const id = String(input.id)
  if (usedIn(id).length) return { approved: false, error: `Still used in ${usedIn(id).join(', ')}` }
  useGrowthLibrary.getState().updateOffer(id, { status: 'archived' })
  return { approved: true }
}

export function applyCreatePricingTable(input: Input): Result {
  const plans = CATALOG_PLANS.filter((p) => (input.planIds as string[]).includes(p.id))
  const table = useGrowthLibrary.getState().addPricingTable({
    name: String(input.name),
    objective: input.objective as Objective,
    plans,
    frequency: input.frequency as never,
    hideCurrentPlan: Boolean(input.hideCurrentPlan),
    cta: input.cta as never,
    status: 'published',
  })
  return { approved: true, pricingTableId: table.id }
}

/** update_offer only waits for approval when it touches money or fulfilment. */
export function needsCard(name: string, input: Input): boolean {
  if (name === 'update_offer') return input.value != null || input.processing != null
  return false
}

// ---------- auto tools ----------

export async function runTool(chatId: string, name: string, input: Input, said = ''): Promise<Result> {
  switch (name) {
    case 'triage': {
      const t = input as unknown as Triage
      useAgentStore.getState().setTriage(chatId, t)
      const experience = t.object === 'experience' || (t.object === 'pricing_table' && t.type === 'pricing_table')
      const build = experience && t.action === 'create' && t.type && t.confidence >= 0.7
      if (build) return { ok: true, call: 'create_experience', next: `Call create_experience for a ${t.type}.` }
      const area = SAMPLE_AREA[t.object]
      if (area) return { ok: true, call: 'show_sample', next: `Call show_sample with area ${area}.` }
      return { ok: true }
    }

    case 'navigate': {
      useGrowthShell.getState().go(input.to as NavLeafId)
      return { ok: true, opened: input.to }
    }

    case 'list_experiences': {
      const all = experienceSummaries()
      return { experiences: input.objective ? all.filter((x) => x.objective === input.objective) : all }
    }

    case 'get_experience': {
      const owner = targetOwner(chatId, input.id)
      if (!owner) return { error: 'No experience found. Use an id from the context.' }
      return detailFor(owner) ?? { error: 'Not found' }
    }

    case 'open_experience': {
      const owner = targetOwner(chatId, input.id)
      if (!owner) return { error: 'No experience with that id.' }
      openOwner(owner)
      const fromHome = ownerOf(chatId) === 'home'
      if (fromHome) handOff(chatId, owner)
      const first = fromHome && isBlankOwner(owner) ? firstStep(owner, said) : {}
      return { ok: true, experience: detailFor(owner), ...first }
    }

    case 'create_experience': {
      const type = input.type as string
      const name = str(input.name) ?? 'New experience'
      let owner: OwnerKey
      if (type === 'cancel_page') {
        const id = createCancelPage(name)
        owner = `cancel:${id}`
        useOrchestration.setState({ setupDoor: 'guide', setupDoorConsumed: true })
      } else {
        const x = addGrowthExperience(input.objective === 'expansion' ? 'expansion' : 'acquisition', type as 'in_app_offer' | 'pricing_table', { name })
        owner = `growth:${x.id}`
        openOwner(owner)
      }
      const brief = str(input.brief)
      if (brief) useAgentStore.getState().setBrief(owner, brief)
      handOff(chatId, owner)
      const created = parseOwner(owner) as { id: string }
      return { ok: true, id: created.id, ...firstStep(owner, said) }
    }

    case 'start_from_template': {
      const t = LIBRARY.find((e) => e.id === input.template && e.kind === 'cancel')
      if (!t) return { error: `Unknown template. Use one of: ${LIBRARY.filter((e) => e.kind === 'cancel').map((e) => e.id).join(', ')}` }
      if (!cancelOwner(chatId)) return { error: 'Open or create a cancel page first.' }
      const count = useJourney.getState().file.steps.length
      if (count && input.replace !== true)
        return { error: `This would replace the ${count} screens on the page. Ask the merchant first with ask_choice, then call again with replace: true.` }
      landTemplate(t.id)
      return { ok: true, experience: detailFor(ownerOf(chatId)) }
    }

    case 'update_step': {
      if (!cancelOwner(chatId)) return { error: 'Open a cancel page first.' }
      const step = useJourney.getState().file.steps.find((s) => s.id === input.stepId)
      if (!step) return { error: 'No screen with that id. Call get_experience.' }
      beforeEdit()
      const patch: Partial<JourneyStepFile> = {}
      if (str(input.headline)) patch.headline = str(input.headline)
      if (str(input.body)) patch.body = str(input.body)
      if (input.offer) patch.offer = input.offer as OfferKey
      const content: NonNullable<JourneyStepFile['content']> = {}
      if (Array.isArray(input.keepItems)) content.keepItems = input.keepItems as string[]
      if (Array.isArray(input.surveyReasons)) content.surveyReasons = input.surveyReasons as string[]
      if (Object.keys(content).length) patch.content = content
      useJourney.getState().updateStep(step.id, patch)
      openTab('editor')
      return { ok: true, undo: 'Merchant can undo from the chat.' }
    }

    case 'add_step': {
      if (!cancelOwner(chatId)) return { error: 'Open a cancel page first.' }
      const file = useJourney.getState().file
      if (!file.steps.length) return { error: 'This cancel page has no screens yet. Start from a template first.' }
      beforeEdit()
      const made = newStep(input.kind as 'loss_aversion' | 'survey' | 'offer', (input.offer as OfferKey) ?? undefined)
      const step = { ...made, headline: str(input.headline) ?? made.headline, body: str(input.body) ?? made.body }
      const at = file.steps.findIndex((s) => isTailKind(s.kind))
      const steps = [...file.steps]
      steps.splice(at < 0 ? steps.length : at, 0, step)
      useJourney.getState().patchFile({ steps })
      openTab('editor')
      return { ok: true, stepId: step.id, undo: 'Merchant can undo from the chat.' }
    }

    case 'remove_step': {
      if (!cancelOwner(chatId)) return { error: 'Open a cancel page first.' }
      const file = useJourney.getState().file
      const step = file.steps.find((s) => s.id === input.stepId)
      if (!step) return { error: 'No screen with that id.' }
      if (isTailKind(step.kind)) return { error: 'The confirmation and outcome screens are required.' }
      beforeEdit()
      useJourney.getState().patchFile({ steps: file.steps.filter((s) => s.id !== step.id) })
      return { ok: true }
    }

    case 'open_tab': {
      if (!cancelOwner(chatId)) return { error: 'Tabs are only in the cancel page workspace.' }
      openTab(input.tab as PaneTab)
      return { ok: true }
    }

    case 'set_audience': {
      const owner = targetOwner(chatId, input.id)
      if (!owner) return { error: 'Which experience? Pass its id.' }
      const audienceId = String(input.audienceId)
      if (growthId(owner)) return { error: ON_PLAYS }
      openOwner(owner)
      const saved = AUDIENCE_LIBRARY.find((a) => a.id === audienceId)
      const orch = useOrchestration.getState()
      if (audienceId === 'all' || !saved) orch.updateAudience({ targetAll: true, savedAudienceId: null, name: 'Everyone' })
      else orch.updateAudience({ targetAll: false, savedAudienceId: saved.id, name: saved.name, match: saved.match, conditions: saved.conditions })
      orch.confirmSetupItem('audience')
      openTab('targeting')
      return { ok: true }
    }

    case 'set_trigger': {
      const gid = growthId(targetOwner(chatId, input.id))
      if (!gid) return { error: 'Cancel pages always show when someone clicks Cancel.' }
      updateGrowthExperience(gid, { trigger: { kind: input.kind as never, value: str(input.value) } })
      return { ok: true }
    }

    case 'use_in_experience': {
      const gid = growthId(targetOwner(chatId, input.id))
      if (!gid) return { error: 'Only in-app offers and pricing tables use Library items this way.' }
      const refId = String(input.refId)
      const lib = useGrowthLibrary.getState()
      const x = useGrowthExperiences.getState().items.find((i) => i.id === gid)!
      const ok = x.type === 'pricing_table' ? lib.pricingTables.some((t) => t.id === refId) : lib.offers.some((o) => o.id === refId)
      if (!ok) return { error: x.type === 'pricing_table' ? 'No pricing table with that id.' : 'No offer with that id.' }
      updateGrowthExperience(gid, { refId })
      return { ok: true }
    }

    case 'set_priority': {
      const owner = targetOwner(chatId, input.id)
      if (!owner) return { error: 'Which experience? Pass its id.' }
      const o = parseOwner(owner) as { kind: 'cancel' | 'growth'; id: string }
      if (o.kind !== 'cancel') return { error: ON_PLAYS }
      moveCancelPage(o.id, Number(input.position))
      return { ok: true }
    }

    case 'set_status': {
      const owner = targetOwner(chatId, input.id)
      if (!owner) return { error: 'Which experience? Pass its id.' }
      if (growthId(owner)) return { error: ON_PLAYS }
      openOwner(owner)
      if (useOrchestration.getState().play.publishState === 'live') useOrchestration.getState().togglePublish()
      return { ok: true, note: 'Cancel page is back to draft.' }
    }

    case 'match_brand': {
      const url = String(input.url)
      const result = await matchMerchantBrand(url, compileBrand(useJourney.getState().file.brand))
      if (result.applied) useJourney.getState().applyBrand(result.branding, true)
      return { applied: result.applied, reply: result.reply }
    }

    case 'list_library': {
      const lib = useGrowthLibrary.getState()
      if (input.section === 'offers') return { offers: lib.offers.filter((o) => o.status !== 'archived') }
      if (input.section === 'pricing_tables') return { pricingTables: lib.pricingTables }
      if (input.section === 'templates') return { templates: LIBRARY.filter((e) => e.kind === 'cancel') }
      return { reasons: lib.reasons, lossAversionCards: lib.cards, redirectPages: lib.redirects }
    }

    case 'update_offer':
      return applyUpdateOffer(input)

    case 'update_survey_reasons': {
      useGrowthLibrary.getState().setReasons(input.reasons as { code: string; label: string }[])
      return { ok: true }
    }

    case 'show_sample':
      return {
        shown: true,
        next: 'The card shows sample numbers and a link to the page. In one or two lines, say this area is not built in the prototype yet and offer one next step you can do, such as a cancel page change. Do not add numbers, reasons or pages you did not open.',
      }

    case 'remember': {
      const fact = str(input.fact)
      if (fact) useAgentStore.getState().remember(fact)
      return { ok: true }
    }

    case 'update_brief': {
      const owner = ownerOf(chatId)
      if (owner === 'home') return { error: 'Briefs belong to an experience.' }
      useAgentStore.getState().setBrief(owner, String(input.brief))
      return { ok: true }
    }

    case 'undo':
      return undoLast() ? { ok: true } : { error: 'Nothing to undo.' }

    default:
      return { error: `Unknown tool ${name}` }
  }
}

export { cancelReadiness }
