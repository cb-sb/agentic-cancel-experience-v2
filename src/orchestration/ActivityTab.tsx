import { SButton, SIcon } from '@chargebee/sting-react'
import { useHistory, type HistoryEntry } from '../store/useHistory'

function relativeTime(at: number): string {
  const diff = Date.now() - at
  const min = Math.round(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function KindIcon({ kind }: { kind: HistoryEntry['kind'] }) {
  if (kind === 'milestone') {
    return (
      <span className="flex size-[24px] shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-2 ring-white">
        <SIcon name="info" size={13} />
      </span>
    )
  }
  if (kind === 'restore') {
    return (
      <span className="flex size-[24px] shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 ring-2 ring-white">
        <SIcon name="arrow-left" size={13} />
      </span>
    )
  }
  return (
    <span className="flex size-[24px] shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 ring-2 ring-white">
      <SIcon name="pencil" size={12} />
    </span>
  )
}

/**
 * Activity monitor / version history. Reverse-chronological log of what the
 * merchant changed. Restorable edits carry a snapshot and can be rolled back
 * from the Restore button on the right of the row.
 */
export function ActivityTab() {
  const entries = useHistory((s) => s.entries)
  const restore = useHistory((s) => s.restore)

  if (entries.length === 0) {
    return (
      <div className="px-[20px] pb-[24px] pt-[16px] text-center">
        <span className="mx-auto mb-[10px] flex size-[36px] items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <SIcon name="pencil" size={16} />
        </span>
        <p className="text-[13px] font-semibold leading-[18px] text-slate-700">No changes yet</p>
        <p className="mt-[4px] text-[12px] leading-[16px] text-slate-500">
          As you edit the journey, each change is logged here so you can roll back.
        </p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col px-[8px] pb-[12px] pt-[6px]">
      {entries.map((entry, i) => {
        const isCurrent = i === 0
        const isLast = i === entries.length - 1
        return (
          <li key={entry.id} className="relative">
            {/* Timeline rail connecting the entry dots. */}
            {!isLast && (
              <span
                aria-hidden
                className="absolute left-[23px] top-[36px] bottom-[-4px] w-px bg-slate-200"
              />
            )}
            <div className="group relative flex items-center gap-[10px] rounded-[12px] px-[12px] py-[9px] transition-colors hover:bg-slate-50">
              <KindIcon kind={entry.kind} />
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
            </div>
          </li>
        )
      })}
    </ul>
  )
}
