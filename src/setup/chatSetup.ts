import { experienceRows, playRows, summarize, workspaceRows, type SetupInputs, type TaskRow } from './progress'

/** What Copilot asks for each setting. Plain, one or two sentences. */
export const CHAT_PROMPT: Record<string, string> = {
  layout: 'How should the page sit on your site? A modal opens over your account page. A full page is its own URL, and a continuous page puts every step on one scroll.',
  offers: 'Here are the offers on the path. Keep them, or pick different ones.',
  fulfilment: 'When someone accepts an offer, how does it get applied?',
  afterAccept: 'What happens right after someone accepts?',
  reasons: 'These are the reasons people can pick. Change the wording or add your own. You can report on them later.',
  buttonLinks: 'Where should the two main buttons go? Leave them empty to use the defaults.',
  returnUrls: 'Where do people land after they stay, and after the cancel is done?',
  answerPassing: 'Want the survey answers added to those links, so your app can read them?',
  cancelHandling: 'When someone goes through with the cancel, how is it processed, and when does it take effect?',
  brand: 'Let’s make it look like your site. Paste your site’s URL and I’ll pick up the colors and fonts.',
  walk: 'Click through it once as a subscriber, so you know what they’ll see.',
  publish: 'Ready to publish? Plays only show published experiences.',
  install: 'Connect your billing system and add the snippet to your site. You only do this once.',
  domain: 'Want full pages served from your own domain, like cancel.yoursite.com?',
  alerts: 'Where should we tell you about saves and cancels?',
  reporting: 'Saves, cancels and lift show up in Reporting once a play is live.',
  playName: 'What should we call this play?',
  audience: 'Who is this play for?',
  variants: 'Which experiences does this play show?',
  split: 'How should people be divided between the variants? By percentage for an A/B test, or by sub-audience so each group gets its own.',
  control: 'Hold back a small group with no cancel page, to measure what the play saves?',
  priority: 'When two plays match the same person, the higher one wins. Where does this one go?',
  language: 'Which language is this play shown in?',
  saveWindow: 'After you save someone, how long should we leave them alone?',
  goLive: 'Everything’s set. Go live when you’re ready.',
}

export function promptFor(row: TaskRow): string {
  return CHAT_PROMPT[row.entry.id] ?? `${row.entry.label}. ${row.entry.why}.`
}

/** Items the chat can walk: ones with fields, plus the walk-through, which it points you to. */
function walkable(row: TaskRow): boolean {
  return (row.entry.chat || row.entry.id === 'walk' || row.entry.id === 'test') && row.entry.id !== 'reporting'
}

/** Experience settings first, then the one-time workspace ones, then walk and publish last. */
export function experienceChatRows(experienceId: string, i: SetupInputs): TaskRow[] {
  const exp = experienceRows(experienceId, i)
  const ws = workspaceRows(i)
  const own = exp.filter((r) => r.entry.track === 'experience')
  const launch = exp.filter((r) => r.entry.track === 'launch')
  return [...own, ...ws.filter((r) => r.entry.level !== 'optional'), ...launch.filter((r) => r.entry.id !== 'publish'), ...ws.filter((r) => r.entry.level === 'optional'), ...launch.filter((r) => r.entry.id === 'publish')].filter(walkable)
}

export function playChatRows(playId: string, i: SetupInputs): TaskRow[] {
  const rows = playRows(playId, i)
  const own = rows.filter((r) => r.entry.track === 'play')
  const launch = rows.filter((r) => r.entry.track === 'launch')
  return [...own, ...workspaceRows(i), ...launch.filter((r) => r.entry.id !== 'goLive'), ...launch.filter((r) => r.entry.id === 'goLive')].filter(walkable)
}

/** The next thing to ask. Skipped items only come back when you resume on purpose. */
export function nextRow(rows: TaskRow[], opts: { includeSkipped?: boolean; not?: string } = {}): TaskRow | null {
  const open = rows.filter((r) => r.entry.id !== opts.not)
  return open.find((r) => r.status === 'todo') ?? (opts.includeSkipped ? open.find((r) => r.status === 'skipped') : undefined) ?? null
}

export function leftCount(rows: TaskRow[]): number {
  return rows.filter((r) => r.status === 'todo' || r.status === 'skipped').length
}

export interface FinalCheck {
  blockers: TaskRow[]
  skipped: TaskRow[]
  open: TaskRow[]
}

/** Before the publish or go-live card: what's still required, what was skipped, and what's recommended but untouched. */
export function finalCheck(rows: TaskRow[]): FinalCheck {
  const s = summarize(rows)
  return {
    blockers: s.blockers,
    skipped: rows.filter((r) => r.status === 'skipped'),
    open: rows.filter((r) => r.status === 'todo' && r.entry.level === 'recommended'),
  }
}

export function finalCheckText(check: FinalCheck, gate: 'publish' | 'go live'): string {
  const list = (rows: TaskRow[]) => rows.map((r) => r.entry.label.toLowerCase()).join(', ')
  if (check.blockers.length > 0) {
    return `Before you ${gate}, ${check.blockers.length === 1 ? 'one thing still needs' : `${check.blockers.length} things still need`} you: ${list(check.blockers)}. Let’s do ${check.blockers.length === 1 ? 'it' : 'those'} first.`
  }
  const later = [...check.skipped, ...check.open]
  if (later.length > 0) {
    const parts = [
      check.skipped.length > 0 && `You skipped ${list(check.skipped)}.`,
      check.open.length > 0 && `${check.open.length === 1 ? 'One recommended item is' : 'Some recommended items are'} still open: ${list(check.open)}.`,
    ].filter(Boolean)
    return `Everything required is done. ${parts.join(' ')} You can ${gate} now and come back to ${later.length === 1 ? 'it' : 'them'} later.`
  }
  return `Everything is set. Last check before you ${gate}.`
}
