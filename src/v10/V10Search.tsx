import { useEffect, useMemo, useState } from 'react'
import { SIcon, type SIconName } from '@chargebee/sting-react'
import { create } from 'zustand'
import { useV10Rows, type V10Row } from './rows'
import { openRef, type V10Kind } from './useV10'

export const useV10Search = create<{ open: boolean }>(() => ({ open: false }))

export function openV10Search() {
  useV10Search.setState({ open: true })
}

const GROUPS: { kind: V10Kind; title: string; icon: SIconName }[] = [
  { kind: 'play', title: 'Plays', icon: 'workflow' },
  { kind: 'experience', title: 'Experiences', icon: 'layers' },
  { kind: 'audience', title: 'Audiences', icon: 'users' },
]

const LIMIT = 6

/** One search over every play, experience and audience in Growth. */
export function V10Search() {
  const open = useV10Search((state) => state.open)
  const rows = useV10Rows()
  const [query, setQuery] = useState('')
  const [at, setAt] = useState(0)
  const close = () => useV10Search.setState({ open: false })

  useEffect(() => {
    if (open) {
      setQuery('')
      setAt(0)
    }
  }, [open])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const hit = (row: V10Row) => !q || [row.title, row.type, ...row.tags].some((text) => text.toLowerCase().includes(q))
    const byRecent = [...rows].sort((a, b) => b.updatedAt - a.updatedAt)
    return GROUPS.flatMap((group) => byRecent.filter((row) => row.kind === group.kind && hit(row)).slice(0, LIMIT))
  }, [query, rows])

  if (!open) return null

  const pick = (index: number) => {
    const row = results[index]
    if (!row) return
    close()
    openRef(row)
  }
  let lastKind = ''

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-slate-900/25 pt-[12vh]" onClick={close}>
      <div
        role="dialog"
        aria-label="Search Growth"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[70vh] w-[600px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(15,23,42,0.24)]"
      >
        <div className="flex h-[52px] flex-none items-center gap-[10px] border-b border-slate-100 px-[16px]">
          <SIcon name="search" size={17} className="flex-none text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setAt(0)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') close()
              else if (event.key === 'ArrowDown') {
                event.preventDefault()
                setAt((index) => Math.min(results.length - 1, index + 1))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setAt((index) => Math.max(0, index - 1))
              } else if (event.key === 'Enter') pick(at)
            }}
            placeholder="Search plays, experiences and audiences"
            className="min-w-0 flex-1 bg-transparent text-[14.5px] text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-[8px]">
          {results.length === 0 && <p className="px-[12px] py-[16px] text-[13px] text-slate-500">Nothing matches.</p>}
          {results.map((row, index) => {
            const group = GROUPS.find((entry) => entry.kind === row.kind)!
            const heading = row.kind !== lastKind ? group.title : null
            lastKind = row.kind
            return (
              <div key={`${row.kind}-${row.source}-${row.id}`}>
                {heading && <p className="px-[12px] pb-[4px] pt-[10px] text-[11px] font-semibold uppercase tracking-wide text-slate-400">{heading}</p>}
                <button
                  type="button"
                  onMouseEnter={() => setAt(index)}
                  onClick={() => pick(index)}
                  className={`flex w-full cursor-pointer items-center gap-[12px] rounded-lg px-[12px] py-[8px] text-left ${at === index ? 'bg-slate-100' : ''}`}
                >
                  <SIcon name={group.icon} size={16} className="flex-none text-slate-500" />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-slate-900">{row.title}</span>
                  <span className="max-w-[45%] flex-none truncate text-[12px] text-slate-400">
                    {row.type} · {row.status === 'live' ? 'Live' : 'Draft'}
                  </span>
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
