import { LIBRARY } from '../journey/templates'
import { PRIMARY_EXPERIENCE_ID } from '../lib/orchestrationSeed'
import { setupProgress } from '../orchestration/setupTracker'
import { playVariants } from '../play/resolve'
import { labelOf } from '../shell/nav'
import { useGrowthShell } from '../shell/useGrowthShell'
import { useExperience } from '../store/useExperience'
import { useJourney } from '../store/useJourney'
import { useOrchestration } from '../store/useOrchestration'
import { AUDIENCE_LIBRARY } from '../types/orchestration'
import { useCancelSettings } from '../workspace/useCancelSettings'
import { useWorkspace } from '../workspace/useWorkspace'
import { cancelPageRows } from '../concierge/cancelPages'
import { CATALOG_PLANS } from '../concierge/model'
import { useGrowthExperiences } from '../concierge/useGrowthExperiences'
import { experienceTabs, growthExperienceLive, growthPlaysUsing, usedIn } from '../concierge/useGrowthPlays'
import { useGrowthLibrary } from '../concierge/useGrowthLibrary'
import type { AgentContext } from './systemPrompt'
import { useAgentStore, type OwnerKey } from './useAgentStore'

export const AUDIENCES = [{ id: 'all', name: 'Everyone' }, ...AUDIENCE_LIBRARY.map((a) => ({ id: a.id, name: a.name }))]

export function audienceName(id: string): string {
  return AUDIENCES.find((a) => a.id === id)?.name ?? id
}

export function ownerOf(chatId: string): OwnerKey {
  return useAgentStore.getState().chats[chatId]?.owner ?? 'home'
}

export function parseOwner(owner: OwnerKey): { kind: 'home' } | { kind: 'cancel' | 'growth'; id: string } {
  if (owner === 'home') return { kind: 'home' }
  const [kind, ...rest] = owner.split(':')
  return { kind: kind as 'cancel' | 'growth', id: rest.join(':') }
}

export function cancelReadiness() {
  const o = useOrchestration.getState()
  return setupProgress({
    file: useJourney.getState().file,
    play: o.play,
    experience: useExperience.getState().experiences[PRIMARY_EXPERIENCE_ID],
    confirmed: o.confirmedSetup,
    installConnected: o.installConnected,
    walkedOrSkipped: o.walkedOrSkipped,
    stepStripShown: o.stepStripShown,
    dismissedStepNeedsWork: o.dismissedStepNeedsWork,
    globalControl: useCancelSettings.getState().globalControl,
  })
}

function cancelDetail(id: string): Record<string, unknown> {
  const { activeId, threads } = useWorkspace.getState()
  const thread = threads.find((t) => t.id === id)
  if (id !== activeId) return { id, type: 'cancel_page', objective: 'retention', name: thread?.title, note: 'Not open. Call open_experience to work on it.' }
  const file = useJourney.getState().file
  const play = useOrchestration.getState().play
  const progress = cancelReadiness()
  return {
    id,
    type: 'cancel_page',
    objective: 'retention',
    name: thread?.title,
    status: play.publishState === 'live' ? 'live' : 'draft',
    template: file.template,
    source: file.source ?? 'authored',
    steps: file.steps.map((s) => ({
      id: s.id,
      kind: s.kind,
      headline: s.headline,
      body: s.body,
      offer: s.offer,
      keepItems: s.content?.keepItems,
      surveyReasons: s.content?.surveyReasons,
    })),
    audience: play.audience.savedAudienceId ?? (play.audience.targetAll ? 'all' : play.audience.name),
    split: playVariants(play).map((v) => ({ label: v.label, percent: v.percent })),
    globalControl: useCancelSettings.getState().globalControl,
    brandMatched: Boolean(file.brand.matched),
    leftBeforeLive: progress.gaps,
    brief: useAgentStore.getState().briefs[`cancel:${id}`],
  }
}

function growthDetail(id: string): Record<string, unknown> | undefined {
  const x = useGrowthExperiences.getState().items.find((i) => i.id === id)
  if (!x) return undefined
  const plays = growthPlaysUsing(x.id)
  const gaps: string[] = []
  if (!x.refId) gaps.push(x.type === 'pricing_table' ? 'Pick a pricing table' : 'Pick an offer')
  if (!plays.length) gaps.push('Add it to a play')
  return {
    ...x,
    status: growthExperienceLive(x.id) ? 'live' : 'draft',
    homeTab: x.objective,
    usedInTabs: experienceTabs(x.id),
    shared: experienceTabs(x.id).length > 1,
    plays: plays.map((p) => ({ id: p.id, name: p.name, tab: p.objective, status: p.status, audience: p.audience.name, control: p.control })),
    note: 'Audience, control group, split and order are set on the play, in the Acquisition or Expansion tab. One experience can be used by plays in both tabs, and an edit shows in both.',
    leftBeforeLive: gaps,
    brief: useAgentStore.getState().briefs[`growth:${id}`],
  }
}

export function experienceSummaries() {
  return [
    ...cancelPageRows().map((r) => ({ id: r.id, name: r.name, objective: 'retention', type: 'cancel_page', status: r.status, priority: r.priority })),
    ...useGrowthExperiences
      .getState()
      .items.map((x) => {
        const tabs = experienceTabs(x.id)
        return { id: x.id, name: x.name, objective: x.objective, usedInTabs: tabs, shared: tabs.length > 1, type: x.type, status: growthExperienceLive(x.id) ? 'live' : 'draft' }
      }),
  ]
}

export function detailFor(owner: OwnerKey): Record<string, unknown> | undefined {
  const o = parseOwner(owner)
  if (o.kind === 'cancel') return cancelDetail(o.id)
  if (o.kind === 'growth') return growthDetail(o.id)
  return undefined
}

export function buildContext(chatId: string): AgentContext {
  const owner = ownerOf(chatId)
  const o = parseOwner(owner)
  const route = useGrowthShell.getState().route
  const lib = useGrowthLibrary.getState()
  const rec = useAgentStore.getState().chats[chatId]
  return {
    surface: o.kind === 'cancel' ? 'cancel_page' : o.kind === 'growth' ? 'growth_experience' : route === 'home' ? 'home' : 'page',
    route,
    routeLabel: labelOf(route),
    experience: detailFor(owner),
    experiences: experienceSummaries(),
    offers: lib.offers
      .filter((x) => x.status !== 'archived')
      .map((x) => ({ id: x.id, name: x.name, objective: x.objective, category: x.category, widget: x.widget, value: x.value, status: x.status, usedIn: usedIn(x.id) })),
    pricingTables: lib.pricingTables
      .filter((x) => x.status !== 'archived')
      .map((x) => ({ id: x.id, name: x.name, objective: x.objective, plans: x.plans.map((p) => p.name), status: x.status, usedIn: usedIn(x.id) })),
    catalogPlans: CATALOG_PLANS.map((p) => ({ id: p.id, name: p.name, price: p.price, period: p.period })),
    templates: LIBRARY.filter((e) => e.kind === 'cancel').map((e) => ({ id: e.id, title: e.title, does: e.does, pickWhen: e.pickWhen })),
    audiences: AUDIENCES,
    globalControl: useCancelSettings.getState().globalControl,
    memory: useAgentStore.getState().memory,
    needsTriage: owner === 'home' && !rec?.triage,
  }
}
