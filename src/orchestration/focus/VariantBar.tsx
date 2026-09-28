import { playVariants } from '../../play/resolve'
import { useOrchestration } from '../../store/useOrchestration'
import { openTab } from '../../workspace/paneTabs'
import { openVariantInEditor } from '../TargetingTab'

/** Says who gets the cancel page being edited, and switches between the play's variants. */
export function VariantBar({ experienceId }: { experienceId: string }) {
  const play = useOrchestration((s) => s.play)
  const variants = playVariants(play).filter((v) => v.experienceId)
  const current = variants.find((v) => v.experienceId === experienceId) ?? variants[0]
  if (!current) return null

  return (
    <div className="flex h-[44px] flex-none items-center gap-[10px] border-b border-slate-200 bg-white px-[16px] text-[13px]">
      {variants.length > 1 ? (
        <select
          aria-label="Variant"
          value={current.experienceId ?? ''}
          onChange={(e) => openVariantInEditor(e.target.value)}
          className="rounded-md border border-slate-200 bg-white px-[8px] py-[4px] text-[13px] font-semibold text-slate-900 outline-none hover:border-slate-300"
        >
          {variants.map((v) => (
            <option key={v.branchId} value={v.experienceId ?? ''}>
              {v.label}
            </option>
          ))}
        </select>
      ) : (
        <span className="font-semibold text-slate-900">{current.label}</span>
      )}
      <span className="min-w-0 truncate text-slate-500">{current.share}</span>
      <button
        type="button"
        onClick={() => openTab('targeting')}
        className="ml-auto flex-none text-[12.5px] font-semibold text-indigo-600 hover:text-indigo-800"
      >
        Targeting
      </button>
    </div>
  )
}
