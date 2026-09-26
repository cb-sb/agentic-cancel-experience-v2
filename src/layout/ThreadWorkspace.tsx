import { useEffect, useRef, useState } from 'react'
import { SIcon } from '@chargebee/sting-react'
import { EASE_ENTER, PANEL_MS } from '../lib/motion'
import { PRIMARY_EXPERIENCE_ID } from '../lib/orchestrationSeed'
import { useExperience } from '../store/useExperience'
import { useOrchestration } from '../store/useOrchestration'
import { useCopilotStage } from '../orchestration/copilotStage'
import { FlowCanvas } from '../orchestration/flow/FlowCanvas'
import { EditorPane } from '../orchestration/OrchestrationCanvas'
import { PlayActions, PlayHeader } from '../orchestration/PlayHeader'
import { PreviewOverlay } from '../orchestration/PreviewHeader'
import { PromptCodeDock } from '../orchestration/PromptCodeDock'
import { TemplatesModal } from '../orchestration/TemplatesModal'
import { UploadFlow } from '../upload/UploadFlow'
import { closeTab, openTab } from '../workspace/paneTabs'
import { useWorkspaceUi, type PaneTab } from '../workspace/useWorkspaceUi'
import { LAYOUT } from './layoutMode'
import { SIDEBAR_FOLDED_W, SIDEBAR_W, ThreadSidebar } from './ThreadSidebar'

const TAB_LABEL: Record<PaneTab, string> = { editor: 'Editor', canvas: 'Canvas', preview: 'Preview' }
const TAB_ORDER: PaneTab[] = ['editor', 'preview', 'canvas']

function usePaneShown(): boolean {
  const stage = useCopilotStage()
  const paneHidden = useWorkspaceUi((s) => s.paneHidden)
  const tabCount = useWorkspaceUi((s) => s.tabs.open.length)
  if (stage !== 'rail') return false
  return LAYOUT === 'tabs' ? tabCount > 0 : !paneHidden
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
    >
      {children}
    </button>
  )
}

function CanvasPane() {
  return (
    <div data-canvas-pane className="relative z-0 h-full min-h-0 min-w-0 overflow-hidden">
      <FlowCanvas />
    </div>
  )
}

/** Threads layout: editor or canvas on the right, closable. Preview covers the whole app. */
function WorkPane() {
  const workSurface = useOrchestration((s) => s.workSurface)
  const previewing = useExperience((s) => s.mode === 'play')
  const setPaneHidden = useWorkspaceUi((s) => s.setPaneHidden)
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-100">
      <PlayHeader
        trailing={
          <IconButton label="Close panel" onClick={() => setPaneHidden(true)}>
            <SIcon name="x" size={16} />
          </IconButton>
        }
      />
      <div data-focus-root className="relative min-h-0 flex-1">
        {!previewing && (workSurface === 'canvas' ? <CanvasPane /> : <EditorPane />)}
      </div>
    </div>
  )
}

function AddTabMenu({ missing }: { missing: PaneTab[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])
  if (missing.length === 0) return null
  return (
    <div ref={ref} className="relative self-center">
      <IconButton label="Open a tab" onClick={() => setOpen((v) => !v)}>
        <SIcon name="plus" size={15} />
      </IconButton>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-[160px] rounded-xl border border-slate-200 bg-white p-1 shadow-[0_12px_40px_rgba(15,23,42,0.16)]">
          {missing.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setOpen(false)
                openTab(id)
              }}
              className="block w-full rounded-lg px-3 py-1.5 text-left text-[13px] text-slate-700 hover:bg-slate-100"
            >
              {TAB_LABEL[id]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Tabs layout: one Editor, one Canvas, one Preview at most, opened by Copilot or the + menu. */
function TabbedPane() {
  const tabs = useWorkspaceUi((s) => s.tabs)
  const missing = TAB_ORDER.filter((id) => !tabs.open.includes(id))
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-100">
      <div className="flex h-[60px] flex-none items-end gap-1 border-b border-slate-200 bg-slate-50 pl-2 pr-4">
        <div role="tablist" aria-label="Open views" className="flex min-w-0 items-end gap-1">
          {tabs.open.map((id) => {
            const active = tabs.active === id
            return (
              <div
                key={id}
                className={`group -mb-px flex h-[42px] items-center gap-1 rounded-t-xl border px-3 text-[13px] font-semibold ${
                  active
                    ? 'border-slate-200 border-b-white bg-white text-slate-900'
                    : 'border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <button type="button" role="tab" aria-selected={active} onClick={() => openTab(id)} className="px-1">
                  {TAB_LABEL[id]}
                </button>
                <button
                  type="button"
                  aria-label={`Close ${TAB_LABEL[id]}`}
                  title={`Close ${TAB_LABEL[id]}`}
                  onClick={() => closeTab(id)}
                  className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-800"
                >
                  <SIcon name="x" size={12} />
                </button>
              </div>
            )
          })}
        </div>
        <AddTabMenu missing={missing} />
        <div className="ml-auto flex min-w-0 items-center gap-[12px] self-center">
          <PlayActions />
        </div>
      </div>
      <div data-focus-root className="relative min-h-0 flex-1 bg-white">
        {tabs.active === 'canvas' && <CanvasPane />}
        {tabs.active === 'editor' && <EditorPane />}
        {tabs.active === 'preview' && <PreviewOverlay variant="tab" />}
      </div>
    </div>
  )
}

function ReopenPane() {
  const stage = useCopilotStage()
  const setPaneHidden = useWorkspaceUi((s) => s.setPaneHidden)
  const workSurface = useOrchestration((s) => s.workSurface)
  if (stage !== 'rail') return null
  const reopen = () => (LAYOUT === 'tabs' ? openTab('editor') : setPaneHidden(false))
  const label = LAYOUT === 'threads' && workSurface === 'canvas' ? 'Open canvas' : 'Open editor'
  return (
    <button
      type="button"
      onClick={reopen}
      className="absolute right-4 top-[14px] z-10 flex items-center gap-[6px] rounded-lg border border-slate-200 bg-white px-[10px] py-[6px] text-[12.5px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
    >
      <SIcon name="panel-left" size={14} className="rotate-180" />
      {label}
    </button>
  )
}

/**
 * Threads (Claude-like) and tabs (Cursor-like): experiences as threads on the
 * left, Copilot in the middle, the work on the right.
 */
export function ThreadWorkspace() {
  const sidebarOpen = useWorkspaceUi((s) => s.sidebarOpen)
  const templatesOpen = useOrchestration((s) => s.templatesOpen)
  const setAssistantOpen = useOrchestration((s) => s.setAssistantOpen)
  const workSurface = useOrchestration((s) => s.workSurface)
  const focusTarget = useOrchestration((s) => s.focusTarget)
  const previewing = useExperience((s) => s.mode === 'play')
  const activeTab = useWorkspaceUi((s) => s.tabs.active)
  const stepCount = useExperience((s) => s.experiences[PRIMARY_EXPERIENCE_ID]?.steps.length ?? 0)
  const stage = useCopilotStage()
  const paneShown = usePaneShown()
  const editorShown = paneShown && (LAYOUT === 'tabs' ? activeTab === 'editor' : !previewing && workSurface === 'editor')

  useEffect(() => {
    if (stage === 'rail') setAssistantOpen(true)
  }, [stage, setAssistantOpen])

  useEffect(() => {
    if (!editorShown || focusTarget || stepCount === 0) return
    useOrchestration.getState().enterWorkEditor()
  }, [editorShown, focusTarget, stepCount])

  return (
    <div
      className="grid h-full min-h-0 bg-white motion-reduce:transition-none"
      style={{
        gridTemplateColumns: `${sidebarOpen ? SIDEBAR_W : SIDEBAR_FOLDED_W}px minmax(0,1fr)`,
        transition: `grid-template-columns ${PANEL_MS}ms ${EASE_ENTER}`,
      }}
    >
      <ThreadSidebar />
      <div className="flex min-h-0 min-w-0">
        <div
          className={`relative flex min-h-0 flex-col bg-white ${
            paneShown ? 'w-[clamp(360px,32%,500px)] flex-none border-r border-slate-200' : 'min-w-0 flex-1'
          }`}
        >
          <div className={paneShown ? 'flex h-full min-h-0' : 'mx-auto flex h-full min-h-0 w-full max-w-[860px] border-x border-slate-100'}>
            <PromptCodeDock centered />
          </div>
          {!paneShown && <ReopenPane />}
        </div>
        {paneShown && (LAYOUT === 'tabs' ? <TabbedPane /> : <WorkPane />)}
      </div>
      {LAYOUT === 'threads' && <PreviewOverlay variant="screen" />}
      {templatesOpen && <TemplatesModal />}
      <UploadFlow />
    </div>
  )
}
