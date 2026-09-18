import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useJourney } from '../store/useJourney'
import { useOrchestration } from '../store/useOrchestration'
import { useExperience } from '../store/useExperience'
import { EMPTY_JOURNEY, type JourneyTemplate } from '../journey/types'
import { LIBRARY, startFromTemplate, templateLabel, templatePosture, withLive } from '../journey/templates'
import { interpret } from '../journey/intake'
import { compileBrand } from '../brand/theme'
import { isBrandIntent, isBrandMatched, matchMerchantBrand } from '../brand/matchSite'
import { renderContext } from '../journey/contextDoc'
import {
  PlanBeatCard,
  PlanSummary,
  beatPrompt,
  nextBeat,
  planIntro,
  type PlanBeat,
} from './JourneyPlan'
import { spotlightForBeat } from './spotlight'
import { SpotlightFrame } from './SpotlightFrame'
import { SIcon } from '@chargebee/sting-react'
import { CopilotHomeSetup } from './CopilotHomeSetup'
import { DesignModeIcon } from './DesignModeIcon'
import { useCopilotThread, type CopilotLine } from './copilotThread'
import { COPILOT_UI } from './copilotUi'
import { useAssistant } from './assistant/useAssistant'
import { useUpload } from '../upload/useUpload'
import { UploadTemplate } from '../upload/UploadTemplate'
import { ConfirmManifest } from '../upload/ConfirmManifest'
import { StepStrip } from './StepStrip'
import { CopilotMark } from './CopilotMark'
import { useMerchantLibrary } from '../store/useMerchantLibrary'
import { applyMerchantJourney, attachComponent, matchingComponents, startFromComponent } from '../library/apply'
import { attachedChromeCopy, savedToLibraryCopy, scanReviewCopy, startedFromComponentCopy } from '../library/review'
import { CB_KIND_LABELS, type CbKind } from '../upload/contract'

function scrollSpotlightInto(container: HTMLElement): boolean {
  const marked = container.querySelector<HTMLElement>('[data-spotlight-on]')
  if (!marked) return false
  const cRect = container.getBoundingClientRect()
  const mRect = marked.getBoundingClientRect()
  container.scrollTop += mRect.top - cRect.top - (cRect.height - mRect.height) / 2
  return true
}

function OptionBtn({
  label,
  hint,
  onClick,
}: {
  label: string
  hint?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[16px] border border-[#e5e7eb] bg-white px-[16px] py-[12px] text-left transition-colors hover:bg-[#fbfcfd]"
    >
      <div className="text-[14px] font-medium text-[#19191f]">{label}</div>
      {hint && <div className="mt-[2px] text-[12.5px] text-[#677488]">{hint}</div>}
    </button>
  )
}

function OptionGroup({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#677488]">{label}</p>
      {children}
    </div>
  )
}

function LibraryCta({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-slate-900 bg-slate-900 px-4 py-3.5 text-left text-white transition-colors hover:bg-slate-800"
    >
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-white/10" aria-hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold">Browse templates</span>
        <span className="mt-0.5 block text-[11.5px] text-white/70">Chargebee postures, or switch to My templates</span>
      </span>
      <span className="text-[16px] text-white/50" aria-hidden>
        →
      </span>
    </button>
  )
}

function AnnotateApply({ messageId }: { messageId: number }) {
  const action = useAssistant((s) => s.messages.find((m) => m.id === messageId)?.action)
  const applyMessageAction = useAssistant((s) => s.applyMessageAction)
  if (!action) return null
  return (
    <button
      type="button"
      onClick={() => applyMessageAction(messageId)}
      disabled={action.applied}
      className={`mt-1.5 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
        action.applied
          ? 'cursor-default bg-emerald-50 text-emerald-700'
          : 'bg-slate-900 text-white hover:bg-slate-800'
      }`}
    >
      {action.applied ? (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Applied
        </>
      ) : (
        action.label
      )}
    </button>
  )
}

/** Copilot composer: paperclip, growing field, blue send. */
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
    <div
      className="relative rounded-[20px] border border-[#e5e7eb] bg-white transition-colors focus-within:border-[#c5cdd8]"
    >
      <span className="pointer-events-none absolute bottom-[14px] left-[14px] text-[#677488]" aria-hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      </span>
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
        className="min-h-[52px] max-h-[160px] w-full resize-none bg-transparent py-[14px] pl-[40px] pr-[48px] text-[14px] leading-[1.5] text-[#19191f] outline-none placeholder:text-[#9aa3b2]"
      />
      <button
        type="button"
        onClick={onSend}
        disabled={!value.trim()}
        title="Send"
        className="absolute bottom-[10px] right-[10px] flex h-[32px] w-[32px] items-center justify-center rounded-[10px] text-white transition-opacity hover:opacity-90 disabled:opacity-30"
        style={{ background: COPILOT_UI.send }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3.4 20.4 22 12 3.4 3.6 3 10.7l12.2 1.3L3 13.3z" />
        </svg>
      </button>
    </div>
  )
}

/**
 * Prompt fills the file; Code is the file. Chrome matches Chargebee Copilot;
 * the suggestions are cancel-journey workflows, not billing FAQs.
 */
function HeaderIconButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string
  pressed?: boolean
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      className={`flex h-[32px] w-[32px] items-center justify-center rounded-[8px] ${
        pressed ? 'bg-[#e7f1fe] text-[#183d7a]' : 'text-[#677488] hover:bg-[#f3f4f6]'
      }`}
    >
      {children}
    </button>
  )
}

function ChatLine({ line, children }: { line: CopilotLine; children?: ReactNode }) {
  if (line.from === 'you') {
    return (
      <div className="flex justify-end pl-[36px]">
        <div className="max-w-[min(92%,520px)]">
          {line.ref && (
            <div className="mb-[4px] text-right text-[11px] font-medium text-[#677488]">On {line.ref}</div>
          )}
          <div
            className="w-fit max-w-full rounded-[20px] px-[16px] py-[10px] text-[15px] leading-[1.45]"
            style={{ background: COPILOT_UI.userBubble, color: COPILOT_UI.userText }}
          >
            {line.text}
          </div>
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-[10px]">
      <CopilotMark size={20} className="mt-[2px] shrink-0" alt="" />
      <div className="min-w-0 flex-1">
        {line.ref && (
          <div className="mb-[4px] text-[11px] font-medium text-[#677488]">On {line.ref}</div>
        )}
        {line.text && (
          <div
            className="w-fit max-w-[min(100%,560px)] rounded-[20px] border px-[16px] py-[10px] text-[15px] leading-[1.55]"
            style={{
              background: COPILOT_UI.botBubble,
              borderColor: COPILOT_UI.botBorder,
              color: COPILOT_UI.botText,
            }}
          >
            {line.text}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
export function PromptCodeDock({ compact = false }: { compact?: boolean }) {
  const dockMode = useJourney((s) => s.dockMode)
  const setDockMode = useJourney((s) => s.setDockMode)
  const file = useJourney((s) => s.file)
  const replaceFile = useJourney((s) => s.replaceFile)
  const applyBrand = useJourney((s) => s.applyBrand)
  const applyContextDoc = useJourney((s) => s.applyContextDoc)
  const contextError = useJourney((s) => s.contextError)
  const setAssistantOpen = useOrchestration((s) => s.setAssistantOpen)
  const annotateMode = useOrchestration((s) => s.annotateMode)
  const setAnnotateMode = useOrchestration((s) => s.setAnnotateMode)
  const closeAnnotation = useOrchestration((s) => s.closeAnnotation)
  const focusing = useOrchestration((s) => s.focusTarget !== null)
  const openTemplates = useOrchestration((s) => s.openTemplates)
  const templatesOpen = useOrchestration((s) => s.templatesOpen)
  const pendingLibraryTemplate = useOrchestration((s) => s.pendingLibraryTemplate)
  const pendingMerchantTemplate = useOrchestration((s) => s.pendingMerchantTemplate)
  const pendingMerchantComponent = useOrchestration((s) => s.pendingMerchantComponent)
  const pendingCopilotGuide = useOrchestration((s) => s.pendingCopilotGuide)
  const setupDoor = useOrchestration((s) => s.setupDoor)
  const copilotDocked = useOrchestration((s) => s.copilotDocked)
  const uploadPhase = useUpload((s) => s.phase)
  const uploadChecklist = useUpload((s) => s.checklist)
  const uploadManifest = useUpload((s) => s.manifest)
  const uploadArtifact = useUpload((s) => s.artifact)
  const libraryComponents = useMerchantLibrary((s) => s.components)

  const lines = useCopilotThread((s) => s.lines)
  const say = useCopilotThread((s) => s.say)
  const resetThread = useCopilotThread((s) => s.reset)
  const turn = useCopilotThread((s) => s.turn)
  const setTurn = useCopilotThread((s) => s.setTurn)
  const beat = useCopilotThread((s) => s.beat)
  const setBeat = useCopilotThread((s) => s.setBeat)
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const contextFocused = useRef(false)
  const contextDoc = useMemo(() => renderContext(file), [file])
  const [draftContext, setDraftContext] = useState(contextDoc)

  const emptyHome =
    dockMode === 'prompt' &&
    turn === 'kind' &&
    lines.length === 0 &&
    file.steps.length === 0 &&
    !setupDoor

  useEffect(() => {
    if (annotateMode) setDockMode('prompt')
  }, [annotateMode, setDockMode])

  useEffect(() => {
    if (!contextFocused.current) setDraftContext(contextDoc)
  }, [contextDoc])

  const applyDraftContext = () => {
    applyContextDoc(draftContext)
    const next = useJourney.getState()
    if (!next.contextError) setDraftContext(renderContext(next.file))
  }

  const spotlight = useOrchestration((s) => s.spotlight)
  const spotlightNonce = useOrchestration((s) => s.spotlightNonce)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (spotlight && scrollSpotlightInto(el)) return
    el.scrollTop = el.scrollHeight
  }, [lines, turn, beat])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !spotlight) return
    const id = window.requestAnimationFrame(() => scrollSpotlightInto(el))
    return () => window.cancelAnimationFrame(id)
  }, [spotlight, spotlightNonce])

  const reset = () => {
    replaceFile({ ...EMPTY_JOURNEY, brand: useJourney.getState().file.brand })
    useOrchestration.getState().resetSetup()
    setTurn('kind')
    setBeat('walk')
    setDraft('')
    resetThread()
  }

  const conversationStarted =
    file.steps.length > 0 ||
    draft.trim().length > 0 ||
    lines.filter((l) => l.from === 'you').length > 1

  const goBack = () => {
    if (copilotDocked || !conversationStarted) {
      reset()
      return
    }
    useOrchestration.getState().dockCopilot()
  }

  const showStepStrip = () => {
    useOrchestration.getState().markStepStripShown()
    say('bot', 'This is the chain a subscriber walks. Drag if the order is wrong.', { widget: 'steps' })
  }

  const beginPostCanvas = () => {
    const current = useJourney.getState().file
    setTurn('plan')
    const start: typeof beat = isBrandMatched(current.brand) ? 'walk' : 'brand'
    setBeat(start)
    say('bot', beatPrompt(start, current))
  }

  /** Recap first — brand is a required chat beat, not a sticky pane. */
  const landPlan = (next: typeof file) => {
    const live = { ...next, steps: withLive(next.steps, true) }
    replaceFile(live)
    say('bot', planIntro(live), { widget: 'plan' })
    showStepStrip()
    if (live.source === 'authored') useOrchestration.getState().setSpotlight('journey')
    beginPostCanvas()
  }

  const continuePlan = (said: string) => {
    if (beat === 'brand' && !isBrandMatched(useJourney.getState().file.brand)) return
    say('you', said)
    const orch = useOrchestration.getState()
    if (beat === 'walk') orch.setWalkedOrSkipped(true)
    if (beat === 'audience') orch.confirmSetupItem('audience')
    if (beat === 'holdout') orch.confirmSetupItem('holdout')
    if (beat === 'offers') orch.confirmSetupItem('offers')
    const current = useJourney.getState().file
    const next = nextBeat(current, beat)
    if (next) {
      setBeat(next)
      const look = spotlightForBeat(next)
      say('bot', beatPrompt(next, current), look ? { look } : undefined)
    } else {
      setTurn('done')
    }
  }

  const keepDefaults = () => {
    const current = useJourney.getState().file
    if (!isBrandMatched(current.brand)) {
      setTurn('plan')
      setBeat('brand')
      say('bot', beatPrompt('brand', current), { look: 'brand' })
      return
    }
    const orch = useOrchestration.getState()
    orch.confirmSetupItem('audience')
    orch.confirmSetupItem('holdout')
    orch.setWalkedOrSkipped(true)
    say('you', 'Keep defaults and walk it')
    setTurn('plan')
    setBeat('publish')
    say('bot', beatPrompt('publish', current), { look: 'walk' })
    useExperience.getState().setMode('play')
  }

  const jumpPlan = (next: PlanBeat) => {
    const current = useJourney.getState().file
    const alreadyOnBeat = turn === 'plan' && beat === next
    setTurn('plan')
    setBeat(next)
    const look = spotlightForBeat(next)
    if (look) useOrchestration.getState().setSpotlight(look)
    if (alreadyOnBeat) return
    say('bot', beatPrompt(next, current), look ? { look } : undefined)
  }

  const applyTemplate = (template: JourneyTemplate) => {
    if (template === 'none') return
    const next = startFromTemplate(useJourney.getState().file, template)
    landPlan(next)
  }

  const recommendTemplate = (template: JourneyTemplate, said: string) => {
    say('you', said)
    const entry = LIBRARY.find((e) => e.id === template)
    if (entry) say('bot', entry.why)
    applyTemplate(template)
  }

  const startUpload = () => {
    say('you', 'Upload my own template')
    say(
      'bot',
      'I’ll scan whatever you drop, reject unmarked chrome with a checklist, then you bind the catalog. Targeting, holdout, and publish stay here.',
      { look: 'upload' },
    )
    setTurn('upload')
    useUpload.getState().open()
  }

  const startLibrary = () => {
    useOrchestration.getState().openTemplates('ours')
  }

  const startYours = () => {
    useOrchestration.getState().openTemplates('yours')
  }

  const afterUploadConfirm = () => {
    const live = useJourney.getState().file
    const saved = live.artifact
      ? useMerchantLibrary.getState().templates.find((t) => t.checksum === live.artifact?.checksum)
      : undefined
    say('bot', savedToLibraryCopy(saved?.name ?? live.name, saved?.stepLabels ?? []))
    say(
      'bot',
      'Hosted. Catalog binds are Copilot’s. This is the chain a subscriber walks — then we match the look.',
    )
    showStepStrip()
    beginPostCanvas()
  }

  const applyMatchedBrand = async (text: string) => {
    const result = await matchMerchantBrand(text, compileBrand(useJourney.getState().file.brand))
    if (!result.applied) {
      say('bot', result.reply)
      return false
    }
    applyBrand(result.branding, true)
    say('bot', result.reply)
    return true
  }

  const startGuide = () => {
    say('you', 'Help me choose a cancel flow')
    say('bot', 'What job is this cancel for? I’ll pick a path and put defaults in so you can walk it.')
    setTurn('guide')
  }

  const startAcquire = () => {
    say('you', 'Pricing table → hosted checkout')
    const entry = LIBRARY.find((e) => e.id === 'acquire_2')
    if (entry) say('bot', entry.why)
    const next = startFromTemplate(
      { ...EMPTY_JOURNEY, kind: 'acquisition', brand: useJourney.getState().file.brand },
      'acquire_2',
    )
    landPlan(next)
  }

  /** Same path for suggestion chips and the template library. Brand from the current file is kept. */
  const startTemplate = (template: JourneyTemplate) => {
    if (template === 'none') return
    say('you', templateLabel(template))
    applyTemplate(template)
  }

  useEffect(() => {
    const template = useOrchestration.getState().pendingLibraryTemplate
    if (!template) return
    useOrchestration.getState().consumeLibraryTemplate()
    startTemplate(template)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingLibraryTemplate])

  useEffect(() => {
    const id = useOrchestration.getState().pendingMerchantTemplate
    if (!id) return
    useOrchestration.getState().consumeMerchantLibrary()
    const saved = useMerchantLibrary.getState().getTemplate(id)
    if (!saved) return
    say('you', saved.name)
    say('bot', `Opened “${saved.name}” from My templates. Copilot still fills brand, audience, holdout, and walk.`)
    landPlan(
      applyMerchantJourney(
        useJourney.getState().file,
        saved,
        useMerchantLibrary.getState().components,
      ),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMerchantTemplate])

  useEffect(() => {
    const id = useOrchestration.getState().pendingMerchantComponent
    if (!id) return
    useOrchestration.getState().consumeMerchantLibrary()
    const found = useMerchantLibrary.getState().getComponent(id)
    if (!found) return
    const current = useJourney.getState().file
    const blank = current.steps.length === 0
    const next = blank ? startFromComponent(current, found) : attachComponent(current, found)
    say('you', `Use ${found.label} chrome`)
    say(
      'bot',
      blank
        ? startedFromComponentCopy(found.label)
        : attachedChromeCopy(found.label, templatePosture(next.template) || next.name),
    )
    landPlan(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMerchantComponent])

  const reviewKey = useRef('')
  useEffect(() => {
    if (turn !== 'upload') return
    if (uploadChecklist.length > 0) {
      const key = `err:${uploadChecklist.map((i) => i.message).join('|')}`
      if (reviewKey.current === key) return
      reviewKey.current = key
      say('bot', scanReviewCopy({ issues: uploadChecklist }))
      return
    }
    if (uploadPhase === 'confirm' && uploadManifest) {
      const key = `ok:${uploadArtifact?.checksum ?? uploadManifest.steps.map((s) => s.id).join(',')}`
      if (reviewKey.current === key) return
      reviewKey.current = key
      say('bot', scanReviewCopy({ manifest: uploadManifest }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, uploadPhase, uploadChecklist, uploadManifest, uploadArtifact])

  useEffect(() => {
    if (!pendingCopilotGuide) return
    useOrchestration.getState().consumeCopilotGuide()
    if (turn === 'kind' && lines.length === 0) startGuide()
    else if (turn !== 'guide') startGuide()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCopilotGuide])

  useEffect(() => {
    const orch = useOrchestration.getState()
    if (!orch.setupDoor || orch.setupDoorConsumed) return
    orch.consumeSetupDoor()
    if (orch.setupDoor === 'library') startLibrary()
    else if (orch.setupDoor === 'yours') startYours()
    else if (orch.setupDoor === 'upload') startUpload()
    else if (orch.setupDoor === 'guide') startGuide()
    else if (orch.setupDoor === 'acquire') startAcquire()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupDoor])

  const confirmPlan = () => {
    if (beat === 'publish') {
      useOrchestration.getState().setPublishGapsOpen(true)
      useOrchestration.getState().togglePublish()
      say('you', 'Publish')
      say(
        'bot',
        'Live in this prototype. Remaining gaps stay on the tracker — you can still fill them.',
      )
      setTurn('done')
      return
    }
    say('you', 'Looks good — I’m done for now')
    say(
      'bot',
      'File is the source of truth. Reopen the plan to reconfigure, switch to Context to edit it, or walk it as a subscriber.',
    )
    setTurn('done')
  }

  /**
   * Typing skips the turns. Brand matching can sample a live URL; everything
   * else is a patch to the journey file, then we land on the recap.
   */
  const send = () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    say('you', text)
    if (turn === 'plan' && beat === 'brand') {
      void applyMatchedBrand(text).then((ok) => {
        if (!ok) return
        const current = useJourney.getState().file
        const next = nextBeat(current, 'brand')
        if (next) {
          setBeat(next)
          const look = spotlightForBeat(next)
          say('bot', beatPrompt(next, current), look ? { look } : undefined)
        }
      })
      return
    }
    if (isBrandIntent(text) && !/\b(cancel|acquire|acquisition|step|survey|offer|pause|discount|checkout|pricing)\b/i.test(text)) {
      void applyMatchedBrand(text)
      return
    }
    const read = interpret(text, file)
    if (read.changed) replaceFile(read.file)
    say('bot', read.reply)
    if (read.changed && read.file.steps.length > 0) {
      say('bot', planIntro(read.file), { widget: 'plan' })
      showStepStrip()
      beginPostCanvas()
    }
  }

  const options = useMemo(() => {
    if (pendingLibraryTemplate) return null
    if (turn === 'upload') {
      return uploadPhase === 'confirm' ? (
        <ConfirmManifest onConfirmed={afterUploadConfirm} />
      ) : (
        <UploadTemplate />
      )
    }
    if (turn === 'kind') {
      return (
        <div className="space-y-5">
          <OptionGroup label="Start a cancel">
            <OptionBtn
              label="Help me choose a cancel flow"
              hint="I’ll ask the job, then recommend a path"
              onClick={startGuide}
            />
            <OptionBtn
              label="Use the recommended 4-step default"
              hint="Value, survey, one save offer, confirm"
              onClick={() => recommendTemplate('cancel_4', 'Use the recommended 4-step default')}
            />
            <OptionBtn
              label="Offer a cheaper plan before they leave"
              hint="Pricing table and checkout, then they can still cancel"
              onClick={() =>
                recommendTemplate('cancel_plan_change', 'Offer a cheaper plan before they leave')
              }
            />
          </OptionGroup>
          <LibraryCta onClick={() => openTemplates('ours')} />
          <OptionBtn
            label="My existing templates"
            hint="Journeys and components you already scanned"
            onClick={startYours}
          />
          <OptionBtn
            label="Upload a template"
            hint="Download the Growth kit, then drop the composed HTML"
            onClick={startUpload}
          />
        </div>
      )
    }
    if (turn === 'guide') {
      return (
        <div className="space-y-2">
          <OptionBtn
            label="I have to let people leave in one click"
            hint="Comply / FTC-style — confirm and they’re out"
            onClick={() => recommendTemplate('cancel_1', 'I have to let people leave in one click')}
          />
          <OptionBtn
            label="I want a fair save"
            hint="Recommended — value, survey, one offer, confirm"
            onClick={() => recommendTemplate('cancel_4', 'I want a fair save')}
          />
          <OptionBtn
            label="I want them to pick a cheaper plan"
            hint="Plan picker and checkout, then they can still leave"
            onClick={() =>
              recommendTemplate('cancel_plan_change', 'I want them to pick a cheaper plan')
            }
          />
          <OptionBtn
            label="I need to save as many as I can"
            hint="Two offers — heavier than most merchants need"
            onClick={() => recommendTemplate('cancel_5', 'I need to save as many as I can')}
          />
          <OptionBtn
            label="Not sure — recommend one"
            hint="I’ll start you on the fair save path"
            onClick={() => recommendTemplate('cancel_4', 'Not sure — recommend one')}
          />
        </div>
      )
    }
    if (turn === 'plan') {
      const attachable = matchingComponents(file, libraryComponents).filter(
        (c) => !file.steps.some((s) => s.kind === c.kind && s.chrome?.libraryComponentId === c.id),
      )
      return (
        <div className="space-y-4">
          {attachable.length > 0 && file.source !== 'uploaded' && (
            <div className="space-y-2">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#677488]">
                Your chrome
              </p>
              {attachable.slice(0, 4).map((c) => (
                <OptionBtn
                  key={c.id}
                  label={`Use saved ${CB_KIND_LABELS[c.kind as CbKind] ?? c.label}`}
                  hint="Reuses the same library object — Copilot keeps brand and targeting"
                  onClick={() => {
                    const next = attachComponent(useJourney.getState().file, c)
                    say('you', `Use ${c.label} chrome`)
                    replaceFile(next)
                    say('bot', attachedChromeCopy(c.label, templatePosture(next.template) || next.name))
                  }}
                />
              ))}
            </div>
          )}
          <SpotlightFrame id={spotlightForBeat(beat) ?? 'plan'}>
            <PlanBeatCard
              beat={beat}
              onContinue={continuePlan}
              onConfirm={confirmPlan}
              onPreview={() => {
                useOrchestration.getState().setWalkedOrSkipped(true)
                useExperience.getState().setMode('play')
              }}
              onKeepDefaults={keepDefaults}
            />
          </SpotlightFrame>
        </div>
      )
    }
    if (turn === 'done') {
      return (
        <div className="space-y-2">
          <OptionBtn label="Tweak the plan" hint="Change only the rows that still matter" onClick={() => jumpPlan('audience')} />
          <OptionBtn
            label="Walk this as a subscriber"
            onClick={() => {
              useOrchestration.getState().setWalkedOrSkipped(true)
              useExperience.getState().setMode('play')
            }}
          />
          <OptionBtn label="Start over" hint="Clears the file and the canvas" onClick={reset} />
        </div>
      )
    }
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, beat, file, uploadPhase, pendingLibraryTemplate, libraryComponents])

  const subtitle = emptyHome
    ? 'New Conversation'
    : dockMode === 'code'
      ? 'Journey context'
      : file.name && file.template !== 'none'
        ? file.name
        : 'New Conversation'

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white">
      <div
        className="flex h-[60px] flex-none items-center justify-between gap-[12px] px-[16px]"
        style={{ background: COPILOT_UI.header, borderBottom: `1px solid ${COPILOT_UI.hairline}` }}
      >
        <div className="flex min-w-0 items-center gap-[10px]">
          <HeaderIconButton label="Conversations">
            <SIcon name="menu" size={18} />
          </HeaderIconButton>
          <div className="min-w-0">
            <h2
              className="truncate text-[17px] font-bold leading-tight tracking-tight"
              style={{ color: COPILOT_UI.title }}
            >
              Chargebee Copilot
            </h2>
            <p className="truncate text-[13px] leading-tight" style={{ color: COPILOT_UI.muted }}>
              {subtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-[2px]">
          <HeaderIconButton
            label="Templates"
            pressed={templatesOpen}
            onClick={() => openTemplates()}
          >
            <SIcon name="layout-template" size={16} />
          </HeaderIconButton>
          <HeaderIconButton
            label={annotateMode ? 'Exit design mode' : 'Annotate'}
            pressed={annotateMode}
            onClick={() => {
              const next = !annotateMode
              setAnnotateMode(next)
              if (next) {
                setAssistantOpen(true)
                setDockMode('prompt')
              } else {
                closeAnnotation()
              }
            }}
          >
            <DesignModeIcon />
          </HeaderIconButton>
          {(
            [
              { id: 'prompt' as const, label: 'Prompt' },
              { id: 'code' as const, label: 'Context' },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setDockMode(id)}
              className="rounded-[8px] px-[8px] py-[6px] text-[12px] font-semibold"
              style={{
                color: dockMode === id ? COPILOT_UI.title : COPILOT_UI.muted,
                background: dockMode === id ? '#e7f1fe' : 'transparent',
              }}
            >
              {label}
            </button>
          ))}
          {!focusing && !compact && !copilotDocked && (
            <HeaderIconButton label="Collapse Copilot" onClick={() => setAssistantOpen(false)}>
              <SIcon name="panel-right" size={16} />
            </HeaderIconButton>
          )}
        </div>
      </div>

      {dockMode === 'code' ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <p className="flex-none border-b border-slate-100 px-3 py-2 text-[11.5px] leading-relaxed text-slate-500">
            This is the context Copilot built. Edit a sentence; the canvas follows.
          </p>
          <textarea
            value={draftContext}
            onChange={(e) => setDraftContext(e.target.value)}
            onFocus={() => {
              contextFocused.current = true
            }}
            onBlur={() => {
              contextFocused.current = false
              applyDraftContext()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                applyDraftContext()
              }
            }}
            spellCheck
            className="min-h-0 flex-1 resize-none bg-white px-4 py-4 text-[13px] leading-relaxed text-slate-800 outline-none"
          />
          {contextError ? (
            <div className="flex-none border-t border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{contextError}</div>
          ) : (
            <div className="flex-none border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">
              Blur to apply, or ⌘↵
            </div>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <div className="flex w-[44px] flex-none flex-col items-center gap-[8px] pt-[16px]">
            {compact || copilotDocked ? (
              <HeaderIconButton label="Back" onClick={goBack}>
                <SIcon name="arrow-left" size={16} />
              </HeaderIconButton>
            ) : (
              <HeaderIconButton label="New conversation" onClick={reset}>
                <SIcon name="pencil" size={16} />
              </HeaderIconButton>
            )}
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-[16px] pb-[24px] pt-[12px]">
              {emptyHome ? (
                <CopilotHomeSetup
                  onGuide={startGuide}
                  onRecommend={recommendTemplate}
                  onTemplates={() => openTemplates('ours')}
                  onYours={startYours}
                  onUpload={startUpload}
                />
              ) : (
                <>
                  <div className="space-y-[16px]">
                    {lines.map((m) => (
                      <ChatLine key={m.id} line={m}>
                        {m.widget === 'plan' && (
                          <SpotlightFrame id="plan" className="mt-[12px]">
                            <PlanSummary beat={turn === 'plan' ? beat : undefined} onJump={jumpPlan} />
                          </SpotlightFrame>
                        )}
                        {m.widget === 'steps' && (
                          <SpotlightFrame id="journey" className="mt-[12px]">
                            <StepStrip
                              onAccept={() => say('you', 'This order is right')}
                              onReject={reset}
                            />
                          </SpotlightFrame>
                        )}
                        {m.applyMessageId != null && <AnnotateApply messageId={m.applyMessageId} />}
                      </ChatLine>
                    ))}
                  </div>
                  <div className="mt-[16px]">{options}</div>
                </>
              )}
            </div>
            <div className="flex-none px-[16px] pb-[12px] pt-[4px]">
              <PromptInput
                value={draft}
                onChange={setDraft}
                onSend={send}
                placeholder={
                  turn === 'plan' && beat === 'brand'
                    ? 'https://account.example.com — or: dark navy, gold buttons, Inter'
                    : emptyHome
                      ? 'Or say it: 4-step cancel, or a pricing table to acquire subscribers.'
                      : 'Ask Copilot...'
                }
              />
              <p className="mt-[8px] px-[4px] text-center text-[11px] leading-snug text-[#9aa3b2]">
                By using Chargebee Copilot, you accept our third-party AI terms.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
