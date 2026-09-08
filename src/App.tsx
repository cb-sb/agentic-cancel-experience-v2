import { useExperience } from './store/useExperience'
import { useOrchestration } from './store/useOrchestration'
import { blueprintMeta } from './lib/blueprints'
import { Composer } from './composer/Composer'
import { DeviceToggle } from './render/DeviceToggle'
import { OrchestrationCanvas } from './orchestration/OrchestrationCanvas'

function BackToCanvasButton() {
  const backToCanvas = useOrchestration((s) => s.backToCanvas)
  return (
    <button
      type="button"
      onClick={backToCanvas}
      className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
    >
      <span aria-hidden>←</span> Orchestration
    </button>
  )
}

function TopBar() {
  const blueprint = useExperience((s) => s.experience.blueprint)
  const meta = blueprintMeta(blueprint)
  return (
    <header className="flex h-14 flex-none items-center justify-between border-b border-slate-200 bg-white px-5">
      <div className="flex items-center gap-3">
        <BackToCanvasButton />
        <div className="h-6 w-px bg-slate-200" />
        <div>
          <div className="text-sm font-bold text-slate-900">Cancel Experience Composer</div>
          <div className="text-[11px] text-slate-400">
            {meta.name} · {meta.stepCount} step{meta.stepCount > 1 ? 's' : ''}
          </div>
        </div>
      </div>
      <DeviceToggle />
    </header>
  )
}

export default function App() {
  const view = useOrchestration((s) => s.view)

  if (view === 'editor') {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-slate-100 text-slate-900">
        <TopBar />
        <main className="min-h-0 flex-1">
          <Composer />
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100 text-slate-900">
      <OrchestrationCanvas />
    </div>
  )
}
