import { useEffect } from 'react'
import { EASE_ENTER, PANEL_MS } from '../lib/motion'
import { PRIMARY_EXPERIENCE_ID } from '../lib/orchestrationSeed'
import { useExperience } from '../store/useExperience'
import { useOrchestration } from '../store/useOrchestration'
import { BlankJourneyDoors } from '../orchestration/BlankJourneyDoors'
import { useCopilotStage } from '../orchestration/copilotStage'
import { DoorsBackdrop } from '../orchestration/OrchestrationCanvas'
import { PromptCodeDock } from '../orchestration/PromptCodeDock'
import { LibraryPanel } from '../orchestration/TemplatesModal'
import { V8 } from './layoutMode'
import { BackButton, backToExperiences } from '../shell/BackButton'
import { UploadFlow } from '../upload/UploadFlow'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'
import { CancelPageSettings } from './CancelPageSettings'
import { ExperiencesIndex } from './ExperiencesIndex'
import { ExperiencesPane } from './ExperiencesPane'
import { SearchDialog } from './SearchDialog'
import { SIDEBAR_FOLDED_W, SIDEBAR_W } from './ThreadSidebar'
import { ReopenPane, TabbedPane, usePaneShown } from './ThreadWorkspace'

function ThreadView() {
  const stage = useCopilotStage()
  const templatesOpen = useOrchestration((s) => s.templatesOpen)
  const paneShown = usePaneShown()

  if (templatesOpen) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1">
        <LibraryPanel page />
      </div>
    )
  }

  if (stage === 'doors') {
    return (
      <div className="relative h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-slate-100">
        <DoorsBackdrop />
        <BlankJourneyDoors />
        <div className="absolute left-[16px] top-[14px] z-30">
          <BackButton fallback={backToExperiences} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1">
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
      {paneShown && <TabbedPane />}
    </div>
  )
}

/**
 * V7: the Growth nav, then this experience's pane, then either the Experiences
 * page or the open experience (doors, then Copilot with tabs on the right).
 */
export function StudioWorkspace() {
  const sidebarOpen = useWorkspaceUi((s) => s.sidebarOpen)
  const page = useWorkspaceUi((s) => s.page)
  const beatAsk = useWorkspaceUi((s) => s.beatAsk)
  const setAssistantOpen = useOrchestration((s) => s.setAssistantOpen)
  const focusTarget = useOrchestration((s) => s.focusTarget)
  const activeTab = useWorkspaceUi((s) => s.tabs.active)
  const stepCount = useExperience((s) => s.experiences[PRIMARY_EXPERIENCE_ID]?.steps.length ?? 0)
  const stage = useCopilotStage()
  const paneShown = usePaneShown()
  const templatesOpen = useOrchestration((s) => s.templatesOpen)
  const editorShown = page === 'thread' && !templatesOpen && paneShown && activeTab === 'editor'
  const threeUp = page === 'thread' && !templatesOpen && paneShown

  useEffect(() => {
    if (stage === 'rail') setAssistantOpen(true)
  }, [stage, setAssistantOpen])

  // v8: Copilot and a tab leave no room for this pane. Only a change of layout
  // folds or reopens it, so opening it by hand sticks until the next change.
  useEffect(() => {
    if (V8) useWorkspaceUi.getState().setSidebarOpen(!threeUp)
  }, [threeUp])

  useEffect(() => {
    if (!editorShown || focusTarget || stepCount === 0) return
    useOrchestration.getState().enterWorkEditor()
  }, [editorShown, focusTarget, stepCount])

  useEffect(() => {
    if (beatAsk) useWorkspaceUi.getState().setPage('thread')
  }, [beatAsk])

  return (
    <div
      className="grid h-full min-h-0 bg-white motion-reduce:transition-none"
      style={{
        gridTemplateColumns: `${sidebarOpen ? SIDEBAR_W : SIDEBAR_FOLDED_W}px minmax(0,1fr)`,
        transition: `grid-template-columns ${PANEL_MS}ms ${EASE_ENTER}`,
      }}
    >
      <ExperiencesPane />
      <div className="flex min-h-0 min-w-0">
        {page === 'index' ? (
          <div className="min-w-0 flex-1">
            <ExperiencesIndex />
          </div>
        ) : (
          <ThreadView />
        )}
      </div>
      <UploadFlow />
      <CancelPageSettings />
      <SearchDialog />
    </div>
  )
}
