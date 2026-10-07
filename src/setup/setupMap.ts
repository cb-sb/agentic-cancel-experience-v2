import { isBrandMatched } from '../brand/matchSite'
import type { JourneyFile } from '../journey/types'
import { offerVariantLabel } from '../lib/offerVariants'
import { audienceText, fallbackVariant, hasSplit, pagesIn, variantShare } from '../plays/resolve'
import { audienceUnset } from '../plays/usePlays'
import { LANGUAGES, variantLetter, type CancelPlay } from '../plays/types'
import { experienceCtx, type SetupInputs } from './progress'
import { WORKSPACE_TARGET } from './registry'

/**
 * Every setting, in the order a subscriber meets it, with its current value.
 * Rows carry no status. The only colour comes from a launch check on the same
 * setting, looked up by `check`.
 */
export interface MapRow {
  id: string
  label: string
  value: string
  /** Registry item that opens this setting in chat or the editor. */
  item: string
  targetId: string
  check?: string
}

const SHELL: Record<string, string> = { modal: 'Modal', fullpage: 'Full page', fullpage_scroll: 'Full page, continuous' }
const FULFILMENT: Record<string, string> = { billing: 'Billing applies it', url: 'Sent to a link', webhook: 'Sent to a webhook', email: 'Sent by email' }
const AFTER: Record<string, string> = { confirmation: 'Thank-you screen', feedback: 'A quick question', dismiss: 'Just close' }
const PROCESSING: Record<string, string> = { billing_api: 'Cancelled in billing', override: 'Handled by your app' }
const TIMING: Record<string, string> = { immediate: 'right away', end_of_term: 'at the end of the term', end_of_billing_term: 'at the end of the billing period' }

const offerSteps = (f: JourneyFile) => f.steps.filter((s) => s.kind === 'offer')
const surveySteps = (f: JourneyFile) => f.steps.filter((s) => s.kind === 'survey')
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

function host(url: string): string {
  try {
    return new URL(url).host || url
  } catch {
    return url
  }
}

/** Distinct labels, or a fallback when any are missing. */
function labels(values: (string | undefined)[], names: Record<string, string>, missing: string): string {
  if (values.some((v) => !v)) return missing
  return [...new Set(values.map((v) => names[v!] ?? v!))].join(', ')
}

function pair(a: string | undefined, b: string | undefined, aLabel: string, bLabel: string, none: string): string {
  if (!a && !b) return none
  return `${aLabel}: ${a ? host(a) : 'default'} · ${bLabel}: ${b ? host(b) : 'default'}`
}

export function ago(at: number): string {
  const s = Math.round((Date.now() - at) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export function experienceMap(experienceId: string, i: SetupInputs): MapRow[] {
  const t = i.threads.find((x) => x.id === experienceId)
  if (!t) return []
  const f = experienceCtx(t, i).file
  const offers = offerSteps(f)
  const surveys = surveySteps(f)
  const h = f.cancelHandling ?? {}
  const reasons = surveys.reduce((n, s) => n + (s.content?.surveyReasons?.length ?? 0), 0)
  const row = (id: string, label: string, value: string, check?: string): MapRow => ({ id, label, value, item: id, targetId: experienceId, check })
  return [
    row('layout', 'Page layout', SHELL[f.shell] ?? f.shell),
    row('brand', 'Brand', isBrandMatched(f.brand) ? 'Matched to your site' : 'Default look'),
    row('steps', 'Screens', f.steps.length === 0 ? 'None yet' : plural(f.steps.length, 'screen'), 'hasScreens'),
    ...(surveys.length > 0 ? [row('reasons', 'Survey reasons', reasons > 0 ? plural(reasons, 'reason') : 'Default reasons')] : []),
    ...(offers.length > 0
      ? [
          row('offers', 'Offers', offers.some((s) => !s.offer) ? 'Not picked' : [...new Set(offers.map((s) => offerVariantLabel(s.offer!)))].join(', '), 'offerPicked'),
          row('fulfilment', 'How offers are applied', labels(offers.map((s) => s.fulfilment), FULFILMENT, 'Not set'), 'offerApplied'),
          row('afterAccept', 'After an offer is accepted', labels(offers.map((s) => s.afterAccept), AFTER, 'Not chosen')),
        ]
      : []),
    row('buttonLinks', 'Never mind and Cancel links', pair(h.nevermindUrl, h.cancelUrl, 'Never mind', 'Cancel', 'Default')),
    row('returnUrls', 'Return pages', pair(h.saveReturnUrl, h.confirmationUrl, 'After staying', 'After cancelling', 'Built-in pages')),
    ...(surveys.length > 0
      ? [row('answerPassing', 'Survey answers on links', h.answerPassing === 'hash' ? 'On, after #' : h.answerPassing === 'query' ? 'On, as query parameters' : 'Off')]
      : []),
    row(
      'cancelHandling',
      'Cancel handling',
      h.processing && h.timing ? `${PROCESSING[h.processing] ?? h.processing}, ${TIMING[h.timing] ?? h.timing}` : 'Not set',
      'cancelHandled',
    ),
  ]
}

export function playMap(play: CancelPlay, i: SetupInputs, order: string[]): MapRow[] {
  const titles = play.variants.map((v) => i.threads.find((t) => t.id === v.experienceId)?.title ?? 'Experience')
  const row = (id: string, label: string, value: string, check?: string): MapRow => ({ id, label, value, item: id, targetId: play.id, check })
  const rank = order.indexOf(play.id)
  return [
    row('playName', 'Name', play.name),
    row('audience', 'Audience', audienceText(play.audience)),
    row('variants', 'Experiences', titles.length === 0 ? 'None yet' : titles.map((t, n) => `${variantLetter(n)}: ${t}`).join(', '), 'hasExperience'),
    ...(hasSplit(play)
      ? [
          row(
            'split',
            play.splitBy === 'percent' ? 'Split by percentage' : 'Split by sub-audience',
            play.splitBy === 'percent'
              ? play.variants.map((v, n) => `${variantLetter(n)} ${variantShare(play, v)}`).join(', ')
              : [
                  ...play.subAudiences.map((x, n) => `${audienceUnset(x.audience) ? `Sub-audience ${n + 1}` : audienceText(x.audience)}: ${plural(pagesIn(play, x.id).length, 'page')}`),
                  `Fallback: ${fallbackVariant(play) ? 'set' : 'not set'}`,
                ].join(', '),
            'splitAddsUp',
          ),
        ]
      : []),
    row('control', 'Control group', play.control > 0 ? `${play.control}% see no cancel page` : 'None'),
    ...(order.length > 1 && rank >= 0 ? [row('priority', 'Place in play order', `${rank + 1} of ${order.length}`)] : []),
    row('language', 'Language', LANGUAGES.find((l) => l.id === play.language)?.label ?? play.language),
    row('saveWindow', 'Save window', play.saveWindowDays === null ? 'None' : `${plural(play.saveWindowDays, 'day')} after a save`),
  ]
}

export function workspaceMap(i: SetupInputs): MapRow[] {
  const alerts = [i.ws.alertEmail && 'Email', i.ws.alertSlack && 'Slack', i.ws.alertWebhook && 'Webhook'].filter(Boolean).join(', ')
  const row = (id: string, label: string, value: string, check?: string): MapRow => ({ id, label, value, item: id, targetId: WORKSPACE_TARGET, check })
  return [
    row('install', 'Billing and install', i.installConnected ? 'Connected' : 'Not connected', 'installed'),
    row('domain', 'Custom domain', i.ws.customDomain.trim() || 'Chargebee domain'),
    row('alerts', 'Alerts', alerts || 'None'),
  ]
}

export function tryItMap(scope: 'experience' | 'play', targetId: string, i: SetupInputs): MapRow[] {
  if (scope === 'experience') return [{ id: 'walk', label: 'Walk it as a subscriber', value: 'Opens Preview', item: 'walk', targetId }]
  const at = i.tested[targetId]
  return [{ id: 'test', label: 'Test with a subscriber', value: at ? `Last tested ${ago(at)}` : 'Not tested yet', item: 'test', targetId }]
}
