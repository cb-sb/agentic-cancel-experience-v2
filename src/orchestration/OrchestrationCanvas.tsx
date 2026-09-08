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

export function OrchestrationCanvas() {
  const templatesOpen = useOrchestration((s) => s.templatesOpen)
  const assistantOpen = useOrchestration((s) => s.assistantOpen)
  const previewing = useExperience((s) => s.mode === 'play')

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
            <div data-canvas-pane className="relative h-full min-h-0 min-w-0 overflow-hidden">
              <FlowCanvas />
              {previewing && <PreviewOverlay />}
            </div>
            <FocusPresentation />
          </div>
        </div>
        <AssistantColumn />
      </div>
      {templatesOpen && <TemplatesModal />}
    </div>
  )
}

/** Curves for a pane folding away and coming back. */
const fade = (shown: boolean) =>
  `opacity ${PANEL_MS}ms ${shown ? EASE_ENTER : EASE_LEAVE}, transform ${PANEL_MS}ms ${
    shown ? EASE_ENTER : EASE_LEAVE
  }`

/**
 * Chargebee Copilot, always a right-hand column.
 *
 * Open, it is a full-height rail that takes width from the play. Folded, the
 * same column shrinks to the launcher icon — the canvas is still pushed, never
 * covered.
 */
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
