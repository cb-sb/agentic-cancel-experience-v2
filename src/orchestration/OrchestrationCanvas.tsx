import { useEffect } from 'react'
import { EASE_ENTER, EASE_LEAVE, PANEL_MS } from '../lib/motion'
import { usePresence } from '../lib/usePresence'
import { useExperience } from '../store/useExperience'
import { useOrchestration } from '../store/useOrchestration'
import { ASSISTANT_FOLDED_W, ASSISTANT_W, COPILOT_CENTER_W } from './paneTokens'
import { useAssistant } from './assistant/useAssistant'
import { CopilotMark } from './CopilotMark'
import { PromptCodeDock } from './PromptCodeDock'
import { FlowCanvas } from './flow/FlowCanvas'
import { FocusPresentation } from './focus'
import { PlayHeader } from './PlayHeader'
import { PreviewOverlay } from './PreviewHeader'
import { LibraryPanel, TemplatesModal } from './TemplatesModal'
import { UploadFlow } from '../upload/UploadFlow'
import { BlankJourneyDoors } from './BlankJourneyDoors'
import { SetupTrackerDock } from './JourneySetupChrome'
import { useCopilotStage } from './copilotStage'

const COPILOT_MORPH_MS = 380

function Workspace({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
      {children}
      <div className="pointer-events-none absolute bottom-[32px] left-[24px] z-30">
        <div className="pointer-events-auto">
          <SetupTrackerDock />
        </div>
      </div>
    </div>
  )
}

function DoorsBackdrop() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 bg-slate-100"
      style={{
        backgroundImage: 'radial-gradient(#d5dae1 1.4px, transparent 1.4px)',
        backgroundSize: '22px 22px',
      }}
    />
  )
}

function CenterOverlay({
  size,
  onBackdrop,
  children,
}: {
  size: 'library' | 'copilot'
  onBackdrop?: () => void
  children: React.ReactNode
}) {
  const library = size === 'library'
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center">
      <div
        aria-hidden={!library}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm motion-reduce:transition-none"
        style={{
          opacity: library ? 1 : 0,
          pointerEvents: library && onBackdrop ? 'auto' : 'none',
          transition: `opacity ${COPILOT_MORPH_MS}ms ${library ? EASE_ENTER : EASE_LEAVE}`,
        }}
        onClick={library ? onBackdrop : undefined}
      />
      <div
        className="relative z-10 flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)] motion-reduce:transition-none"
        style={{
          width: library ? 880 : COPILOT_CENTER_W,
          height: library ? 740 : '75vh',
          maxWidth: library ? 'min(880px, 92vw)' : COPILOT_CENTER_W,
          maxHeight: library ? '86vh' : '75vh',
          transition: `width ${COPILOT_MORPH_MS}ms ${EASE_ENTER}, height ${COPILOT_MORPH_MS}ms ${EASE_ENTER}, max-width ${COPILOT_MORPH_MS}ms ${EASE_ENTER}, max-height ${COPILOT_MORPH_MS}ms ${EASE_ENTER}`,
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function OrchestrationCanvas() {
  const templatesOpen = useOrchestration((s) => s.templatesOpen)
  const closeTemplates = useOrchestration((s) => s.closeTemplates)
  const assistantOpen = useOrchestration((s) => s.assistantOpen)
  const setAssistantOpen = useOrchestration((s) => s.setAssistantOpen)
  const copilotDocked = useOrchestration((s) => s.copilotDocked)
  const previewing = useExperience((s) => s.mode === 'play')
  const stage = useCopilotStage()

  useEffect(() => {
    if (stage === 'doors') {
      setAssistantOpen(false)
      return
    }
    setAssistantOpen(!previewing)
  }, [previewing, setAssistantOpen, stage])

  if (stage === 'doors' || stage === 'center') {
    const library = templatesOpen && stage === 'doors'
    const copilot = stage === 'center'
    if (copilot && copilotDocked) {
      return (
        <div className="flex h-full min-h-0 flex-col bg-slate-100">
          <div className="flex min-h-0 flex-1">
            <Workspace>
              <DoorsBackdrop />
              <BlankJourneyDoors packed />
              {templatesOpen && <TemplatesModal />}
            </Workspace>
            <div
              className="relative z-20 flex h-full min-h-0 flex-none flex-col overflow-hidden border-l border-slate-200 bg-white"
              style={{ width: COPILOT_CENTER_W }}
            >
              <PromptCodeDock />
            </div>
          </div>
          <UploadFlow />
        </div>
      )
    }
    return (
      <div className="flex h-full min-h-0 flex-col bg-slate-100">
        <Workspace>
          <DoorsBackdrop />
          {stage === 'doors' && !templatesOpen && <BlankJourneyDoors />}
          {(library || copilot) && (
            <CenterOverlay size={copilot ? 'copilot' : 'library'} onBackdrop={closeTemplates}>
              {copilot ? <PromptCodeDock compact /> : <LibraryPanel />}
            </CenterOverlay>
          )}
          {templatesOpen && copilot && <TemplatesModal />}
        </Workspace>
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
      <Workspace>
        <div
          className="grid h-full min-h-0 motion-reduce:transition-none"
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
      </Workspace>
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
