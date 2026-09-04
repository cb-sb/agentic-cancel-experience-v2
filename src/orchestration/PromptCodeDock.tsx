import { useEffect, useMemo, useRef, useState } from 'react'
import { useJourney } from '../store/useJourney'
import { useOrchestration } from '../store/useOrchestration'
import { useExperience } from '../store/useExperience'
import { EMPTY_JOURNEY, type JourneyTemplate } from '../journey/types'
import { startFromTemplate, templateLabel, withLive } from '../journey/templates'
import { interpret } from '../journey/intake'
import { JourneyPlan } from './JourneyPlan'

type PromptTurn = 'kind' | 'cancel_template' | 'plan' | 'done'

interface ChatLine {
  id: string
  from: 'bot' | 'you'
  text: string
}

function OptionBtn({
  label,
  hint,
  primary,
  onClick,
}: {
  label: string
  hint?: string
  primary?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-slate-50 ${
        primary ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800 hover:text-white' : 'border-slate-200 bg-white'
      }`}
    >
      <div className={`text-[13px] font-semibold ${primary ? 'text-white' : 'text-slate-900'}`}>{label}</div>
      {hint && <div className={`mt-0.5 text-[11.5px] ${primary ? 'text-white/70' : 'text-slate-500'}`}>{hint}</div>}
    </button>
  )
}

/** Free text alongside the guided options, for anyone who already knows the flow. */
function PromptInput({
  value,
  onChange,
  onSend,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  placeholder: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [value])
  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white shadow-[0_1px_6px_-2px_rgba(15,23,42,0.06)] transition-colors focus-within:border-slate-400">
      {/* Bottom padding keeps the growing text clear of the send button. */}
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onSend()
          }
        }}
        placeholder={placeholder}
        className="min-h-[76px] max-h-[160px] w-full resize-none bg-transparent px-3 pb-11 pt-3 text-[13px] leading-[1.5] text-slate-800 outline-none placeholder:text-slate-400"
      />
      <button
        type="button"
        onClick={onSend}
        disabled={!value.trim()}
        title="Send"
        className="absolute bottom-2.5 right-2.5 flex h-[30px] w-[30px] items-center justify-center rounded-md bg-slate-900 text-white transition-colors hover:bg-slate-800 disabled:opacity-30"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>
    </div>
  )
}

/**
 * Prompt fills the file; Code is the file. Same dock Carl asked for — not a
 * settings inspector with a chat bolted on.
 */
export function PromptCodeDock() {
  const dockMode = useJourney((s) => s.dockMode)
  const setDockMode = useJourney((s) => s.setDockMode)
  const yaml = useJourney((s) => s.yaml)
  const yamlError = useJourney((s) => s.yamlError)
  const setYaml = useJourney((s) => s.setYaml)
  const file = useJourney((s) => s.file)
  const replaceFile = useJourney((s) => s.replaceFile)
  const patchFile = useJourney((s) => s.patchFile)
  const setAssistantOpen = useOrchestration((s) => s.setAssistantOpen)

  const [turn, setTurn] = useState<PromptTurn>('kind')
  const [lines, setLines] = useState<ChatLine[]>([
    {
      id: 'hello',
      from: 'bot',
      text: 'What are you building? Same shell either way — a file, a prompt, and a preview.',
    },
  ])
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const [draftYaml, setDraftYaml] = useState(yaml)

  useEffect(() => {
    setDraftYaml(yaml)
  }, [yaml])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines, turn])

  const say = (from: ChatLine['from'], text: string) =>
    setLines((prev) => [...prev, { id: `${Date.now()}-${prev.length}`, from, text }])

  const reset = () => {
    replaceFile(EMPTY_JOURNEY)
    setTurn('kind')
    setDraft('')
    setLines([
      {
        id: 'hello',
        from: 'bot',
        text: 'What are you building? Same shell either way — a file, a prompt, and a preview.',
      },
    ])
  }

  const showPlan = (next: typeof file, message: string) => {
    const live = { ...next, steps: withLive(next.steps, true) }
    replaceFile(live)
    say('bot', message)
    setTurn('plan')
  }

  const pickKind = (kind: 'cancel' | 'acquisition') => {
    say('you', kind === 'cancel' ? 'A cancel experience' : 'An acquisition flow')
    if (kind === 'acquisition') {
      const next = startFromTemplate({ ...EMPTY_JOURNEY, kind: 'acquisition' }, 'acquire_2')
      showPlan(next, 'Pricing table, then checkout. Edit the plan below — audience, shell, brand — then confirm.')
      return
    }
    patchFile({ kind: 'cancel', name: 'Cancel experience' })
    say('bot', 'How many steps? I’ll drop a skeleton, then a plan you can click through.')
    setTurn('cancel_template')
  }

  const pickTemplate = (template: JourneyTemplate) => {
    say('you', templateLabel(template))
    const next = startFromTemplate(file, template)
    showPlan(next, 'Here’s the plan. Change offers, audience, shell, and brand here — you don’t have to type them.')
  }

  const confirmPlan = () => {
    say('you', 'Looks good')
    say('bot', 'File is the source of truth. Reopen the plan to reconfigure, switch to Code to edit it, or Preview to walk it as a subscriber.')
    setTurn('done')
  }

  /**
   * Typing skips the turns. Whatever the free text can be read as goes
   * straight into the file, then we land on the plan so the rest is clicks.
   */
  const send = () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    say('you', text)
    const read = interpret(text, file)
    if (read.changed) replaceFile(read.file)
    say('bot', read.reply)
    if (read.changed && read.file.steps.length > 0) setTurn('plan')
  }

  const options = useMemo(() => {
    if (turn === 'kind') {
      return (
        <div className="space-y-2">
          <OptionBtn primary label="Cancel experience" hint="Save flow: survey, offer, confirm" onClick={() => pickKind('cancel')} />
          <OptionBtn label="Acquisition" hint="Pricing table → checkout" onClick={() => pickKind('acquisition')} />
        </div>
      )
    }
    if (turn === 'cancel_template') {
      return (
        <div className="space-y-2">
          {(['cancel_1', 'cancel_2', 'cancel_3', 'cancel_4', 'cancel_5'] as const).map((id) => (
            <OptionBtn key={id} label={templateLabel(id)} primary={id === 'cancel_4'} onClick={() => pickTemplate(id)} />
          ))}
        </div>
      )
    }
    if (turn === 'plan') {
      return (
        <JourneyPlan
          onConfirm={confirmPlan}
          onPreview={() => useExperience.getState().setMode('play')}
        />
      )
    }
    if (turn === 'done') {
      return (
        <div className="space-y-3">
          <JourneyPlan
            confirmed
            onConfirm={() => setTurn('plan')}
            onPreview={() => useExperience.getState().setMode('play')}
          />
          <OptionBtn label="Start over" hint="Clears the file and the canvas" onClick={reset} />
        </div>
      )
    }
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, file])

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white">
      <div className="flex h-[58px] flex-none items-center justify-between gap-2 border-b border-slate-200 px-3">
        <div className="flex min-w-0 items-center gap-1">
          {turn !== 'kind' && dockMode === 'prompt' && (
            <button
              type="button"
              onClick={reset}
              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100"
              title="Start over"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          <h2 className="truncate text-[15px] font-bold text-slate-900">
            {dockMode === 'code' ? 'Journey file' : 'Prompt'}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {(['prompt', 'code'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setDockMode(m)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold capitalize ${
                  dockMode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setAssistantOpen(false)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100"
            title="Collapse pane"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      {dockMode === 'code' ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <p className="flex-none border-b border-slate-100 px-3 py-2 text-[11.5px] leading-relaxed text-slate-500">
            This is the logic document. Edit it and the preview updates. Invalid YAML stays on the page until it parses.
          </p>
          <textarea
            value={draftYaml}
            onChange={(e) => setDraftYaml(e.target.value)}
            onBlur={() => setYaml(draftYaml)}
            spellCheck={false}
            className="min-h-0 flex-1 resize-none bg-slate-50 px-3 py-3 font-mono text-[12px] leading-relaxed text-slate-800 outline-none"
          />
          {yamlError ? (
            <div className="flex-none border-t border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{yamlError}</div>
          ) : (
            <div className="flex-none border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">
              Blur or tab away to compile
            </div>
          )}
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-3 pb-3 pt-4">
            <div className="space-y-3">
              {lines.map((m) => (
                <div key={m.id} className={m.from === 'you' ? 'flex justify-end' : ''}>
                  <div
                    className={`max-w-[92%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                      m.from === 'you' ? 'bg-slate-900 text-white' : 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">{options}</div>
          </div>
          <div className="flex-none border-t border-slate-200 bg-slate-50 px-3 pb-3 pt-2">
            <PromptInput
              value={draft}
              onChange={setDraft}
              onSend={send}
              placeholder={
                turn === 'kind'
                  ? 'Describe the flow you want…'
                  : turn === 'plan' || turn === 'done'
                    ? 'Type a change, or use the plan above…'
                    : 'Type a change, or pick an option above…'
              }
            />
          </div>
        </>
      )}
    </div>
  )
}
