import { isBrandMatched } from '../brand/matchSite'
import type { JourneyFile } from '../journey/types'
import type { CancelPlay } from '../plays/types'
import type { Mark, WorkspaceSetup } from './useSetupState'

/**
 * Every cancel setting the chat can ask about. The chat walks it one card at a
 * time and the Summary edits the same values, so the two never disagree.
 * Marks here only remember what the chat has asked; launch readiness comes
 * from `checks`. Adding a setting means adding one entry here and its card in
 * `SetupCards`.
 */
export type Scope = 'experience' | 'play' | 'workspace'
export type Level = 'required' | 'recommended' | 'optional'
export type Track = 'experience' | 'play' | 'launch'
export type TaskStatus = 'done' | 'todo' | 'skipped' | 'na' | 'waiting'

/** Where "Show me" goes when a task is finished outside the chat. */
export type ShowMe =
  | { to: 'editor' | 'preview' | 'plan' }
  | { to: 'playCanvas' | 'playSummary' | 'order' }

export interface ExperienceCtx {
  experienceId: string
  file: JourneyFile
  live: boolean
  walked: boolean
}

export interface PlayCtx {
  play: CancelPlay
  playCount: number
  /** Required experience tasks done across the play's variants. */
  variantsReady: { ready: number; total: number }
  variantsLive: { live: number; total: number }
  tested: boolean
}

export interface WorkspaceCtx {
  installConnected: boolean
  ws: WorkspaceSetup
  anyLive: boolean
}

interface Base {
  id: string
  track: Track
  level: Level
  label: string
  why: string
  /** Other items in the same scope that must be done first. */
  dependsOn?: string[]
  /** False for things the chat cannot do for you, like writing screen copy. */
  chat: boolean
  showMe?: ShowMe
}

export interface ExperienceItem extends Base {
  scope: 'experience'
  applies?: (c: ExperienceCtx) => boolean
  isDone: (c: ExperienceCtx, mark?: Mark) => boolean
}

export interface PlayItem extends Base {
  scope: 'play'
  applies?: (c: PlayCtx) => boolean
  isDone: (c: PlayCtx, mark?: Mark) => boolean
}

export interface WorkspaceItem extends Base {
  scope: 'workspace'
  applies?: (c: WorkspaceCtx) => boolean
  isDone: (c: WorkspaceCtx, mark?: Mark) => boolean
}

export type SetupEntry = ExperienceItem | PlayItem | WorkspaceItem

const offers = (f: JourneyFile) => f.steps.filter((s) => s.kind === 'offer')
const hasSurvey = (f: JourneyFile) => f.steps.some((s) => s.kind === 'survey')
const confirmed = (m?: Mark) => m?.status === 'done'

export const EXPERIENCE_ITEMS: ExperienceItem[] = [
  {
    id: 'steps',
    scope: 'experience',
    track: 'experience',
    level: 'required',
    label: 'Screens',
    why: 'The steps a subscriber walks through before they cancel',
    chat: false,
    showMe: { to: 'editor' },
    isDone: (c) => c.file.steps.length > 0,
  },
  {
    id: 'layout',
    scope: 'experience',
    track: 'experience',
    level: 'required',
    label: 'Page layout',
    why: 'Modal over your page, full page, or one continuous page',
    chat: true,
    isDone: (_c, m) => confirmed(m),
  },
  {
    id: 'offers',
    scope: 'experience',
    track: 'experience',
    level: 'required',
    label: 'Offers',
    why: 'What you offer instead of letting them go',
    chat: true,
    applies: (c) => offers(c.file).length > 0,
    isDone: (c, m) => confirmed(m) && offers(c.file).every((s) => Boolean(s.offer)),
  },
  {
    id: 'fulfilment',
    scope: 'experience',
    track: 'experience',
    level: 'required',
    label: 'Offer fulfilment',
    why: 'How the offer is applied once someone accepts it',
    chat: true,
    dependsOn: ['offers'],
    applies: (c) => offers(c.file).length > 0,
    isDone: (c) => offers(c.file).every((s) => Boolean(s.fulfilment) && (s.fulfilment === 'billing' || Boolean(s.fulfilmentTarget?.trim()))),
  },
  {
    id: 'afterAccept',
    scope: 'experience',
    track: 'experience',
    level: 'recommended',
    label: 'After an offer is accepted',
    why: 'A thank-you, a quick question, or just close',
    chat: true,
    dependsOn: ['offers'],
    applies: (c) => offers(c.file).length > 0,
    isDone: (c) => offers(c.file).every((s) => Boolean(s.afterAccept)),
  },
  {
    id: 'reasons',
    scope: 'experience',
    track: 'experience',
    level: 'recommended',
    label: 'Survey reasons',
    why: 'The reasons you can report on later',
    chat: true,
    applies: (c) => hasSurvey(c.file),
    isDone: (c, m) => confirmed(m) || c.file.steps.some((s) => s.kind === 'survey' && (s.content?.surveyReasons?.length ?? 0) > 0),
  },
  {
    id: 'buttonLinks',
    scope: 'experience',
    track: 'experience',
    level: 'recommended',
    label: 'Never mind and Cancel links',
    why: 'Where the two main buttons take people',
    chat: true,
    isDone: (c, m) => confirmed(m) || Boolean(c.file.cancelHandling?.nevermindUrl && c.file.cancelHandling?.cancelUrl),
  },
  {
    id: 'returnUrls',
    scope: 'experience',
    track: 'experience',
    level: 'recommended',
    label: 'Return pages',
    why: 'Where people land after they stay, or after the cancel is done',
    chat: true,
    isDone: (c, m) => confirmed(m) || Boolean(c.file.cancelHandling?.saveReturnUrl && c.file.cancelHandling?.confirmationUrl),
  },
  {
    id: 'answerPassing',
    scope: 'experience',
    track: 'experience',
    level: 'optional',
    label: 'Survey answers on links',
    why: 'Adds the answers to your return links, so your app can read them',
    chat: true,
    applies: (c) => hasSurvey(c.file),
    isDone: (c) => Boolean(c.file.cancelHandling?.answerPassing),
  },
  {
    id: 'cancelHandling',
    scope: 'experience',
    track: 'experience',
    level: 'required',
    label: 'Cancel handling',
    why: 'How the cancel is processed and when it takes effect',
    chat: true,
    isDone: (c) => Boolean(c.file.cancelHandling?.processing && c.file.cancelHandling?.timing),
  },
  {
    id: 'confirmation',
    scope: 'experience',
    track: 'experience',
    level: 'recommended',
    label: 'Confirmation screen',
    why: 'A last screen that says what just happened',
    chat: false,
    showMe: { to: 'editor' },
    isDone: (c) => c.file.steps.some((s) => s.kind === 'confirmation' || s.kind === 'outcome_saved' || s.kind === 'outcome_cancelled'),
  },
  {
    id: 'brand',
    scope: 'experience',
    track: 'experience',
    level: 'recommended',
    label: 'Brand',
    why: 'Matches your site so it feels like your product',
    chat: true,
    isDone: (c) => isBrandMatched(c.file.brand),
  },
  {
    id: 'walk',
    scope: 'experience',
    track: 'launch',
    level: 'recommended',
    label: 'Walk it as a subscriber',
    why: 'Click through it once in Preview',
    chat: false,
    showMe: { to: 'preview' },
    isDone: (c, m) => confirmed(m) || c.walked,
  },
  {
    id: 'publish',
    scope: 'experience',
    track: 'launch',
    level: 'required',
    label: 'Publish this experience',
    why: 'Plays only show published experiences',
    chat: true,
    isDone: (c) => c.live,
  },
]

export const PLAY_ITEMS: PlayItem[] = [
  {
    id: 'playName',
    scope: 'play',
    track: 'play',
    level: 'recommended',
    label: 'Name the play',
    why: 'So your team can tell plays apart',
    chat: true,
    isDone: (c) => !/^New play( \d+)?$/.test(c.play.name),
  },
  {
    id: 'audience',
    scope: 'play',
    track: 'play',
    level: 'required',
    label: 'Audience',
    why: 'Who this play is for',
    chat: true,
    isDone: (c, m) => confirmed(m) || !c.play.audience.targetAll,
  },
  {
    id: 'variants',
    scope: 'play',
    track: 'play',
    level: 'required',
    label: 'Variants',
    why: 'At least one cancel experience to show',
    chat: true,
    showMe: { to: 'playCanvas' },
    isDone: (c) => c.play.variants.length > 0,
  },
  {
    id: 'split',
    scope: 'play',
    track: 'play',
    level: 'required',
    label: 'Traffic split',
    why: 'How people are divided between variants',
    chat: true,
    dependsOn: ['variants'],
    applies: (c) => c.play.variants.length > 1,
    isDone: (c, m) => {
      if (c.play.splitBy === 'percent') return confirmed(m) && c.play.variants.reduce((a, v) => a + v.weight, 0) === 100
      return c.play.variants.filter((v) => v.audience).length >= 1 && c.play.variants.some((v) => !v.audience)
    },
  },
  {
    id: 'control',
    scope: 'play',
    track: 'play',
    level: 'optional',
    label: 'Control group',
    why: 'A small group that sees no cancel page, to measure what the play saves',
    chat: true,
    isDone: (c, m) => confirmed(m) || c.play.control > 0,
  },
  {
    id: 'priority',
    scope: 'play',
    track: 'play',
    level: 'recommended',
    label: 'Place in play order',
    why: 'Decides who wins when two plays match the same person',
    chat: true,
    showMe: { to: 'order' },
    applies: (c) => c.playCount > 1,
    isDone: (_c, m) => confirmed(m),
  },
  {
    id: 'language',
    scope: 'play',
    track: 'play',
    level: 'optional',
    label: 'Language',
    why: 'The language this play is shown in',
    chat: true,
    isDone: (c, m) => confirmed(m) || c.play.language !== 'en',
  },
  {
    id: 'saveWindow',
    scope: 'play',
    track: 'play',
    level: 'optional',
    label: 'Save window',
    why: 'How long to leave someone alone after you save them',
    chat: true,
    isDone: (c, m) => confirmed(m) || c.play.saveWindowDays !== null,
  },
  {
    id: 'variantsReady',
    scope: 'play',
    track: 'play',
    level: 'required',
    label: 'Every variant set up',
    why: 'Each experience in the play has its required settings',
    chat: false,
    dependsOn: ['variants'],
    isDone: (c) => c.variantsReady.total > 0 && c.variantsReady.ready === c.variantsReady.total,
  },
  {
    id: 'test',
    scope: 'play',
    track: 'launch',
    level: 'recommended',
    label: 'Test with a subscriber',
    why: 'See who gets which variant before it goes live',
    chat: false,
    showMe: { to: 'playCanvas' },
    dependsOn: ['variants'],
    isDone: (c) => c.tested,
  },
  {
    id: 'goLive',
    scope: 'play',
    track: 'launch',
    level: 'required',
    label: 'Go live',
    why: 'Starts showing the play to subscribers',
    chat: true,
    isDone: (c) => c.play.status === 'live',
  },
]

export const WORKSPACE_ITEMS: WorkspaceItem[] = [
  {
    id: 'install',
    scope: 'workspace',
    track: 'launch',
    level: 'required',
    label: 'Billing and install',
    why: 'Connect billing and add the snippet to your site, once',
    chat: true,
    isDone: (c) => c.installConnected,
  },
  {
    id: 'domain',
    scope: 'workspace',
    track: 'launch',
    level: 'optional',
    label: 'Custom domain',
    why: 'Serves full pages from your own domain, like cancel.yoursite.com',
    chat: true,
    isDone: (c, m) => confirmed(m) || Boolean(c.ws.customDomain.trim()),
  },
  {
    id: 'alerts',
    scope: 'workspace',
    track: 'launch',
    level: 'optional',
    label: 'Alerts',
    why: 'Hear about saves and cancels by email, Slack or webhook',
    chat: true,
    isDone: (c, m) => confirmed(m) || Boolean(c.ws.alertEmail || c.ws.alertSlack || c.ws.alertWebhook),
  },
  {
    id: 'reporting',
    scope: 'workspace',
    track: 'launch',
    level: 'optional',
    label: 'Reporting',
    why: 'Where saves, cancels and lift show up once a play is live',
    chat: false,
    applies: (c) => c.anyLive,
    isDone: (_c, m) => confirmed(m),
  },
]

export function entryById(id: string): SetupEntry | undefined {
  return [...EXPERIENCE_ITEMS, ...PLAY_ITEMS, ...WORKSPACE_ITEMS].find((e) => e.id === id)
}

export const WORKSPACE_TARGET = 'ws'
