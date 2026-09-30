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
import { closeTab, focusTab, openAnotherTab, openTab, tabNumber } from '../workspace/paneTabs'
import { activeKind, useWorkspaceUi, type PaneTab, type ThreadTabs } from '../workspace/useWorkspaceUi'
import { PlanTab } from '../orchestration/PlanTab'
import { ExperienceContextBar } from '../plays/ExperienceContext'
import { ExperienceTaskList } from '../setup/TaskList'
import { TargetingTab } from '../orchestration/TargetingTab'
import { LAYOUT, STUDIO, TABBED, V8 } from './layoutMode'
import { SIDEBAR_FOLDED_W, SIDEBAR_W, ThreadSidebar } from './ThreadSidebar'
import { BackButton, backToExperiences } from '../shell/BackButton'

export const TAB_LABEL: Record<PaneTab, string> = {
  editor: 'Editor',
  canvas: V8 ? 'Steps map' : 'Canvas',
  targeting: 'Targeting',
  preview: 'Preview',
  plan: V8 ? 'Summary' : 'Plan',
  tasks: 'Task list',
}
const TAB_ORDER: PaneTab[] = V8
  ? ['editor', 'preview', 'plan', 'tasks', 'canvas']
  : STUDIO
    ? ['editor', 'preview', 'targeting', 'canvas', 'plan']
    : ['editor', 'preview', 'canvas']

const TAB_HINT: Partial<Record<PaneTab, string>> = {
  editor: 'Change screens and copy',
  preview: 'Walk it as a subscriber',
  plan: 'Every setting in one place',
  tasks: 'What is done and what is left',
  canvas: 'Every step of this experience at once',
}

export function usePaneShown(): boolean {
  const stage = useCopilotStage()
  const paneHidden = useWorkspaceUi((s) => s.paneHidden)
  const tabCount = useWorkspaceUi((s) => s.tabs.open.length)
  if (stage !== 'rail') return false
  return TABBED ? tabCount > 0 : !paneHidden
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

/** v7 lists every view; one that is already open offers to switch to it, as Chrome does. */
function AddTabMenu({ tabs }: { tabs: ThreadTabs }) {
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
  const openKinds = tabs.open.map((t) => t.kind)
  const activeTabKind = activeKind(tabs)
  const options = STUDIO ? TAB_ORDER : TAB_ORDER.filter((id) => !openKinds.includes(id))
  if (options.length === 0) return null
  return (
    <div ref={ref} className="relative flex h-[42px] flex-none items-center self-end">
      <IconButton label="Open a tab" onClick={() => setOpen((v) => !v)}>
        <SIcon name="plus" size={15} />
      </IconButton>
      {open && V8 && (
        <div className="absolute left-0 top-full z-40 mt-1 w-[280px] rounded-xl border border-slate-200 bg-white p-1 shadow-[0_12px_40px_rgba(15,23,42,0.16)]">
          {options.map((id) => {
            const count = openKinds.filter((k) => k === id).length
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setOpen(false)
                  openAnotherTab(id)
                }}
                className="flex w-full items-center gap-[8px] rounded-lg px-3 py-1.5 text-left hover:bg-slate-100"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-slate-800">{TAB_LABEL[id]}</span>
                  <span className="block truncate text-[11.5px] text-slate-400">{TAB_HINT[id]}</span>
                </span>
                {count > 0 && <span className="flex-none text-[11.5px] text-slate-400">{count} open · new tab</span>}
              </button>
            )
          })}
        </div>
      )}
      {open && !V8 && (
        <div
          className={`absolute left-0 top-full z-40 mt-1 rounded-xl border border-slate-200 bg-white p-1 shadow-[0_12px_40px_rgba(15,23,42,0.16)] ${
            STUDIO ? 'w-[260px]' : 'w-[160px]'
          }`}
        >
          {options.map((id) => {
            const isOpen = openKinds.includes(id)
            const current = activeTabKind === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setOpen(false)
                  openTab(id)
                }}
                className="flex w-full items-center gap-[8px] rounded-lg px-3 py-1.5 text-left text-[13px] text-slate-700 hover:bg-slate-100"
              >
                <span className="min-w-0 flex-1 truncate">{TAB_LABEL[id]}</span>
                {current ? (
                  <span className="flex-none text-[11.5px] text-slate-400">Current tab</span>
                ) : (
                  isOpen && (
                    <span className="flex flex-none items-center gap-[4px] rounded-full border border-slate-200 px-[8px] py-[2px] text-[11.5px] font-medium text-slate-600">
                      Switch to this tab
                      <SIcon name="arrow-right" size={11} />
                    </span>
                  )
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function tabLabel(tabs: ThreadTabs, id: string): string {
  const ref = tabs.open.find((t) => t.id === id)
  if (!ref) return ''
  const n = tabNumber(tabs, id)
  return n > 1 ? `${TAB_LABEL[ref.kind]} ${n}` : TAB_LABEL[ref.kind]
}

/** Tabs layout: opened by Copilot or the + menu. v8 can hold more than one of a kind. */
export function TabbedPane() {
  const tabs = useWorkspaceUi((s) => s.tabs)
  const kind = activeKind(tabs)
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-100">
      <div className="flex h-[60px] flex-none items-end gap-1 border-b border-slate-200 bg-slate-50 pl-2 pr-4">
        {V8 && <BackButton fallback={backToExperiences} className="mr-[4px] self-center" />}
        <div role="tablist" aria-label="Open views" className="no-scrollbar -mb-px flex min-w-0 items-end gap-1 overflow-x-auto overflow-y-hidden">
          {tabs.open.map((ref) => {
            const active = tabs.active === ref.id
            const label = tabLabel(tabs, ref.id)
            return (
              <div
                key={ref.id}
                className={`group -mb-px flex h-[42px] flex-none items-center gap-1 rounded-t-xl border px-3 text-[13px] font-semibold ${
                  active
                    ? 'border-slate-200 border-b-white bg-white text-slate-900'
                    : 'border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => focusTab(ref.id)}
                  onAuxClick={(e) => {
                    if (e.button === 1) closeTab(ref.id)
                  }}
                  className="whitespace-nowrap px-1"
                >
                  {label}
                </button>
                <button
                  type="button"
                  aria-label={`Close ${label}`}
                  title={`Close ${label}`}
                  onClick={() => closeTab(ref.id)}
                  className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-800"
                >
                  <SIcon name="x" size={12} />
                </button>
              </div>
            )
          })}
        </div>
        <AddTabMenu tabs={tabs} />
        <div className="ml-auto flex min-w-0 items-center gap-[12px] self-center">
          <PlayActions />
        </div>
      </div>
      {V8 && <ExperienceContextBar />}
      <div data-focus-root className="relative min-h-0 flex-1 bg-white">
        {kind === 'canvas' && <CanvasPane />}
        {kind === 'targeting' && !V8 && <TargetingTab />}
        {kind === 'plan' && <PlanTab key={tabs.active} />}
        {kind === 'tasks' && <ExperienceTaskList key={tabs.active} />}
        {kind === 'editor' && <EditorPane />}
        {kind === 'preview' && <PreviewOverlay variant="tab" />}
      </div>
    </div>
  )
}

export function ReopenPane() {
  const stage = useCopilotStage()
  const setPaneHidden = useWorkspaceUi((s) => s.setPaneHidden)
  const workSurface = useOrchestration((s) => s.workSurface)
  if (stage !== 'rail') return null
  const reopen = () => (TABBED ? openTab('editor') : setPaneHidden(false))
  const label = LAYOUT === 'threads' && workSurface === 'canvas' ? 'Open canvas' : 'Open editor'
  return (
    <button
      type="button"
      onClick={reopen}
      className="absolute right-4 top-[72px] z-10 flex items-center gap-[6px] rounded-lg border border-slate-200 bg-white px-[10px] py-[6px] text-[12.5px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
    >
      <SIcon name="panel-left" size={14} className={V8 ? '' : 'rotate-180'} />
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
  const activeTab = useWorkspaceUi((s) => activeKind(s.tabs))
  const stepCount = useExperience((s) => s.experiences[PRIMARY_EXPERIENCE_ID]?.steps.length ?? 0)
  const stage = useCopilotStage()
  const paneShown = usePaneShown()
  const editorShown = paneShown && (TABBED ? activeTab === 'editor' : !previewing && workSurface === 'editor')

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
          <div className="flex h-full min-h-0">
            <PromptCodeDock centered />
          </div>
          {!paneShown && <ReopenPane />}
        </div>
        {paneShown && (TABBED ? <TabbedPane /> : <WorkPane />)}
      </div>
      {LAYOUT === 'threads' && <PreviewOverlay variant="screen" />}
      {templatesOpen && <TemplatesModal />}
      <UploadFlow />
    </div>
  )
}
