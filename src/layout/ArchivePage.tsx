import type { ReactNode } from 'react'
import { SIcon, type SIconName } from '@chargebee/sting-react'
import { unarchiveExperienceNow, unarchivePlayNow } from '../plays/archive'
import { audienceText } from '../plays/resolve'
import { RowMenu } from '../plays/ui'
import { deleteArchivedPlay, usePlays } from '../plays/usePlays'
import { deleteArchivedThread, useWorkspace } from '../workspace/useWorkspace'
import { SHELL_KIND, shellOf } from './experienceKind'
import { ago } from './ThreadSidebar'

function archivedLine(at: number | undefined): string {
  return at ? `Archived ${ago(at).toLowerCase()}` : 'Archived'
}

function Group({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="mt-[28px]">
      <div className="mb-[10px] flex items-center gap-[8px]">
        <h2 className="text-[14px] font-semibold text-slate-900">{title}</h2>
        <span className="text-[13px] tabular-nums text-slate-400">{count}</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">{children}</div>
    </section>
  )
}

function Row({
  icon,
  title,
  meta,
  onRestore,
  onDelete,
}: {
  icon: SIconName
  title: string
  meta: string
  onRestore: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-[12px] border-t border-slate-100 px-[16px] py-[11px] first:border-t-0">
      <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400">
        <SIcon name={icon} size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium text-slate-700">{title}</div>
        <div className="truncate text-[12px] text-slate-500">{meta}</div>
      </div>
      <button
        type="button"
        onClick={onRestore}
        className="flex h-[30px] flex-none items-center gap-[6px] rounded-lg border border-slate-200 bg-white px-[10px] text-[12.5px] font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900"
      >
        <SIcon name="archive-restore" size={13} /> Unarchive
      </button>
      <RowMenu
        label={`More for ${title}`}
        items={[{ label: 'Delete for good', icon: 'trash-2', danger: true, confirm: 'This can’t be undone. Click again', onClick: onDelete }]}
      />
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="px-[16px] py-[16px] text-[13px] text-slate-500">{children}</p>
}

/** v9: plays and experiences put away. Nothing here is shown to subscribers. */
export function ArchivePage() {
  const plays = usePlays((s) => s.archived)
  const threads = useWorkspace((s) => s.archived)
  return (
    <div className="h-full min-w-0 flex-1 overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-[900px] px-[28px] pb-[48px] pt-[22px]">
        <h1 className="text-[20px] font-semibold text-slate-900">Archive</h1>
        <p className="mt-[4px] text-[13px] text-slate-500">
          Plays and experiences you put away. Subscribers don’t see anything here. Unarchive brings them back as drafts.
        </p>

        <Group title="Plays" count={plays.length}>
          {plays.length === 0 && <Empty>No archived plays.</Empty>}
          {plays.map((p) => (
            <Row
              key={p.id}
              icon="list-ordered"
              title={p.name}
              meta={`${audienceText(p.audience)} · ${archivedLine(p.archivedAt)}`}
              onRestore={() => unarchivePlayNow(p)}
              onDelete={() => deleteArchivedPlay(p.id)}
            />
          ))}
        </Group>

        <Group title="Experiences" count={threads.length}>
          {threads.length === 0 && <Empty>No archived experiences.</Empty>}
          {threads.map((t) => (
            <Row
              key={t.id}
              icon={SHELL_KIND[shellOf(t)].icon}
              title={t.title}
              meta={`${SHELL_KIND[shellOf(t)].label} · ${archivedLine(t.archivedAt)}`}
              onRestore={() => unarchiveExperienceNow(t.id, t.title)}
              onDelete={() => deleteArchivedThread(t.id)}
            />
          ))}
        </Group>
      </div>
    </div>
  )
}
