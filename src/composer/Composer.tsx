import { BlueprintSidebar } from './BlueprintSidebar'
import { ComposerPreview } from './ComposerPreview'

export function Composer() {
  return (
    <div className="grid h-full min-h-0 grid-cols-[280px_1fr] grid-rows-[minmax(0,1fr)] bg-slate-100">
      <BlueprintSidebar />
      <div className="min-h-0 overflow-y-auto">
        <ComposerPreview />
      </div>
    </div>
  )
}
