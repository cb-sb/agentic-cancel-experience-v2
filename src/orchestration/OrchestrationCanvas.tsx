import { useEffect } from 'react'
import { EASE_ENTER, EASE_LEAVE, PANEL_MS } from '../lib/motion'
import { PRIMARY_EXPERIENCE_ID } from '../lib/orchestrationSeed'
import { usePresence } from '../lib/usePresence'
import { useExperience } from '../store/useExperience'
import { useOrchestration } from '../store/useOrchestration'
import {
  ASSISTANT_EXPANDED_W,
  ASSISTANT_FOLDED_W,
  ASSISTANT_W,
  COPILOT_CENTER_EXPANDED_H,
  COPILOT_CENTER_EXPANDED_W,
  COPILOT_CENTER_H,
  COPILOT_CENTER_W,
} from './paneTokens'
import { useAssistant } from './assistant/useAssistant'
import { BlankJourneyDoors } from './BlankJourneyDoors'
import { CopilotMark } from './CopilotMark'
import { PromptCodeDock } from './PromptCodeDock'
import { FlowCanvas } from './flow/FlowCanvas'
import { FocusOverlay } from './focus/FocusOverlay'
import { useFocusSession } from './focus/useFocusSession'
import { PlayHeader } from './PlayHeader'
import { PreviewOverlay } from './PreviewHeader'
import { TemplatesModal } from './TemplatesModal'
import { UploadFlow } from '../upload/UploadFlow'
import { useCopilotStage } from './copilotStage'

const COPILOT_MORPH_MS = 380

export function DoorsBackdrop() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 bg-slate-100"
      style={{
        backgroundImage: 'radial-gradient(var(--sk-slate-300, #d5dae1) 1.4px, transparent 1.4px)',
        backgroundSize: '22px 22px',
      }}
    />
  )
}

function CenterOverlay({
  expanded,
  onBackdrop,
  children,
}: {
  expanded?: boolean
  onBackdrop?: () => void
  children: React.ReactNode
}) {
  const width = expanded ? COPILOT_CENTER_EXPANDED_W : COPILOT_CENTER_W
  const height = expanded ? COPILOT_CENTER_EXPANDED_H : COPILOT_CENTER_H
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center">
      <div
        aria-hidden={!onBackdrop}
        className="absolute inset-0"
        style={{ pointerEvents: onBackdrop ? 'auto' : 'none' }}
        onClick={onBackdrop}
      />
      <div
        className="relative z-10 flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)] motion-reduce:transition-none"
        style={{
          width,
          height,
          maxWidth: width,
          maxHeight: height,
          transition: `width ${COPILOT_MORPH_MS}ms ${EASE_ENTER}, height ${COPILOT_MORPH_MS}ms ${EASE_ENTER}`,
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function EditorPane() {
  const session = useFocusSession()
  if (!session) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center text-[13px] text-slate-500">
        Pick a step to edit it here.
      </div>
    )
  }
  return <FocusOverlay session={session} open embedded />
}

export function OrchestrationCanvas() {
  const templatesOpen = useOrchestration((s) => s.templatesOpen)
  const closeTemplates = useOrchestration((s) => s.closeTemplates)
  const setAssistantOpen = useOrchestration((s) => s.setAssistantOpen)
  const assistantOpen = useOrchestration((s) => s.assistantOpen)
  const copilotRailExpanded = useOrchestration((s) => s.copilotRailExpanded)
  const workSurface = useOrchestration((s) => s.workSurface)
  const focusTarget = useOrchestration((s) => s.focusTarget)
  const previewing = useExperience((s) => s.mode === 'play')
  const stepCount = useExperience((s) => s.experiences[PRIMARY_EXPERIENCE_ID]?.steps.length ?? 0)
  const stage = useCopilotStage()

  useEffect(() => {
    if (stage === 'rail') setAssistantOpen(true)
  }, [stage, setAssistantOpen])

  useEffect(() => {
    if (stage !== 'rail' || workSurface !== 'editor' || focusTarget || stepCount === 0) return
    useOrchestration.getState().enterWorkEditor()
  }, [stage, workSurface, focusTarget, stepCount])

  if (stage === 'doors') {
    return (
      <div className="relative flex h-full min-h-0 flex-col bg-slate-100">
        <DoorsBackdrop />
        {!templatesOpen && <BlankJourneyDoors />}
        {templatesOpen && <TemplatesModal />}
        <UploadFlow />
      </div>
    )
  }

  if (stage === 'center') {
    return (
      <div className="relative flex h-full min-h-0 flex-col bg-slate-100">
        <DoorsBackdrop />
        <CenterOverlay expanded={templatesOpen} onBackdrop={templatesOpen ? closeTemplates : undefined}>
          <PromptCodeDock compact />
        </CenterOverlay>
        <UploadFlow />
      </div>
    )
  }

  const railWidth = assistantOpen
    ? copilotRailExpanded
      ? ASSISTANT_EXPANDED_W
      : `${ASSISTANT_W}px`
    : `${ASSISTANT_FOLDED_W}px`

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-100">
      <div
        className="grid h-full min-h-0 motion-reduce:transition-none"
        style={{
          gridTemplateColumns: [railWidth, '1fr'].join(' '),
          transition: `grid-template-columns ${PANEL_MS}ms ${EASE_ENTER}`,
        }}
      >
        <CopilotColumn />
        <div className="flex min-h-0 min-w-0 flex-col border-l border-slate-200 bg-slate-100">
          <PlayHeader />
          <div data-focus-root className="relative min-h-0 flex-1">
            {workSurface === 'canvas' && !previewing && (
              <div data-canvas-pane className="relative z-0 h-full min-h-0 min-w-0 overflow-hidden">
                <FlowCanvas />
              </div>
            )}
            {workSurface === 'editor' && !previewing && <EditorPane />}
            <PreviewOverlay />
          </div>
        </div>
      </div>
      {templatesOpen && <TemplatesModal />}
      <UploadFlow />
    </div>
  )
}

const fade = (shown: boolean) =>
  `opacity ${PANEL_MS}ms ${shown ? EASE_ENTER : EASE_LEAVE}, transform ${PANEL_MS}ms ${
    shown ? EASE_ENTER : EASE_LEAVE
  }`

function CopilotColumn() {
  const open = useOrchestration((s) => s.assistantOpen)
  const setAssistantOpen = useOrchestration((s) => s.setAssistantOpen)
  const unread = useAssistant((s) => s.threadOpen !== null)
  const dock = usePresence(open, PANEL_MS)
  const launcher = usePresence(!open, PANEL_MS)

  return (
    <div className={`relative min-h-0 overflow-hidden ${open ? 'bg-white' : 'bg-slate-100'}`}>
      {dock.alive && (
        <div
          aria-hidden={!dock.open}
          className="absolute inset-0 flex min-h-0 flex-col motion-reduce:transition-none"
          style={{
            width: '100%',
            left: 0,
            opacity: dock.open ? 1 : 0,
            transform: `translateX(${dock.open ? 0 : -16}px)`,
            transition: fade(dock.open),
            pointerEvents: dock.open ? undefined : 'none',
          }}
        >
          <PromptCodeDock />
        </div>
      )}
      {launcher.alive && (
        <div
          aria-hidden={!launcher.open}
          className="absolute inset-0 flex flex-col items-center justify-end pb-6 motion-reduce:transition-none"
          style={{
            opacity: launcher.open ? 1 : 0,
            transform: `translateY(${launcher.open ? 0 : 8}px)`,
            transition: fade(launcher.open),
            pointerEvents: launcher.open ? undefined : 'none',
          }}
        >
          <button
            type="button"
            onClick={() => setAssistantOpen(true)}
            title="Open Growth Copilot"
            className="relative rounded-full shadow-[0_8px_24px_rgba(15,23,42,0.18)] transition-transform hover:scale-105"
          >
            <CopilotMark size={48} alt="Growth Copilot" />
            {unread && (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-rose-500" />
            )}
          </button>
        </div>
      )}
    </div>
  )
}
