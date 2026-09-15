import { useEffect } from 'react'
import { EASE_ENTER, EASE_LEAVE, PANEL_MS } from '../lib/motion'
import { usePresence } from '../lib/usePresence'
import { useExperience } from '../store/useExperience'
import { useOrchestration } from '../store/useOrchestration'
import { ASSISTANT_FOLDED_W, ASSISTANT_W } from './paneTokens'
import { useAssistant } from './assistant/useAssistant'
import { CopilotMark } from './CopilotMark'
import { PromptCodeDock } from './PromptCodeDock'
import { FlowCanvas } from './flow/FlowCanvas'
import { FocusPresentation } from './focus'
import { PlayHeader } from './PlayHeader'
import { PreviewOverlay } from './PreviewHeader'
import { TemplatesModal } from './TemplatesModal'
import { UploadFlow } from '../upload/UploadFlow'
import { BlankJourneyDoors } from './BlankJourneyDoors'
import { useCopilotStage } from './copilotStage'

const CENTER_W = 620

export function OrchestrationCanvas() {
  const templatesOpen = useOrchestration((s) => s.templatesOpen)
  const assistantOpen = useOrchestration((s) => s.assistantOpen)
  const setAssistantOpen = useOrchestration((s) => s.setAssistantOpen)
  const previewing = useExperience((s) => s.mode === 'play')
  const stage = useCopilotStage()

  useEffect(() => {
    if (stage === 'doors') {
      setAssistantOpen(false)
      return
    }
    setAssistantOpen(!previewing)
  }, [previewing, setAssistantOpen, stage])

  if (stage === 'doors') {
    return (
      <div className="flex h-full min-h-0 flex-col bg-slate-100">
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <FlowCanvas />
          <BlankJourneyDoors />
        </div>
        <UploadFlow />
      </div>
    )
  }

  if (stage === 'center') {
    return (
      <div className="flex h-full min-h-0 flex-col bg-slate-100">
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-40">
            <FlowCanvas />
          </div>
          <div className="absolute inset-0 z-20 flex justify-center px-md py-lg">
            <div
              className="flex h-full w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)]"
              style={{ width: CENTER_W }}
            >
              <PromptCodeDock compact />
            </div>
          </div>
        </div>
        <UploadFlow />
      </div>
    )
  }

  const gridTemplateColumns = [
    '1fr',
    assistantOpen ? `${ASSISTANT_W}px` : `${ASSISTANT_FOLDED_W}px`,
  ].join(' ')

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-100">
      <div
        className="grid min-h-0 flex-1 motion-reduce:transition-none"
        style={{
          gridTemplateColumns,
          transition: `grid-template-columns ${PANEL_MS}ms ${EASE_ENTER}`,
        }}
      >
        <div className="flex min-h-0 min-w-0 flex-col">
          <PlayHeader />
          <div data-focus-root className="relative min-h-0 flex-1">
            <div data-canvas-pane className="relative z-0 h-full min-h-0 min-w-0 overflow-hidden">
              <FlowCanvas />
            </div>
            <FocusPresentation />
            {previewing && <PreviewOverlay />}
          </div>
        </div>
        <AssistantColumn />
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

function AssistantColumn() {
  const open = useOrchestration((s) => s.assistantOpen)
  const setAssistantOpen = useOrchestration((s) => s.setAssistantOpen)
  const unread = useAssistant((s) => s.threadOpen !== null)
  const dock = usePresence(open, PANEL_MS)
  const launcher = usePresence(!open, PANEL_MS)

  return (
    <div
      className={`relative min-h-0 overflow-hidden ${
        open ? 'border-l border-slate-200 bg-white' : 'bg-slate-100'
      }`}
    >
      {dock.alive && (
        <div
          aria-hidden={!dock.open}
          className="absolute inset-0 flex min-h-0 flex-col motion-reduce:transition-none"
          style={{
            width: ASSISTANT_W,
            right: 0,
            opacity: dock.open ? 1 : 0,
            transform: `translateX(${dock.open ? 0 : 16}px)`,
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
            title="Open Chargebee Copilot"
            className="relative rounded-full shadow-[0_8px_24px_rgba(15,23,42,0.18)] transition-transform hover:scale-105"
          >
            <CopilotMark size={48} alt="Chargebee Copilot" />
            {unread && (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-rose-500" />
            )}
          </button>
        </div>
      )}
    </div>
  )
}
