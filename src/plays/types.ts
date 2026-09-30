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
  /** Share of treated traffic, 0 to 100. Used when the play splits by percent. */
  weight: number
  /** Who this variant is for. Used when the play splits by sub-audience. No audience: everyone else. */
  audience?: Audience
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
