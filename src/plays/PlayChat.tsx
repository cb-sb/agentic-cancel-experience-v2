import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { SIcon } from '@chargebee/sting-react'
import { CopilotMark } from '../orchestration/CopilotMark'
import { COPILOT_UI } from '../orchestration/copilotUi'
import { experienceChecks, failing, playChecks } from '../setup/checks'
import { finalCheck, finalCheckText, leftCount, nextRow, playChatRows, promptFor } from '../setup/chatSetup'
import { playRows, readSetupInputs, useSetupInputs, workspaceRows, type TaskRow } from '../setup/progress'
import { entryById } from '../setup/registry'
import { SetupCard } from '../setup/SetupCards'
import { setMark } from '../setup/useSetupState'
import { showMe } from '../setup/actions'
import { openTab } from '../workspace/paneTabs'
import { useWorkspace } from '../workspace/useWorkspace'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'
import { openExperience, openPlayTab } from './navigate'
import { variantLetter, type CancelPlay } from './types'

const KEY = 'cancel-experience:play-chat:v8'

interface Line {
  id: string
  from: 'bot' | 'you'
  text: string
  note?: boolean
}

interface PlayThread {
  lines: Line[]
  item: { id: string; targetId: string } | null
  done: boolean
}

function read(): Record<string, PlayThread> {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as Record<string, PlayThread>) : {}
    for (const t of Object.values(parsed)) t.item = null
    return parsed
  } catch {
    return {}
  }
}

const usePlayChat = create<{ byPlay: Record<string, PlayThread> }>(() => ({ byPlay: read() }))

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(usePlayChat.getState().byPlay))
  } catch {
    /* quota */
  }
}

const EMPTY: PlayThread = { lines: [], item: null, done: false }
let n = 0

function patchThread(playId: string, change: (t: PlayThread) => PlayThread) {
  usePlayChat.setState((s) => ({ byPlay: { ...s.byPlay, [playId]: change(s.byPlay[playId] ?? EMPTY) } }))
  write()
}

function say(playId: string, from: Line['from'], text: string, note = false) {
  patchThread(playId, (t) => {
    const last = t.lines[t.lines.length - 1]
    if (from === 'bot' && !note && last?.from === 'bot' && last.text === text) return t
    return { ...t, lines: [...t.lines, { id: `${Date.now()}-${n++}`, from, text, ...(note ? { note } : {}) }] }
  })
}

/** A Summary edit on a play leaves a small line in its chat. */
export function noteInPlayChat(playId: string, text: string) {
  say(playId, 'bot', text, true)
}

/** Plays whose go-live check sent the user off to fix something first. */
const goLiveAfter = new Set<string>()

function rowsFor(playId: string): TaskRow[] {
  return playChatRows(playId, readSetupInputs())
}

function allRows(playId: string): TaskRow[] {
  const i = readSetupInputs()
  return [...playRows(playId, i), ...workspaceRows(i)]
}

function ask(play: CancelPlay, row: TaskRow, quiet = false) {
  let target = row
  if (row.entry.id === 'goLive') {
    const check = finalCheck(allRows(play.id), playChecks(play.id, readSetupInputs()))
    say(play.id, 'bot', finalCheckText(check, 'go live'))
    quiet = true
    if (check.blockers.length > 0) {
      target = check.blockers[0]
      if (usePlayChat.getState().byPlay[play.id]?.item?.id !== target.entry.id) say(play.id, 'bot', promptFor(target))
    }
    if (target !== row) goLiveAfter.add(play.id)
    else goLiveAfter.delete(play.id)
  }
  patchThread(play.id, (t) => ({ ...t, item: { id: target.entry.id, targetId: target.targetId }, done: false }))
  if (!quiet) say(play.id, 'bot', promptFor(target))
}

function advance(play: CancelPlay, afterId: string) {
  if (goLiveAfter.has(play.id)) {
    const rows = allRows(play.id)
    const goLive = rows.find((r) => r.entry.id === 'goLive')
    const blockers = finalCheck(rows, playChecks(play.id, readSetupInputs())).blockers.filter((r) => r.entry.id !== afterId)
    if (goLive && goLive.status !== 'done') {
      if (blockers.length > 0) return ask(play, blockers[0])
      goLiveAfter.delete(play.id)
      return ask(play, goLive)
    }
  }
  goLiveAfter.delete(play.id)
  const next = nextRow(rowsFor(play.id), { not: afterId })
  if (next) return ask(play, next)
  patchThread(play.id, (t) => ({ ...t, item: null, done: true }))
  say(play.id, 'bot', play.status === 'live' ? `${play.name} is live. Change anything here and it applies right away.` : `That’s everything I can do for ${play.name} from here. The Task list shows what still has to pass.`)
}

const INTENTS: { re: RegExp; id: string }[] = [
  { re: /\b(who|audience|segment|target)/i, id: 'audience' },
  { re: /\b(split|percent|a\/b|ab test|traffic)/i, id: 'split' },
  { re: /\b(control|holdout|hold back|lift)/i, id: 'control' },
  { re: /\b(language|translat|locale)/i, id: 'language' },
  { re: /\b(live|launch|publish|go)\b/i, id: 'goLive' },
  { re: /\b(order|priority|first|wins)/i, id: 'priority' },
  { re: /\b(name|rename|call it)/i, id: 'playName' },
  { re: /\b(window|leave .* alone|again)/i, id: 'saveWindow' },
  { re: /\b(variant|experience)/i, id: 'variants' },
  { re: /\b(domain)/i, id: 'domain' },
  { re: /\b(alert|slack|email|webhook)/i, id: 'alerts' },
  { re: /\b(install|billing|snippet|connect)/i, id: 'install' },
]

function VariantsNotReady({ play }: { play: CancelPlay }) {
  const inputs = useSetupInputs()
  const threads = useWorkspace((s) => s.threads)
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="mb-[8px] text-[12px] text-slate-500">Each experience is set up on its own. Open one to finish it.</p>
      <ul className="space-y-[4px]">
        {play.variants.map((v, i) => {
          const left = failing(experienceChecks(v.experienceId, inputs)).length
          const live = inputs.threads.find((t) => t.id === v.experienceId)?.snapshot?.play.publishState === 'live' || (v.experienceId === inputs.activeId && inputs.activeLive)
          return (
            <li key={v.id} className="flex items-center gap-[8px] rounded-xl border border-slate-100 px-[10px] py-[6px] text-[12.5px]">
              <span className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-md bg-slate-100 text-[10.5px] font-bold text-slate-600">{variantLetter(i)}</span>
              <span className="min-w-0 flex-1 truncate text-slate-800">{threads.find((t) => t.id === v.experienceId)?.title}</span>
              <span className="flex-none text-[11px] text-slate-500">{live ? 'Published' : left === 0 ? 'Ready to publish' : `${left === 1 ? 'One check' : `${left} checks`} left`}</span>
              <button
                type="button"
                onClick={() => {
                  openExperience(v.experienceId, play.id)
                  openTab('tasks')
                }}
                className="flex-none text-[12px] font-semibold text-indigo-600 hover:underline"
              >
                Open
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Copilot for a play: who it's for, the split, the control group, order and going live. */
export function PlayChat({ play }: { play: CancelPlay }) {
  const thread = usePlayChat((s) => s.byPlay[play.id] ?? EMPTY)
  const setupAsk = useWorkspaceUi((s) => s.setupAsk)
  const inputs = useSetupInputs()
  const rows = playChatRows(play.id, inputs)
  const left = leftCount(rows)
  const focus = thread.item ? [...playRows(play.id, inputs), ...workspaceRows(inputs)].find((r) => r.entry.id === thread.item!.id) ?? null : null
  const [draft, setDraft] = useState('')
  const scroll = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scroll.current
    if (el) el.scrollTop = el.scrollHeight
  }, [thread.lines.length, thread.item?.id])

  useEffect(() => {
    if (thread.lines.length > 0 || usePlayChat.getState().byPlay[play.id]?.lines.length) return
    say(play.id, 'bot', `This is ${play.name}. I’ll help you set who it’s for, how people are split between variants, and when it goes live. Skip anything you want to come back to.`)
    if (useWorkspaceUi.getState().setupAsk) return
    const next = nextRow(rowsFor(play.id))
    if (next) ask(play, next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play.id])

  useEffect(() => {
    if (!setupAsk) return
    const entry = entryById(setupAsk.item)
    if (!entry || entry.scope === 'experience') return
    if (entry.scope === 'play' && setupAsk.targetId !== play.id) return
    useWorkspaceUi.setState({ setupAsk: null })
    const row = allRows(play.id).find((r) => r.entry.id === entry.id)
    if (row && thread.item?.id !== row.entry.id) ask(play, row)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupAsk, play.id])

  const focusDone = focus?.status === 'done'
  useEffect(() => {
    if (!focus || !focusDone) return
    if (focus.entry.id === 'goLive' || focus.entry.id === 'variantsReady' || focus.entry.id === 'test') {
      if (focus.entry.id === 'goLive') say(play.id, 'bot', `${play.name} is live.`)
      advance(play, focus.entry.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusDone, thread.item?.id])

  const send = () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    say(play.id, 'you', text)
    const hit = INTENTS.find((i) => i.re.test(text))
    const row = hit ? allRows(play.id).find((r) => r.entry.id === hit.id) : undefined
    if (row) {
      window.setTimeout(() => ask(play, row), 250)
      return
    }
    window.setTimeout(
      () => say(play.id, 'bot', 'Here I can set who the play is for, the split, the control group, the order, the language and going live. To change what a page says, open that experience.'),
      250,
    )
  }

  const onSkip = (row: TaskRow) => {
    setMark(row.targetId, row.entry.id, 'skipped', 'chat')
    say(play.id, 'you', 'Skip for now')
    advance(play, row.entry.id)
  }

  const card = focus && (
    <div>
      {focus.entry.id === 'variantsReady' ? (
        <VariantsNotReady play={play} />
      ) : (
        <SetupCard
          entry={focus.entry}
          targetId={focus.targetId}
          mode="chat"
          onSave={(said) => {
            say(play.id, 'you', said)
            advance(play, focus.entry.id)
          }}
          onSkip={() => onSkip(focus)}
          onNotNeeded={() => {
            setMark(focus.targetId, focus.entry.id, 'na', 'chat')
            say(play.id, 'you', 'Not needed')
            advance(play, focus.entry.id)
          }}
          onShowMe={() => (focus.entry.id === 'test' ? openPlayTab(play.id, 'canvas') : showMe(focus))}
        />
      )}
      {focus.status === 'waiting' && (
        <p className="mt-[6px] px-[4px] text-[12px] text-amber-700">Waiting on {focus.waitingOn.join(', ').toLowerCase()}.</p>
      )}
      <button
        type="button"
        onClick={() => {
          patchThread(play.id, (t) => ({ ...t, item: null, done: true }))
          say(play.id, 'you', 'Stop for now')
          say(play.id, 'bot', 'No problem. Pick it up any time with Resume setup, or from the Task list.')
        }}
        className="mt-[8px] inline-flex items-center gap-[5px] rounded-[8px] px-[6px] py-[4px] text-[12.5px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      >
        Stop for now
      </button>
    </div>
  )

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white">
      <div className="flex h-[60px] flex-none items-center gap-[10px] px-[16px]" style={{ background: COPILOT_UI.header, borderBottom: `1px solid ${COPILOT_UI.hairline}` }}>
        <div className="min-w-0">
          <h2 className="truncate text-[17px] font-bold leading-tight tracking-tight" style={{ color: COPILOT_UI.title }}>
            Growth Copilot
          </h2>
          <p className="truncate text-[13px] leading-tight" style={{ color: COPILOT_UI.muted }}>
            {play.name}
          </p>
        </div>
      </div>
      <div ref={scroll} className="min-h-0 flex-1 overflow-y-auto px-[16px] pb-[24px] pt-[12px]">
        <div className="space-y-[16px]">
          {thread.lines.map((l) =>
            l.note ? (
              <div key={l.id} className="flex items-center justify-center gap-[6px] px-[12px] text-center text-[12px] text-[#677488]">
                <SIcon name="pencil" size={11} className="flex-none" />
                <span className="min-w-0">{l.text}</span>
              </div>
            ) : l.from === 'you' ? (
              <div key={l.id} className="flex justify-end pl-[36px]">
                <div className="w-fit max-w-[92%] rounded-[20px] px-[16px] py-[10px] text-[15px] leading-[1.45]" style={{ background: COPILOT_UI.userBubble, color: COPILOT_UI.userText }}>
                  {l.text}
                </div>
              </div>
            ) : (
              <div key={l.id} className="flex items-start gap-[10px]">
                <CopilotMark size={20} className="mt-[2px] shrink-0" alt="" />
                <div className="w-fit max-w-full whitespace-pre-line rounded-[20px] border px-[16px] py-[10px] text-[15px] leading-[1.55]" style={{ background: COPILOT_UI.botBubble, borderColor: COPILOT_UI.botBorder, color: COPILOT_UI.botText }}>
                  {l.text}
                </div>
              </div>
            ),
          )}
        </div>
        <div className="mt-[16px]" key={thread.item?.id ?? 'none'}>
          {card}
          {!focus && (
            <div className="flex flex-wrap gap-2">
              {left > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    say(play.id, 'you', 'Resume setup')
                    const next = nextRow(rowsFor(play.id), { includeSkipped: true })
                    if (next) ask(play, next)
                  }}
                  className="rounded-full border border-slate-200 bg-white px-[12px] py-[6px] text-[13px] font-medium text-slate-800 hover:bg-slate-50"
                >
                  Resume setup ({left} left)
                </button>
              )}
              <button
                type="button"
                onClick={() => openPlayTab(play.id, 'canvas')}
                className="rounded-full border border-slate-200 bg-white px-[12px] py-[6px] text-[13px] font-medium text-slate-800 hover:bg-slate-50"
              >
                Test with a subscriber
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="flex-none px-[16px] pb-[12px] pt-[4px]">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
          className="flex items-end gap-[8px] rounded-[16px] border border-slate-200 bg-white px-[12px] py-[8px] focus-within:border-slate-400"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            rows={1}
            placeholder="Who it’s for, the split, control, order, or go live"
            className="max-h-[120px] min-h-[24px] flex-1 resize-none bg-transparent text-[14px] outline-none placeholder:text-slate-400"
          />
          <button type="submit" aria-label="Send" disabled={!draft.trim()} className="flex h-[28px] w-[28px] flex-none items-center justify-center rounded-full text-white disabled:opacity-40" style={{ background: COPILOT_UI.send }}>
            <SIcon name="arrow-up" size={14} />
          </button>
        </form>
      </div>
    </div>
  )
}
