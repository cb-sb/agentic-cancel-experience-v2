import { SButton, SIcon } from '@chargebee/sting-react'
import { useHistory } from '../store/useHistory'

function relativeTime(at: number): string {
  const diff = Date.now() - at
  const min = Math.round(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Restore points for the plan. Newest first. */
export function ActivityTab() {
  const entries = useHistory((s) => s.entries)
  const restore = useHistory((s) => s.restore)

  const shown = entries.filter((entry, i) => i === 0 || entry.restorable)

  if (shown.length === 0) {
    return (
      <div className="px-[20px] pb-[24px] pt-[16px] text-center">
        <p className="text-[13px] font-semibold leading-[18px] text-slate-700">No earlier versions</p>
        <p className="mt-[4px] text-[12px] leading-[16px] text-slate-500">
          Each edit is kept so you can restore an earlier version of this plan.
        </p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-[4px] px-[8px] pb-[12px] pt-[8px]">
      {shown.map((entry, i) => {
        const isCurrent = i === 0
        return (
          <li
            key={entry.id}
            className="flex items-center gap-[10px] rounded-[12px] px-[12px] py-[10px] hover:bg-slate-50"
          >
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-[13px] font-semibold leading-[18px] text-slate-800">
                {entry.summary}
              </span>
              <span className="mt-[1px] block text-[11px] leading-[14px] text-slate-400">
                {relativeTime(entry.at)}
              </span>
            </span>
            {isCurrent ? (
              <span className="shrink-0 rounded-full bg-emerald-50 px-[8px] py-[3px] text-[10px] font-semibold uppercase leading-[12px] tracking-[0.04em] text-emerald-700">
                Current
              </span>
            ) : entry.restorable ? (
              <span className="shrink-0">
                <SButton
                  size="small"
                  variant="neutral-outline"
                  onClick={() => restore(entry.id)}
                  icon={<SIcon name="arrow-left" size={12} />}
                >
                  Restore
                </SButton>
              </span>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
