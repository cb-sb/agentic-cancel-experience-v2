import { EASE_ENTER, EASE_LEAVE, PANEL_MS } from '../lib/motion'
import { usePresence } from '../lib/usePresence'
import { useOrchestration } from '../store/useOrchestration'
import { ASSISTANT_FOLDED_W, ASSISTANT_W } from './paneTokens'
import { useAssistant } from './assistant/useAssistant'
import { PromptCodeDock } from './PromptCodeDock'
import { FlowCanvas } from './flow/FlowCanvas'
import { FocusPresentation } from './focus'
import { PlayHeader } from './PlayHeader'
import { TemplatesModal } from './TemplatesModal'

export function OrchestrationCanvas() {
  const templatesOpen = useOrchestration((s) => s.templatesOpen)
  const assistantOpen = useOrchestration((s) => s.assistantOpen)

  const gridTemplateColumns = [
    assistantOpen ? `${ASSISTANT_W}px` : `${ASSISTANT_FOLDED_W}px`,
    '1fr',
  ].join(' ')

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-100">
      <PlayHeader />
      <div data-focus-root className="relative min-h-0 flex-1">
        <div
          className="grid h-full motion-reduce:transition-none"
          style={{
            gridTemplateColumns,
            transition: `grid-template-columns ${PANEL_MS}ms ${EASE_ENTER}`,
          }}
        >
          <AssistantColumn />
          <div data-canvas-pane className="relative min-h-0 min-w-0">
            <FlowCanvas />
          </div>
        </div>
        <AssistantPill />
        <FocusPresentation />
      </div>
      {templatesOpen && <TemplatesModal />}
    </div>
  )
}

/**
 * Three quarters of the viewport, centred. Fixed rather than fitted so the
 * assistant is the same shape whatever it is saying, and short enough that the
 * play is visible past both ends of it.
 */
const PANEL_H = 'h-[75vh] max-h-full'

/** Curves for a pane folding away and coming back. */
const fade = (shown: boolean) =>
  `opacity ${PANEL_MS}ms ${shown ? EASE_ENTER : EASE_LEAVE}, transform ${PANEL_MS}ms ${
    shown ? EASE_ENTER : EASE_LEAVE
  }`

/**
 * The assistant, open: a card floating in its own column.
 *
 * The column is the only thing that changes width, and the card is clipped by
 * it rather than squeezed — a conversation reflowing on its way out is what
 * made folding read as a cut rather than a fold.
 */
function AssistantColumn() {
  const open = useOrchestration((s) => s.assistantOpen)
  const dock = usePresence(open, PANEL_MS)

  return (
    <div className="relative min-h-0 overflow-hidden">
      {dock.alive && (
        <div
          aria-hidden={!dock.open}
          className="absolute inset-y-0 left-0 flex items-center px-3 motion-reduce:transition-none"
          style={{
            width: ASSISTANT_W,
            opacity: dock.open ? 1 : 0,
            transform: `translateX(${dock.open ? 0 : -12}px)`,
            transition: fade(dock.open),
            pointerEvents: dock.open ? undefined : 'none',
          }}
        >
          <div className={`${PANEL_H} w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)]`}>
            <PromptCodeDock />
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * The assistant, folded: a pill in the corner of the play.
 *
 * It gives its column back entirely rather than keeping a rail, so the canvas
 * is the full width while the assistant is away. The cost is the one the rail
 * was there to avoid — the pill sits over the play instead of beside it, so the
 * top-left corner is spoken for — which is why it is kept as small as a label
 * and an icon allow, and why it fades on the same curve as the column it came
 * from: the two motions together read as one thing folding into the corner.
 */
function AssistantPill() {
  const open = useOrchestration((s) => s.assistantOpen)
  const setAssistantOpen = useOrchestration((s) => s.setAssistantOpen)
  const unread = useAssistant((s) => s.threadOpen !== null)
  const pill = usePresence(!open, PANEL_MS)
  if (!pill.alive) return null

  return (
    <button
      type="button"
      onClick={() => setAssistantOpen(true)}
      title="Open setup assistant"
      aria-hidden={!pill.open}
      className="group absolute left-3 top-3 z-20 flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-3.5 shadow-sm hover:shadow-md motion-reduce:transition-none"
      style={{
        opacity: pill.open ? 1 : 0,
        transform: `translateX(${pill.open ? 0 : -10}px)`,
        transition: `${fade(pill.open)}, box-shadow 150ms ease-out`,
        pointerEvents: pill.open ? undefined : 'none',
      }}
    >
      <span className="relative flex h-6 w-6 flex-none items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
        </svg>
        {unread && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-rose-500" />
        )}
      </span>
      <span className="whitespace-nowrap text-[12px] font-semibold text-slate-500 transition-colors group-hover:text-slate-900">
        Setup
      </span>
    </button>
  )
}
