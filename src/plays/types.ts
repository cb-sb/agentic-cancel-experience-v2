import type { Audience } from '../types/orchestration'

/**
 * v8: a play is the parent. It decides who is in, holds back a control group,
 * and divides everyone else across its variants. Each variant points at a cancel
 * experience (a workspace thread). The same experience can sit in several plays.
 */
export type SplitBy = 'percent' | 'segments'

export interface PlayVariant {
  id: string
  experienceId: string
  /** Share of traffic, 0 to 100: of the play by percent, or of its sub-audience. */
  weight: number
  /** Saves from before sub-audiences held pages. Read once, then moved to `subAudiences`. */
  audience?: Audience
  /** Split by sub-audience: the group this page is in. None: the fallback page. */
  subAudienceId?: string
}

/** A group inside the play's audience. Its pages share its traffic, so it can run its own test. */
export interface SubAudience {
  id: string
  audience: Audience
}

/** A test row with no page picked yet. Picking one turns it into a variant with this weight. */
export interface EmptyRow {
  id: string
  /** Null: the play's own test. Otherwise the sub-audience's test. */
  subAudienceId: string | null
  weight: number
}

export type PlayStatus = 'draft' | 'live'

export interface CancelPlay {
  id: string
  name: string
  audience: Audience
  /** Share of this play's audience that sees no cancel page, 0 to 50. */
  control: number
  splitBy: SplitBy
  variants: PlayVariant[]
  /** Used when the play splits by sub-audience, in the order they are matched. */
  subAudiences: SubAudience[]
  emptyRows: EmptyRow[]
  status: PlayStatus
  /** Language the play's text is shown in. */
  language: string
  /** Days a saved subscriber is left alone before this play can show again. Null: no window. */
  saveWindowDays: number | null
  createdAt: number
  updatedAt: number
  publishedAt?: number
}

export const LANGUAGES: { id: string; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'French' },
  { id: 'de', label: 'German' },
  { id: 'es', label: 'Spanish' },
  { id: 'pt', label: 'Portuguese' },
  { id: 'ja', label: 'Japanese' },
]

export const ALL_AUDIENCE: Audience = {
  id: 'aud-all',
  name: 'All subscribers',
  ruleType: 'ALL_AUDIENCE',
  targetAll: true,
}

export function variantLetter(i: number): string {
  return String.fromCharCode(65 + (i % 26))
}
