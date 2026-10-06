import type { ReactNode } from 'react'
import { SIcon, type SIconName } from '@chargebee/sting-react'
import { unarchiveExperienceNow, unarchivePlayNow } from '../plays/archive'
import { audienceText } from '../plays/resolve'
import { RowMenu } from '../plays/ui'
import { deleteArchivedPlay, usePlays } from '../plays/usePlays'
import { deleteArchivedThread, useWorkspace } from '../workspace/useWorkspace'
import { SHELL_KIND, shellOf } from './experienceKind'
import { PageHeader } from './SlgChrome'
import { Ago, initials, RowMark, TABLE_ROW, TableEmpty, TableHead } from './SlgTable'

const ARCHIVE_COLS = 'grid grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_110px_120px] items-center gap-[16px]'

function Group({ title, count, detail, children }: { title: string; count: number; detail: string; children: ReactNode }) {
  return (
    <section className="mt-[28px]">
      <div className="mb-[10px] flex items-center gap-[8px]">
        <h2 className="text-[14px] font-semibold text-slate-900">{title}</h2>
        <span className="text-[13px] tabular-nums text-slate-400">{count}</span>
      </div>
      <TableHead cols={ARCHIVE_COLS}>
        <span>Name</span>
        <span>{detail}</span>
        <span>Archived</span>
        <span />
      </TableHead>
      {children}
    </section>
  )
}

function Row({
  icon,
  title,
  detail,
  at,
  onRestore,
  onDelete,
}: {
  icon: SIconName
  title: string
  detail: string
  at: number | undefined
  onRestore: () => void
  onDelete: () => void
}) {
  return (
    <div className={`${ARCHIVE_COLS} ${TABLE_ROW}`}>
      <div className="flex min-w-0 items-center gap-[10px]">
        <RowMark>{initials(title)}</RowMark>
        <span className="truncate">{title}</span>
      </div>
      <span className="flex min-w-0 items-center gap-[6px]">
        <SIcon name={icon} size={12} className="flex-none text-slate-500" />
        <span className="truncate">{detail}</span>
      </span>
      {at ? <Ago at={at} /> : <span className="text-slate-500">Unknown</span>}
      <div className="flex items-center justify-end gap-[2px]">
        <button
          type="button"
          onClick={onRestore}
          className="inline-flex h-[28px] flex-none items-center gap-[6px] px-[8px] text-[12px] font-medium hover:bg-[var(--slg-color-bg-surface-muted)]"
        >
          <SIcon name="archive-restore" size={13} /> Unarchive
        </button>
        <RowMenu
          label={`More for ${title}`}
          icon="more-vertical"
          items={[{ label: 'Delete for good', icon: 'trash-2', danger: true, confirm: 'This can’t be undone. Click again', onClick: onDelete }]}
        />
      </div>
    </div>
  )
}

/** v9: plays and experiences put away. Nothing here is shown to subscribers. */
export function ArchivePage() {
  const plays = usePlays((s) => s.archived)
  const threads = useWorkspace((s) => s.archived)
  return (
    <div className="h-full min-w-0 flex-1 overflow-y-auto bg-white">
      <div className="mx-auto max-w-[900px] px-[28px] pb-[48px] pt-[22px]">
        <PageHeader
          title="Archive"
          meta={[`${plays.length} play${plays.length === 1 ? '' : 's'}`, `${threads.length} experience${threads.length === 1 ? '' : 's'}`]}
        />
        <p className="mt-[12px] text-[13px] text-slate-500">
          Plays and experiences you put away. Subscribers don’t see anything here. Unarchive brings them back as drafts.
        </p>

        <Group title="Plays" count={plays.length} detail="Audience">
          {plays.length === 0 && <TableEmpty>No archived plays.</TableEmpty>}
          {plays.map((p) => (
            <Row
              key={p.id}
              icon="users"
              title={p.name}
              detail={audienceText(p.audience)}
              at={p.archivedAt}
              onRestore={() => unarchivePlayNow(p)}
              onDelete={() => deleteArchivedPlay(p.id)}
            />
          ))}
        </Group>

        <Group title="Experiences" count={threads.length} detail="Type">
          {threads.length === 0 && <TableEmpty>No archived experiences.</TableEmpty>}
          {threads.map((t) => (
            <Row
              key={t.id}
              icon={SHELL_KIND[shellOf(t)].icon}
              title={t.title}
              detail={SHELL_KIND[shellOf(t)].label}
              at={t.archivedAt}
              onRestore={() => unarchiveExperienceNow(t.id, t.title)}
              onDelete={() => deleteArchivedThread(t.id)}
            />
          ))}
        </Group>
      </div>
    </div>
  )
}
