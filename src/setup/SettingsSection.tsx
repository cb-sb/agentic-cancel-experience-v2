import { useEffect, useRef, useState } from 'react'
import { SIcon } from '@chargebee/sting-react'
import type { TaskRow } from './progress'
import { SetupCard, hasFields, savedLine } from './SetupCards'
import { setMark } from './useSetupState'

const DOT: Record<TaskRow['status'], string> = {
  done: 'bg-emerald-500',
  todo: 'bg-slate-300',
  skipped: 'bg-amber-400',
  na: 'bg-slate-200',
  waiting: 'bg-slate-200',
}

function Row({ row, open, onToggle }: { row: TaskRow; open: boolean; onToggle: () => void }) {
  const value = savedLine(row.entry.id, row.targetId)
  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-[10px] px-[14px] py-[10px] text-left hover:bg-slate-50">
        <span className={`h-[8px] w-[8px] flex-none rounded-full ${DOT[row.status]}`} />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-slate-900">{row.entry.label}</span>
          <span className="block truncate text-[12px] text-slate-500">
            {row.status === 'done' ? value : row.status === 'na' ? 'Not needed' : row.status === 'skipped' ? 'Skipped for now' : row.entry.why}
          </span>
        </span>
        <SIcon name={open ? 'chevron-up' : 'chevron-down'} size={14} className="flex-none text-slate-400" />
      </button>
      {open && (
        <div className="px-[14px] pb-[14px] pt-[2px]">
          <SetupCard entry={row.entry} targetId={row.targetId} mode="summary" />
        </div>
      )}
    </div>
  )
}

/**
 * Settings from the setup checklist, editable in place. An edit here marks the
 * item done and leaves a small line in the chat, so the two stay in step.
 */
export function SettingsSection({ title, hint, rows, onNote }: { title: string; hint?: string; rows: TaskRow[]; onNote: (text: string) => void }) {
  const editable = rows.filter((r) => hasFields(r.entry) && r.entry.id !== 'publish' && r.entry.id !== 'goLive')
  const [open, setOpen] = useState<string | null>(null)
  const values = editable.map((r) => `${r.entry.id}=${savedLine(r.entry.id, r.targetId)}`).join('\n')
  const prev = useRef<Map<string, string> | null>(null)
  const timers = useRef(new Map<string, number>())
  /** Edits made in the chat change the same values. Only count the ones made here. */
  const touched = useRef(0)
  const touch = () => {
    touched.current = Date.now()
  }

  useEffect(() => {
    const now = new Map(editable.map((r) => [r.entry.id, savedLine(r.entry.id, r.targetId)]))
    const before = prev.current
    prev.current = now
    if (!before || Date.now() - touched.current > 4000) return
    for (const r of editable) {
      const id = r.entry.id
      if (before.get(id) === now.get(id)) continue
      window.clearTimeout(timers.current.get(id))
      timers.current.set(
        id,
        window.setTimeout(() => {
          setMark(r.targetId, id, 'done', 'summary')
          onNote(`${r.entry.label} changed in the Summary: ${savedLine(id, r.targetId)}`)
        }, 900),
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values])

  useEffect(() => {
    const t = timers.current
    return () => t.forEach((id) => window.clearTimeout(id))
  }, [])

  if (editable.length === 0) return null
  return (
    <section className="space-y-[8px]" onPointerDownCapture={touch} onKeyDownCapture={touch} onChangeCapture={touch} onBlurCapture={touch}>
      <div className="px-[2px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">{title}</p>
        {hint && <p className="mt-[2px] text-[12px] text-slate-500">{hint}</p>}
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {editable.map((r) => (
          <Row key={r.entry.id} row={r} open={open === r.entry.id} onToggle={() => setOpen((o) => (o === r.entry.id ? null : r.entry.id))} />
        ))}
      </div>
    </section>
  )
}
