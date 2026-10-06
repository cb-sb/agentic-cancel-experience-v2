import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useJourney } from '../store/useJourney'
import { useOrchestration } from '../store/useOrchestration'
import { useExperience } from '../store/useExperience'
import { EMPTY_JOURNEY, type JourneyTemplate } from '../journey/types'
import { startFromTemplate, templateLabel, withLive } from '../journey/templates'
import { EXAMPLE_PROMPTS, GOAL_CHOICES, interpret } from '../journey/intake'
import { compileBrand } from '../brand/theme'
import { isBrandIntent, isBrandMatched, matchMerchantBrand } from '../brand/matchSite'
import { ActivityTab } from './ActivityTab'
import { ContextEditor } from './ContextEditor'
import {
  PlanBeatCard,
  PlanSummary,
  SETUP_ONLY_REPLY,
  beatPrompt,
  nextBeat,
  prevBeat,
  v8Landing,
  planCanvasIntro,
  planIntro,
  planProposeIntro,
  type PlanBeat,
} from './JourneyPlan'
import { spotlightForBeat } from './spotlight'
import { SpotlightFrame } from './SpotlightFrame'
import { SIcon } from '@chargebee/sting-react'
import { OptionBtn, StartPaths } from './CopilotHomeSetup'
import { DesignModeIcon } from './DesignModeIcon'
import { landUploadedPlan, useCopilotThread, type CopilotLine } from './copilotThread'
import { COPILOT_UI } from './copilotUi'
import { useAssistant } from './assistant/useAssistant'
import { useUpload } from '../upload/useUpload'
import { UploadTemplate } from '../upload/UploadTemplate'
import { ConfirmManifest } from '../upload/ConfirmManifest'
import { StepStrip } from './StepStrip'
import { CopilotMark } from './CopilotMark'
import { useMerchantLibrary } from '../store/useMerchantLibrary'
import { applyMerchantJourney } from '../library/apply'
import { scanReviewCopy } from '../library/review'
import { clearDraft } from '../store/draft'
import { resetHistoryBaseline } from '../store/useHistory'
import { CopilotLibrary } from './TemplatesModal'
import { STUDIO, V8 } from '../layout/layoutMode'
import { BackButton, backToExperiences } from '../shell/BackButton'
import { newChat, newThread, startUploadPage, useWorkspace } from '../workspace/useWorkspace'
import { openTab } from '../workspace/paneTabs'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'
import { useCopilotStage, type LibraryTab, type SetupDoor } from './copilotStage'
import { contextPlayId, openPlayTab } from '../plays/navigate'
import { playsUsing, usePlays } from '../plays/usePlays'
import { showMe } from '../setup/actions'
import { experienceChecks } from '../setup/checks'
import { experienceChatRows, finalCheck, finalCheckText, leftCount, nextRow, promptFor } from '../setup/chatSetup'
import { experienceRows, readSetupInputs, useSetupInputs, workspaceRows, type TaskRow } from '../setup/progress'
import { entryById } from '../setup/registry'
import { SetupCard, hasFields } from '../setup/SetupCards'
import { setMark } from '../setup/useSetupState'

/** v8: settings the chat can reopen from its chips once setup is done. */
const V8_CHANGE_CHIPS: { id: string; label: string }[] = [
  { id: 'offers', label: 'Change the offers' },
  { id: 'layout', label: 'Change the page layout' },
  { id: 'cancelHandling', label: 'Change cancel handling' },
  { id: 'brand', label: 'Match my brand' },
]

/** Old v8 plan beats, mapped to the setup item that replaced them. */
const BEAT_ITEM: Partial<Record<PlanBeat, string>> = {
  offers: 'offers',
  shell: 'layout',
  cancel: 'cancelHandling',
  brand: 'brand',
  publish: 'publish',
  walk: 'walk',
}

function allRows(experienceId: string): TaskRow[] {
  const inputs = readSetupInputs()
  return [...experienceRows(experienceId, inputs), ...workspaceRows(inputs)]
}

function scrollSpotlightInto(container: HTMLElement): boolean {
  const marked = container.querySelector<HTMLElement>('[data-spotlight-on]')
  if (!marked) return false
  const cRect = container.getBoundingClientRect()
  const mRect = marked.getBoundingClientRect()
  container.scrollTop += mRect.top - cRect.top - (cRect.height - mRect.height) / 2
  return true
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

function lineEnterClass(line: CopilotLine) {
  const ts = Number(line.id.split('-')[0])
  const fresh = Number.isFinite(ts) && Date.now() - ts < 800
  if (!fresh) return ''
  return line.from === 'you' ? 'cb-copilot-enter-you' : 'cb-copilot-enter'
}

function ChatLine({ line, children }: { line: CopilotLine; children?: ReactNode }) {
  const enter = lineEnterClass(line)
  if (line.note) {
    return (
      <div className={`flex items-center justify-center gap-[6px] px-[12px] text-center text-[12px] text-[#677488] ${enter}`}>
        <SIcon name="pencil" size={11} className="flex-none" />
        <span className="min-w-0">{line.text}</span>
      </div>
    )
  }
  if (line.from === 'you') {
    return (
      <div className={`flex justify-end pl-[36px] ${enter}`}>
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
    <div className={`flex items-start gap-[10px] ${enter}`}>
      <CopilotMark size={20} className="mt-[2px] shrink-0" alt="" />
      <div className="min-w-0 flex-1">
        {line.ref && (
          <div className="mb-[4px] text-[11px] font-medium text-[#677488]">On {line.ref}</div>
        )}
        {line.text && (
          <div
            className="w-fit max-w-[min(100%,560px)] whitespace-pre-line rounded-[20px] border px-[16px] py-[10px] text-[15px] leading-[1.55]"
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
export function PromptCodeDock({
  compact = false,
  centered = false,
  railRight = false,
}: {
  compact?: boolean
  /** Threads and tabs layouts: the chat is the middle column beside the experience list. */
  centered?: boolean
  /** v8 with a tab open: Copilot is the right column, so the way back lives in the tab bar. */
  railRight?: boolean
}) {
  const sidebarOpen = useWorkspaceUi((s) => s.sidebarOpen)
  const setSidebarOpen = useWorkspaceUi((s) => s.setSidebarOpen)
  const beatAsk = useWorkspaceUi((s) => s.beatAsk)
  const dockMode = useJourney((s) => s.dockMode)
  const setDockMode = useJourney((s) => s.setDockMode)
  const file = useJourney((s) => s.file)
  const replaceFile = useJourney((s) => s.replaceFile)
  const applyBrand = useJourney((s) => s.applyBrand)
  const setAssistantOpen = useOrchestration((s) => s.setAssistantOpen)
  const annotateMode = useOrchestration((s) => s.annotateMode)
  const setAnnotateMode = useOrchestration((s) => s.setAnnotateMode)
  const closeAnnotation = useOrchestration((s) => s.closeAnnotation)
  const focusing = useOrchestration((s) => s.focusTarget !== null)
  const openTemplates = useOrchestration((s) => s.openTemplates)
  const closeTemplates = useOrchestration((s) => s.closeTemplates)
  const templatesOpen = useOrchestration((s) => s.templatesOpen)
  const pendingLibraryTemplate = useOrchestration((s) => s.pendingLibraryTemplate)
  const pendingMerchantTemplate = useOrchestration((s) => s.pendingMerchantTemplate)
  const pendingMerchantComponents = useOrchestration((s) => s.pendingMerchantComponents)
  const pendingMerchantFinish = useOrchestration((s) => s.pendingMerchantFinish)
  const pendingCopilotGuide = useOrchestration((s) => s.pendingCopilotGuide)
  const pendingCopilotLibrary = useOrchestration((s) => s.pendingCopilotLibrary)
  const setupDoor = useOrchestration((s) => s.setupDoor)
  const copilotDocked = useOrchestration((s) => s.copilotDocked)
  const copilotRailExpanded = useOrchestration((s) => s.copilotRailExpanded)
  const setCopilotRailExpanded = useOrchestration((s) => s.setCopilotRailExpanded)
  const stage = useCopilotStage()
  const uploadPhase = useUpload((s) => s.phase)
  const uploadChecklist = useUpload((s) => s.checklist)
  const uploadManifest = useUpload((s) => s.manifest)
  const uploadArtifact = useUpload((s) => s.artifact)

  const lines = useCopilotThread((s) => s.lines)
  const say = useCopilotThread((s) => s.say)
  const resetThread = useCopilotThread((s) => s.reset)
  const turn = useCopilotThread((s) => s.turn)
  const setTurn = useCopilotThread((s) => s.setTurn)
  const beat = useCopilotThread((s) => s.beat)
  const setBeat = useCopilotThread((s) => s.setBeat)
  const setupItem = useCopilotThread((s) => s.setupItem)
  const setSetupItem = useCopilotThread((s) => s.setSetupItem)
  const activeId = useWorkspace((s) => s.activeId)
  const setupAsk = useWorkspaceUi((s) => s.setupAsk)
  const setupInputs = useSetupInputs()
  const chatRows = V8 ? experienceChatRows(activeId, setupInputs) : []
  const setupRow = V8 && setupItem
    ? [...experienceRows(activeId, setupInputs), ...workspaceRows(setupInputs)].find((r) => r.entry.id === setupItem.id) ?? null
    : null
  const setupLeft = leftCount(chatRows)
  const publishAfter = useRef<string | null>(null)
  const [draft, setDraft] = useState('')
  const [goalAsk, setGoalAsk] = useState(false)
  const chatKey = useWorkspace((s) => `${s.activeId}:${s.threads.find((t) => t.id === s.activeId)?.activeChatId ?? ''}`)
  useEffect(() => {
    setGoalAsk(false)
    setDraft('')
  }, [chatKey])
  const [planPane, setPlanPane] = useState<'map' | 'versions'>('map')
  const scrollRef = useRef<HTMLDivElement>(null)

  const emptyHome =
    dockMode === 'prompt' &&
    turn === 'kind' &&
    lines.length === 0 &&
    file.steps.length === 0 &&
    !setupDoor

  useEffect(() => {
    if (annotateMode) setDockMode('prompt')
  }, [annotateMode, setDockMode])

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
    useUpload.getState().close()
    replaceFile({ ...EMPTY_JOURNEY, brand: useJourney.getState().file.brand })
    useOrchestration.getState().resetSetup()
    clearDraft()
    setTurn('kind')
    setBeat('walk')
    setDraft('')
    resetThread()
    // Snap the activity baseline to the now-empty file and drop any flush the
    // reset queued, so starting over doesn't log a phantom "removed step".
    resetHistoryBaseline()
  }

  const goBack = () => {
    reset()
  }

  const beginPostCanvas = () => {
    setTurn('plan')
    setBeat(V8 ? v8Landing(useJourney.getState().file).beat : 'walk')
  }

  /** v8: no plan card in the chat. Say what's next and open the first setting. */
  const sayLanding = (live: typeof file) => {
    say('bot', v8Landing(live).text)
  }

  const keepCopilotCentered = (door: SetupDoor = 'guide') => {
    const orch = useOrchestration.getState()
    if (orch.setupDoor) return
    useOrchestration.setState({ setupDoor: door, setupDoorConsumed: true, assistantOpen: true })
  }

  /** Recap first. Brand waits until the other plan beats are done. */
  const landPlan = (next: typeof file) => {
    const live = { ...next, steps: withLive(next.steps, true) }
    replaceFile(live)
    if (V8) sayLanding(live)
    else say('bot', planIntro(live), { widget: 'plan' })
    useOrchestration.getState().enterWorkEditor()
    beginPostCanvas()
  }

  /** Chat first. Canvas waits until they approve the path. */
  const proposePlan = (next: typeof file) => {
    const live = { ...next, steps: withLive(next.steps, true) }
    keepCopilotCentered()
    replaceFile(live)
    say('bot', planProposeIntro(live), { widget: 'steps' })
    setTurn('propose')
  }

  const approveProposedPlan = () => {
    say('you', 'Looks right — open the editor')
    if (V8) sayLanding(useJourney.getState().file)
    else say('bot', planCanvasIntro())
    useOrchestration.getState().enterWorkEditor()
    beginPostCanvas()
  }

  const rejectProposedPlan = () => {
    say('you', 'Pick a different job')
    useCopilotThread.getState().clearWidgets('steps')
    replaceFile({ ...EMPTY_JOURNEY, brand: useJourney.getState().file.brand })
    say('bot', 'What job is this cancel for? I’ll pick a path and put defaults in so you can walk it.')
    setTurn('guide')
  }

  const continuePlan = (said: string) => {
    say('you', said)
    const orch = useOrchestration.getState()
    if (beat === 'walk') orch.setWalkedOrSkipped(true)
    if (beat === 'audience') orch.confirmSetupItem('audience')
    if (beat === 'holdout') orch.confirmSetupItem('holdout')
    if (beat === 'offers') orch.confirmSetupItem('offers')
    if (beat === 'tests') orch.confirmSetupItem('experiment')
    // Cancellation and experiment are side-trips opened from the tracker, not
    // steps in the linear plan — they finish in place rather than advancing the
    // beat chain (which would misroute back to Walk). v8 walks them in order.
    if (beat === 'cancel' && !V8) {
      say('bot', 'Locked in — the tracker shows cancellation handling as ready.')
      setTurn('done')
      return
    }
    if (beat === 'experiment') {
      if (said === 'The split looks right') {
        orch.confirmSetupItem('experiment')
        say('bot', 'Marked reviewed. Change the variants or split on the canvas anytime, then reopen this row.')
      } else {
        say('bot', 'Open the split on the canvas to change the variants and traffic — reopen this row when it reads right.')
      }
      setTurn('done')
      return
    }
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
    const orch = useOrchestration.getState()
    orch.confirmSetupItem('audience')
    orch.confirmSetupItem('holdout')
    orch.setWalkedOrSkipped(true)
    say('you', V8 ? 'Keep the rest as is' : 'Keep defaults and walk it')
    setTurn('plan')
    if (!V8) useExperience.getState().setMode('play')
    if (!isBrandMatched(current.brand)) {
      setBeat('brand')
      say('bot', beatPrompt('brand', current), { look: 'brand' })
      return
    }
    setBeat('publish')
    say('bot', beatPrompt('publish', current), { look: 'walk' })
  }

  /** v8: show one setup card. The publish card gets a final check first. */
  const askRow = (row: TaskRow, quiet = false) => {
    let target = row
    if (row.entry.id === 'publish') {
      const inputs = readSetupInputs()
      const check = finalCheck(experienceRows(activeId, inputs), experienceChecks(activeId, inputs))
      say('bot', finalCheckText(check, 'publish'))
      quiet = true
      if (check.blockers.length > 0) target = check.blockers[0]
      if (target !== row && setupItem?.id !== target.entry.id) say('bot', promptFor(target))
      publishAfter.current = target !== row ? activeId : null
    }
    setTurn('setup')
    setSetupItem({ id: target.entry.id, targetId: target.targetId })
    if (!quiet) say('bot', promptFor(target))
  }

  const askItem = (id: string) => {
    const row = allRows(activeId).find((r) => r.entry.id === id)
    if (row) askRow(row)
  }

  const finishSetup = () => {
    setSetupItem(null)
    setTurn('done')
    const pid = contextPlayId() ?? playsUsing(activeId)[0]?.id
    const play = pid ? usePlays.getState().plays.find((p) => p.id === pid) : undefined
    say(
      'bot',
      play
        ? `That’s everything for this experience. ${play.name} has a few settings of its own, like who it’s for and how traffic is split.`
        : 'That’s everything for this experience. The Task list has every setting as it stands.',
    )
  }

  const advanceSetup = (afterId: string) => {
    if (publishAfter.current === activeId) {
      const inputs = readSetupInputs()
      const blockers = finalCheck(experienceRows(activeId, inputs), experienceChecks(activeId, inputs)).blockers.filter((r) => r.entry.id !== afterId)
      const publish = allRows(activeId).find((r) => r.entry.id === 'publish')
      if (publish && publish.status !== 'done') {
        if (blockers.length > 0) return askRow(blockers[0])
        publishAfter.current = null
        return askRow(publish)
      }
    }
    publishAfter.current = null
    const next = nextRow(experienceChatRows(activeId, readSetupInputs()), { not: afterId })
    if (next) askRow(next)
    else finishSetup()
  }

  const resumeSetup = () => {
    const next = nextRow(experienceChatRows(activeId, readSetupInputs()), { includeSkipped: true })
    if (next) askRow(next)
    else finishSetup()
  }

  const jumpPlan = (next: PlanBeat) => {
    if (V8) {
      const id = BEAT_ITEM[next]
      if (id) askItem(id)
      else {
        const pid = contextPlayId() ?? playsUsing(activeId)[0]?.id
        if (pid) openPlayTab(pid, 'tasks')
      }
      return
    }
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
    proposePlan(next)
  }

  const recommendTemplate = (template: JourneyTemplate, said: string) => {
    say('you', said)
    applyTemplate(template)
  }

  const startUpload = () => {
    if (V8) {
      startUploadPage()
      return
    }
    say('you', 'Upload a template')
    say(
      'bot',
      'I’ll scan whatever you drop, reject unmarked chrome with a checklist, then you bind the catalog. Targeting, holdout, and publish stay here.',
      { look: 'upload' },
    )
    keepCopilotCentered('upload')
    setTurn('upload')
    useUpload.getState().open()
  }

  const startLibrary = (tab?: LibraryTab) => {
    const next = tab ?? useOrchestration.getState().libraryTab
    keepCopilotCentered(next === 'yours' ? 'yours' : 'library')
    useOrchestration.getState().setLibraryTab(next)
    if (turn !== 'library') {
      say('you', next === 'yours' ? 'My existing templates' : 'Start with a template')
      say(
        'bot',
        'Chargebee postures, or chrome you already scanned. Pick one — I’ll put the chain here before the canvas opens.',
      )
    }
    setTurn('library')
  }

  const startYours = () => {
    startLibrary('yours')
  }

  const afterUploadConfirm = () => {
    landUploadedPlan()
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
    say('you', 'Help me start')
    say('bot', 'What job is this cancel for? I’ll pick a path and put defaults in so you can walk it.')
    keepCopilotCentered('guide')
    setTurn('guide')
  }

  const startAcquire = () => {
    say('you', 'Pricing table → hosted checkout')
    const next = startFromTemplate(
      { ...EMPTY_JOURNEY, kind: 'acquisition', brand: useJourney.getState().file.brand },
      'acquire_2',
    )
    proposePlan(next)
  }

  /** Same path for suggestion chips and the template library. Brand from the current file is kept. */
  const startTemplate = (template: JourneyTemplate) => {
    if (template === 'none') return
    say('you', templateLabel(template))
    const next = startFromTemplate(useJourney.getState().file, template)
    landPlan(next)
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
    const next = applyMerchantJourney(
      useJourney.getState().file,
      saved,
      useMerchantLibrary.getState().components,
    )
    landPlan(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMerchantTemplate])

  useEffect(() => {
    const ids = useOrchestration.getState().pendingMerchantComponents
    if (!ids?.length) return
    useOrchestration.getState().consumeMerchantComponents()
    const lib = useMerchantLibrary.getState()
    const picked = ids
      .map((id) => lib.getComponent(id))
      .filter((c): c is NonNullable<typeof c> => c != null)
    if (picked.length === 0) return
    const inline = useCopilotThread.getState().turn === 'library'
    if (!useOrchestration.getState().templatesOpen && !inline) return
    const n = picked.length
    say('you', `Add ${n} screen${n === 1 ? '' : 's'}`)
    say('bot', 'They’re on this experience. The library is still open if you want another.')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMerchantComponents])

  useEffect(() => {
    if (!pendingMerchantFinish) return
    useOrchestration.getState().consumeMerchantFinish()
    const current = useJourney.getState().file
    const shown = useOrchestration.getState().stepStripShown
    const already = useCopilotThread.getState().turn === 'propose'
    if (current.steps.length > 0 && !shown && !already) proposePlan(current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMerchantFinish])

  const reviewKey = useRef('')
  useEffect(() => {
    if (V8 || turn !== 'upload') return
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
    if (!beatAsk) return
    setDockMode('prompt')
    jumpPlan(beatAsk.beat)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatAsk])

  /** v8: "Do it in chat" from the Task list or anywhere else. */
  useEffect(() => {
    if (!V8 || !setupAsk) return
    const entry = entryById(setupAsk.item)
    if (!entry || entry.scope === 'play') return
    if (entry.scope === 'experience' && setupAsk.targetId !== activeId) return
    if (entry.scope === 'workspace' && useWorkspaceUi.getState().page === 'play') return
    useWorkspaceUi.setState({ setupAsk: null })
    setDockMode('prompt')
    if (setupItem?.id === entry.id) return
    askItem(entry.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupAsk, activeId])

  /** v8: landing, an old plan beat, or a reopened chat all pick up at the next open setting. */
  useEffect(() => {
    if (!V8 || setupItem || (turn !== 'setup' && turn !== 'plan') || file.steps.length === 0) return
    if (useWorkspaceUi.getState().setupAsk) return
    const next = nextRow(experienceChatRows(activeId, readSetupInputs()))
    if (!next) {
      setTurn('done')
      return
    }
    const last = [...useCopilotThread.getState().lines].reverse().find((l) => l.from === 'bot' && !l.note)
    askRow(next, last?.text === promptFor(next))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, setupItem, activeId, file.steps.length])

  /** v8: cards with nothing to fill (walk it, publish) move on once they're done elsewhere. */
  const focusDone = setupRow?.status === 'done'
  useEffect(() => {
    if (!V8 || !setupRow || !focusDone) return
    if (hasFields(setupRow.entry) && setupRow.entry.id !== 'publish') return
    if (setupRow.entry.id === 'publish') say('bot', 'It’s published. It shows up wherever a live play uses it.')
    advanceSetup(setupRow.entry.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusDone, setupItem?.id])

  useEffect(() => {
    if (!pendingCopilotGuide) return
    useOrchestration.getState().consumeCopilotGuide()
    if (V8) return
    if (turn === 'kind' && lines.length === 0) startGuide()
    else if (turn !== 'guide') startGuide()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCopilotGuide])

  useEffect(() => {
    if (!pendingCopilotLibrary) return
    const tab = useOrchestration.getState().pendingCopilotLibrary ?? 'ours'
    useOrchestration.getState().consumeCopilotLibrary()
    startLibrary(tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCopilotLibrary])

  useEffect(() => {
    const orch = useOrchestration.getState()
    if (!orch.setupDoor || orch.setupDoorConsumed) return
    orch.consumeSetupDoor()
    if (orch.setupDoor === 'library') startLibrary('ours')
    else if (orch.setupDoor === 'yours') startYours()
    else if (orch.setupDoor === 'upload') startUpload()
    else if (orch.setupDoor === 'guide' && !V8) startGuide()
    else if (orch.setupDoor === 'acquire') startAcquire()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupDoor])

  const confirmPlan = () => {
    if (beat === 'publish') {
      if (!V8) useOrchestration.getState().setPublishGapsOpen(true)
      useOrchestration.getState().togglePublish()
      say('you', 'Publish')
      say(
        'bot',
        V8
          ? 'It’s live. Change any setting from here or from the Plan tab.'
          : 'Live in this prototype. Remaining gaps stay on the tracker — you can still fill them.',
      )
      setTurn('done')
      return
    }
    say('you', 'Looks good — I’m done for now')
    say(
      'bot',
      'File is the source of truth. Reopen the plan to reconfigure, switch to Plan to edit it, or walk it as a subscriber.',
    )
    setTurn('done')
  }

  /**
   * Typing skips the turns. Brand matching can sample a live URL; everything
   * else is a patch to the journey file, then we land on the recap.
   */
  const saySoon = (text: string, extra?: Parameters<typeof say>[2]) => {
    window.setTimeout(() => say('bot', text, extra), 420)
  }

  const sendText = (raw: string, shown?: string) => {
    const text = raw.trim()
    if (!text) return
    setDraft('')
    setGoalAsk(false)
    say('you', shown ?? text)
    if (V8 && setupItem?.id === 'brand') {
      void applyMatchedBrand(text).then((ok) => {
        if (!ok) return
        setMark(activeId, 'brand', 'done', 'chat')
        advanceSetup('brand')
      })
      return
    }
    if (turn === 'plan' && beat === 'brand' && !V8) {
      void applyMatchedBrand(text).then((ok) => {
        if (!ok) return
        const current = useJourney.getState().file
        const next = nextBeat(current, 'brand')
        if (next) {
          setBeat(next)
          const look = spotlightForBeat(next)
          saySoon(beatPrompt(next, current), look ? { look } : undefined)
        }
      })
      return
    }
    if (isBrandIntent(text) && !/\b(cancel|acquire|acquisition|step|survey|offer|pause|discount|checkout|pricing)\b/i.test(text)) {
      void applyMatchedBrand(text)
      return
    }
    const current = useJourney.getState().file
    if (V8 && current.steps.length === 0) {
      saySoon('Start from a template or upload your own pages first. Then I can set the offers, who sees it and tests here.')
      return
    }
    const read = interpret(text, current)
    if (V8 && (read.goals || read.rebuilt)) {
      window.setTimeout(() => {
        setGoalAsk(true)
        say('bot', SETUP_ONLY_REPLY)
      }, 420)
      return
    }
    if (read.goals) {
      window.setTimeout(() => {
        setGoalAsk(true)
        say('bot', read.reply)
      }, 420)
      return
    }
    if (read.changed) replaceFile(read.file)
    if (read.rebuilt && read.file.steps.length > 0) {
      saySoon(read.reply, { widget: 'plan' })
      useOrchestration.getState().enterWorkEditor()
      beginPostCanvas()
      return
    }
    saySoon(read.reply)
  }

  const send = () => sendText(draft)

  const options = useMemo(() => {
    if (V8 && (turn === 'setup' || turn === 'plan') && setupRow && !goalAsk) {
      const row = setupRow
      return (
        <div>
          <SetupCard
            entry={row.entry}
            targetId={row.targetId}
            mode="chat"
            onSave={(said) => {
              say('you', said)
              advanceSetup(row.entry.id)
            }}
            onSkip={() => {
              setMark(row.targetId, row.entry.id, 'skipped', 'chat')
              say('you', 'Skip for now')
              advanceSetup(row.entry.id)
            }}
            onNotNeeded={() => {
              setMark(row.targetId, row.entry.id, 'na', 'chat')
              say('you', 'Not needed')
              advanceSetup(row.entry.id)
            }}
            onShowMe={() => showMe(row)}
          />
          <button
            type="button"
            onClick={() => {
              setSetupItem(null)
              setTurn('done')
              say('you', 'Stop for now')
              say('bot', 'No problem. Pick it up any time with Resume setup, or from the Task list.')
            }}
            className="mt-[8px] inline-flex items-center gap-[5px] rounded-[8px] px-[6px] py-[4px] text-[12.5px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            Stop for now
          </button>
        </div>
      )
    }
    if (V8 && (goalAsk || (turn === 'done' && file.steps.length > 0))) {
      const pid = contextPlayId() ?? playsUsing(activeId)[0]?.id
      const play = pid ? usePlays.getState().plays.find((p) => p.id === pid) : undefined
      return (
        <div className="flex flex-wrap gap-2">
          {setupLeft > 0 && (
            <OptionBtn
              pill
              label={`Resume setup (${setupLeft} left)`}
              onClick={() => {
                setGoalAsk(false)
                say('you', 'Resume setup')
                resumeSetup()
              }}
            />
          )}
          {V8_CHANGE_CHIPS.filter((chip) => chatRows.some((r) => r.entry.id === chip.id)).map((chip) => (
            <OptionBtn
              key={chip.id}
              pill
              label={chip.label}
              onClick={() => {
                setGoalAsk(false)
                say('you', chip.label)
                askItem(chip.id)
              }}
            />
          ))}
          {play && <OptionBtn pill label={`Set up ${play.name}`} onClick={() => openPlayTab(play.id, 'tasks')} />}
        </div>
      )
    }
    if (goalAsk) {
      return (
        <div className="space-y-2">
          {GOAL_CHOICES.map((goal) => (
            <OptionBtn key={goal.id} pill label={goal.label} onClick={() => sendText(goal.prompt, goal.label)} />
          ))}
        </div>
      )
    }
    if (pendingLibraryTemplate) return null
    if (turn === 'upload' && !V8) {
      return uploadPhase === 'confirm' ? (
        <ConfirmManifest onConfirmed={afterUploadConfirm} />
      ) : (
        <UploadTemplate />
      )
    }
    if (turn === 'kind') {
      return (
        <StartPaths
          onTemplate={() => startLibrary('ours')}
          onUpload={startUpload}
          onGuide={V8 ? undefined : startGuide}
        />
      )
    }
    if (turn === 'library') {
      return <CopilotLibrary onUpload={startUpload} />
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
    if (turn === 'propose') {
      return null
    }
    if (turn === 'plan') {
      const prev = V8 ? prevBeat(file, beat) : null
      return (
        <div>
          <SpotlightFrame id={spotlightForBeat(beat) ?? 'plan'}>
            <PlanBeatCard
              beat={beat}
              onContinue={continuePlan}
              onConfirm={confirmPlan}
              onPreview={() => {
                if (V8) {
                  openTab('preview')
                  return
                }
                useOrchestration.getState().setWalkedOrSkipped(true)
                useExperience.getState().setMode('play')
              }}
              onKeepDefaults={keepDefaults}
            />
          </SpotlightFrame>
          {prev && (
            <button
              type="button"
              onClick={() => jumpPlan(prev)}
              className="mt-[8px] inline-flex items-center gap-[5px] rounded-[8px] px-[6px] py-[4px] text-[12.5px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <SIcon name="arrow-left" size={12} />
              Back
            </button>
          )}
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
  }, [goalAsk, turn, beat, file, uploadPhase, pendingLibraryTemplate, setupItem, setupRow?.status, setupLeft, activeId])

  const subtitle = emptyHome
    ? 'New Conversation'
    : dockMode === 'code' && !V8
      ? 'The plan'
      : file.name && (file.template !== 'none' || file.source === 'uploaded' || file.steps.length > 0)
        ? file.name
        : 'New Conversation'

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white">
      <div
        className="flex h-[60px] flex-none items-center justify-between gap-[12px] px-[16px]"
        style={{ background: COPILOT_UI.header, borderBottom: `1px solid ${COPILOT_UI.hairline}` }}
      >
        <div className="flex min-w-0 items-center gap-[10px]">
          {V8 && centered && !railRight && (
            <BackButton
              fallback={backToExperiences}
              onBack={stage === 'center' && file.steps.length === 0 ? reset : undefined}
              className="-mr-[6px]"
            />
          )}
          {!railRight && (
            <HeaderIconButton
              label="Conversations"
              pressed={centered && sidebarOpen}
              onClick={centered ? () => setSidebarOpen(!sidebarOpen) : undefined}
            >
              <SIcon name="menu" size={18} />
            </HeaderIconButton>
          )}
          <div className="min-w-0">
            <h2
              className="truncate text-[17px] font-bold leading-tight tracking-tight"
              style={{ color: COPILOT_UI.title }}
            >
              Growth Copilot
            </h2>
            <p className="truncate text-[13px] leading-tight" style={{ color: COPILOT_UI.muted }}>
              {subtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-[2px]">
          {!STUDIO && (
            <HeaderIconButton
              label="Templates"
              pressed={templatesOpen || turn === 'library'}
              onClick={() => {
                if (stage === 'center') {
                  if (turn === 'library') {
                    if (templatesOpen) closeTemplates()
                    else openTemplates()
                  } else startLibrary()
                } else openTemplates()
              }}
            >
              <SIcon name="layout-template" size={16} />
            </HeaderIconButton>
          )}
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
          {!V8 && (
            [
              { id: 'prompt' as const, label: 'Prompt' },
              { id: 'code' as const, label: 'Plan' },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setDockMode(id)}
              className="rounded-[8px] px-[8px] py-[6px] text-[12px] font-semibold"
              style={{
                color: dockMode === id ? COPILOT_UI.title : COPILOT_UI.muted,
                background: dockMode === id ? 'var(--sk-blue-50, #e7f1fe)' : 'transparent',
              }}
            >
              {label}
            </button>
          ))}
          {!compact && !copilotDocked && !centered && (
            <HeaderIconButton
              label={copilotRailExpanded ? 'Reduce Copilot width' : 'Expand Copilot width'}
              pressed={copilotRailExpanded}
              onClick={() => setCopilotRailExpanded(!copilotRailExpanded)}
            >
              <SIcon name={copilotRailExpanded ? 'chevrons-right' : 'chevrons-left'} size={16} />
            </HeaderIconButton>
          )}
          {!focusing && !compact && !copilotDocked && !centered && (
            <HeaderIconButton label="Collapse Copilot" onClick={() => setAssistantOpen(false)}>
              <SIcon name="panel-left" size={16} />
            </HeaderIconButton>
          )}
          {(compact || copilotDocked) && (
            <HeaderIconButton label="Close" onClick={reset}>
              <SIcon name="x" size={16} />
            </HeaderIconButton>
          )}
          {V8 && railRight && (
            <HeaderIconButton label="Collapse Copilot" onClick={() => useWorkspaceUi.getState().setCopilotCollapsed(true)}>
              <SIcon name="panel-right-close" size={16} />
            </HeaderIconButton>
          )}
        </div>
      </div>

      {dockMode === 'code' && !V8 ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-none items-center gap-[6px] border-b border-slate-100 px-3 py-2">
            {(
              [
                { id: 'map' as const, label: 'Map' },
                { id: 'versions' as const, label: 'Versions' },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setPlanPane(id)}
                className={`rounded-[8px] px-[8px] py-[4px] text-[12px] font-semibold ${
                  planPane === id ? 'bg-[#e7f1fe] text-slate-900' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {planPane === 'versions' ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <p className="px-4 pt-3 text-[12px] leading-relaxed text-slate-500">
                Restore an earlier version of this plan.
              </p>
              <ActivityTab />
            </div>
          ) : (
            <>
              <p className="flex-none border-b border-slate-100 px-3 py-2 text-[11.5px] leading-relaxed text-slate-500">
                The plan for this cancel. Edit any component — offers, surveys, loss aversion — and the
                editor follows.
              </p>
              <ContextEditor />
            </>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          {(compact || copilotDocked || !V8) && (
            <div className="flex w-[44px] flex-none flex-col items-center gap-[8px] pt-[16px]">
              {compact || copilotDocked ? (
                <HeaderIconButton label="Exit" onClick={goBack}>
                  <SIcon name="arrow-left" size={16} />
                </HeaderIconButton>
              ) : (
                <HeaderIconButton
                  label={STUDIO ? 'New chat' : centered ? 'New experience' : 'New conversation'}
                  onClick={STUDIO ? () => newChat() : centered ? newThread : reset}
                >
                  <SIcon name="pencil" size={16} />
                </HeaderIconButton>
              )}
            </div>
          )}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-[16px] pb-[24px] pt-[12px]">
              <div className="space-y-[16px]">
                {lines.map((m) => (
                  <ChatLine key={m.id} line={m}>
                    {m.widget === 'plan' && !V8 && (
                      <SpotlightFrame id="plan" className="mt-[12px]">
                        <PlanSummary
                          beat={turn === 'plan' ? beat : undefined}
                          onJump={jumpPlan}
                          readonly={turn === 'propose'}
                          onOpenTab={STUDIO && turn !== 'propose' ? () => openTab('plan') : undefined}
                        />
                      </SpotlightFrame>
                    )}
                    {m.widget === 'steps' && file.steps.length > 0 && (
                      <SpotlightFrame id="journey" className="mt-[12px]">
                        <StepStrip
                          onAccept={turn === 'propose' ? approveProposedPlan : undefined}
                          onReject={turn === 'propose' ? rejectProposedPlan : undefined}
                          acceptLabel="Looks right — open the editor"
                          rejectLabel="Pick a different job"
                          includeOutcomes
                          footerHint={
                            turn === 'propose'
                              ? 'Next you’ll walk these screens. Nothing is live.'
                              : undefined
                          }
                        />
                      </SpotlightFrame>
                    )}
                    {m.applyMessageId != null && <AnnotateApply messageId={m.applyMessageId} />}
                  </ChatLine>
                ))}
              </div>
              {options ? (
                <div key={`${turn}-${beat}-${uploadPhase}-${setupItem?.id ?? ''}`} className="cb-copilot-enter mt-[16px]">
                  {options}
                </div>
              ) : null}
            </div>
            <div className="flex-none px-[16px] pb-[12px] pt-[4px]">
              <PromptInput
                value={draft}
                onChange={setDraft}
                onSend={send}
                placeholder={
                  (turn === 'plan' && beat === 'brand') || setupItem?.id === 'brand'
                    ? 'https://account.example.com — or: dark navy, gold buttons, Inter'
                    : V8
                      ? 'Offers, who sees it, tests, page style, or brand'
                      : emptyHome
                        ? 'Or say it: 4-step cancel, or a pricing table to acquire subscribers.'
                        : 'Ask Copilot...'
                }
              />
              {!V8 && !(turn === 'plan' && beat === 'brand') && (
                <div className="mt-[8px] flex flex-col gap-[4px] px-[4px]">
                  {EXAMPLE_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendText(prompt)}
                      className="text-left text-[12.5px] font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-[8px] px-[4px] text-center text-[11px] leading-snug text-[#9aa3b2]">
                By using Growth Copilot, you accept our third-party AI terms.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
