import { useEffect, useState, type DragEvent } from 'react'
import { SIcon } from '@chargebee/sting-react'
import { useOrchestration } from '../store/useOrchestration'
import { createExperience, openConfigure, openExperience, openPlay } from '../plays/navigate'
import {
  addSubAudience,
  addToPlay,
  audienceUnset,
  createPlay,
  deletePlay,
  duplicatePlay,
  moveToPlay,
  playsUsing,
  removeFromPlay,
  renamePlay,
  usePlays,
  useRankedPlays,
} from '../plays/usePlays'
import { variantLetter, type CancelPlay, type PlayVariant } from '../plays/types'
import { audienceText, fallbackVariant, pagesIn, variantShare } from '../plays/resolve'
import { Chip, InlineName, RowMenu, toast, type MenuItem } from '../plays/ui'
import {
  deleteThread,
  duplicateThread,
  orderedThreads,
  renameThread,
  threadIsLive,
  useWorkspace,
  type ExperienceThread,
} from '../workspace/useWorkspace'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'
import { StatusChip } from './StatusChip'
import { copyMarks } from '../setup/useSetupState'
import { separateCopy } from '../plays/ExperienceContext'
import { archiveExperienceItem, archivePlayItem } from '../plays/archive'
import { V9 } from './layoutMode'

const DRAG_TYPE = 'application/x-cancel-experience'

interface DragPayload {
  experienceId: string
  fromPlayId: string | null
  variantId: string | null
}

let dragging: DragPayload | null = null

function startDrag(e: DragEvent, payload: DragPayload) {
  dragging = payload
  e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload))
  e.dataTransfer.setData('text/plain', payload.experienceId)
  e.dataTransfer.effectAllowed = 'copyMove'
}

function threadTitle(id: string): string {
  return useWorkspace.getState().threads.find((t) => t.id === id)?.title ?? 'Experience'
}

function playName(id: string): string {
  return usePlays.getState().plays.find((p) => p.id === id)?.name ?? 'the play'
}

/** Drop a variant on a play: it joins that play too. Hold Option to move it instead. */
function dropOn(playId: string, e: DragEvent) {
  const raw = e.dataTransfer.getData(DRAG_TYPE)
  const payload = raw ? (JSON.parse(raw) as DragPayload) : dragging
  dragging = null
  if (!payload) return
  const name = threadTitle(payload.experienceId)
  if (e.altKey && payload.fromPlayId && payload.variantId) {
    if (moveToPlay(payload.fromPlayId, payload.variantId, playId)) toast(`Moved ${name} to ${playName(playId)}`)
    else toast(`${name} is already in ${playName(playId)}`)
    return
  }
  if (addToPlay(playId, payload.experienceId)) {
    toast(payload.fromPlayId ? `${name} is now in ${playName(playId)} too` : `Added ${name} to ${playName(playId)}`)
  } else toast(`${name} is already in ${playName(playId)}`)
}

function duplicateInto(experienceId: string, playId: string | null, at?: number) {
  const copy = duplicateThread(experienceId)
  if (!copy) return
  copyMarks(experienceId, copy)
  if (playId) addToPlay(playId, copy, at)
  useWorkspaceUi.getState().setRenaming(copy)
  toast(`Copied. Give the copy its own name.`)
}

function addToOtherPlays(experienceId: string, exceptPlayId: string | null): MenuItem[] {
  return usePlays
    .getState()
    .plays.filter((p) => p.id !== exceptPlayId)
    .map((p) => {
      const already = p.variants.some((v) => v.experienceId === experienceId)
      return {
        label: p.name,
        icon: 'folder-input' as const,
        disabled: already,
        hint: already ? 'Already in this play' : undefined,
        onClick: () => {
          if (addToPlay(p.id, experienceId)) toast(`${threadTitle(experienceId)} is now in ${p.name} too`)
        },
      }
    })
}

function moveToOtherPlays(fromPlayId: string, v: PlayVariant): MenuItem[] {
  return usePlays
    .getState()
    .plays.filter((p) => p.id !== fromPlayId)
    .map((p) => {
      const already = p.variants.some((x) => x.experienceId === v.experienceId)
      return {
        label: p.name,
        icon: 'move' as const,
        disabled: already,
        hint: already ? 'Already in this play' : undefined,
        onClick: () => {
          if (moveToPlay(fromPlayId, v.id, p.id)) toast(`Moved ${threadTitle(v.experienceId)} to ${p.name}`)
        },
      }
    })
}

function deleteExperienceItem(experienceId: string): MenuItem {
  const n = playsUsing(experienceId).length
  return {
    label: 'Delete experience',
    icon: 'trash-2',
    danger: true,
    confirm: n > 0 ? `Delete it from ${n} play${n === 1 ? '' : 's'} too?` : 'Click again to delete',
    onClick: () => {
      const name = threadTitle(experienceId)
      deleteThread(experienceId)
      toast(`Deleted ${name}`)
    },
  }
}

function VariantRow({ play, v, index, current }: { play: CancelPlay; v: PlayVariant; index: number; current: boolean }) {
  const thread = useWorkspace((s) => s.threads.find((t) => t.id === v.experienceId))
  const renaming = useWorkspaceUi((s) => s.renaming === v.experienceId)
  const dirty = useOrchestration((s) => s.dirty)
  const activeLive = useOrchestration((s) => s.play.publishState === 'live')
  const activeId = useWorkspace((s) => s.activeId)
  const shared = usePlays((s) => s.plays.filter((p) => p.variants.some((x) => x.experienceId === v.experienceId)).length)
  if (!thread) return null
  const items: MenuItem[] = [
    { label: 'Rename', icon: 'pencil', onClick: () => useWorkspaceUi.getState().setRenaming(v.experienceId) },
    { label: 'Duplicate', icon: 'copy', hint: 'A separate copy under this play', onClick: () => duplicateInto(v.experienceId, play.id, index + 1) },
    ...(shared > 1
      ? [{ label: `Own copy for ${play.name}`, icon: 'git-branch' as const, hint: 'Edits here stop reaching the other plays', onClick: () => separateCopy(v.experienceId, play.id) }]
      : []),
    { label: 'Add to another play…', icon: 'folder-input', items: addToOtherPlays(v.experienceId, play.id) },
    { label: 'Move to another play…', icon: 'move', items: moveToOtherPlays(play.id, v) },
    {
      label: 'Remove from this play',
      icon: 'circle-slash',
      onClick: () => {
        removeFromPlay(play.id, v.id)
        toast(`Removed ${thread.title} from ${play.name}`)
      },
    },
    ...(V9 ? [archiveExperienceItem(v.experienceId)] : []),
    deleteExperienceItem(v.experienceId),
  ]
  return (
    <div
      draggable={!renaming}
      onDragStart={(e) => startDrag(e, { experienceId: v.experienceId, fromPlayId: play.id, variantId: v.id })}
      onClick={() => openExperience(v.experienceId, play.id)}
      aria-current={current ? 'true' : undefined}
      title={`Variant ${variantLetter(index)}, ${variantShare(play, v)}`}
      className={`group flex h-8 cursor-pointer items-center gap-[6px] rounded-lg pl-[8px] pr-[4px] transition-colors ${
        current ? 'bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-slate-200' : 'hover:bg-slate-200/50'
      }`}
    >
      <InlineName
        value={thread.title}
        editing={renaming}
        onStart={() => useWorkspaceUi.getState().setRenaming(v.experienceId)}
        onDone={() => useWorkspaceUi.getState().setRenaming(null)}
        onCommit={(name) => renameThread(v.experienceId, name)}
        className={`flex-1 text-[12.5px] ${current ? 'font-semibold text-slate-900' : 'text-slate-700'}`}
      />
      {!renaming && (
        <>
          {shared > 1 && (
            <span className="hidden flex-none group-hover:inline-flex">
              <Chip tone="indigo" title={`Used in ${shared} plays. Edits show in all of them.`}>
                {shared} plays
              </Chip>
            </span>
          )}
          {current && dirty ? (
            <span className="flex-none text-[11px] text-slate-400 group-hover:hidden">Unsaved</span>
          ) : (
            <span className="flex-none group-hover:hidden">
              <StatusChip live={threadIsLive(thread, activeId, activeLive)} />
            </span>
          )}
          <RowMenu label={`Actions for ${thread.title}`} items={items} className="hidden group-hover:block" />
        </>
      )}
    </div>
  )
}

function AddVariant({ play }: { play: CancelPlay }) {
  const threads = useWorkspace((s) => s.threads)
  const existing = orderedThreads(threads)
    .filter((t) => !play.variants.some((v) => v.experienceId === t.id))
    .map<MenuItem>((t) => ({
      label: t.title,
      icon: 'corner-down-right',
      onClick: () => {
        addToPlay(play.id, t.id)
        toast(`Added ${t.title} to ${play.name}`)
      },
    }))
  return (
    <RowMenu
      label={`Add a variant to ${play.name}`}
      icon="plus"
      align="left"
      width={240}
      className="ml-[2px]"
      items={[
        { label: 'New experience', icon: 'plus', hint: 'Start a fresh cancel experience', onClick: () => createExperience({ playId: play.id }) },
        { label: 'Use an existing one…', icon: 'corner-down-right', items: existing },
      ]}
    />
  )
}

export function PlayRow({ play, open, onToggle }: { play: CancelPlay; open: boolean; onToggle: () => void }) {
  const page = useWorkspaceUi((s) => s.page)
  const playId = useWorkspaceUi((s) => s.playId)
  const activeId = useWorkspace((s) => s.activeId)
  const renaming = useWorkspaceUi((s) => s.renaming === play.id)
  const [over, setOver] = useState(false)
  const current = page === 'play' && playId === play.id
  const variantRow = (v: PlayVariant) => (
    <VariantRow
      key={v.id}
      play={play}
      v={v}
      index={play.variants.indexOf(v)}
      current={page === 'thread' && playId === play.id && activeId === v.experienceId}
    />
  )
  const items: MenuItem[] = [
    { label: 'Rename', icon: 'pencil', onClick: () => useWorkspaceUi.getState().setRenaming(play.id) },
    {
      label: 'Duplicate',
      icon: 'copy',
      hint: 'Same audience and variants, as a draft',
      onClick: () => {
        const id = duplicatePlay(play.id)
        if (id) useWorkspaceUi.getState().setRenaming(id)
      },
    },
    { label: 'New experience in this play', icon: 'plus', onClick: () => createExperience({ playId: play.id }) },
    ...(V9 ? [archivePlayItem(play)] : []),
    {
      label: 'Delete play',
      icon: 'trash-2',
      danger: true,
      confirm: 'Delete the play? Experiences stay.',
      onClick: () => {
        deletePlay(play.id)
        if (current) useWorkspaceUi.getState().setPage('index')
        toast(`Deleted ${play.name}. Its experiences are still in the list.`)
      },
    },
  ]
  return (
    <div className="group/play">
      <div
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = e.altKey ? 'move' : 'copy'
          if (!over) setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          dropOn(play.id, e)
          if (!open) onToggle()
        }}
        onClick={() => {
          openPlay(play.id)
          if (!open) onToggle()
        }}
        aria-current={current ? 'true' : undefined}
        className={`group relative flex h-8 cursor-pointer items-center gap-[2px] rounded-lg pr-[4px] transition-colors ${
          over ? 'bg-indigo-50 ring-2 ring-indigo-300' : current ? 'bg-slate-200/70' : 'hover:bg-slate-200/50'
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          aria-label={open ? `Collapse ${play.name}` : `Expand ${play.name}`}
          aria-expanded={open}
          className="flex h-8 w-6 flex-none items-center justify-center text-slate-400 hover:text-slate-700"
        >
          <SIcon name="chevron-right" size={13} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        </button>
        <InlineName
          value={play.name}
          editing={renaming}
          onStart={() => useWorkspaceUi.getState().setRenaming(play.id)}
          onDone={() => useWorkspaceUi.getState().setRenaming(null)}
          onCommit={(name) => renamePlay(play.id, name)}
          className={`flex-1 text-[13px] ${current ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'}`}
        />
        {over ? (
          <span className="flex-none pr-[4px] text-[11px] font-medium text-indigo-600">Drop to add · ⌥ to move</span>
        ) : (
          !renaming && (
            <>
              <span className="flex-none group-hover:hidden">
                <StatusChip live={play.status === 'live'} />
              </span>
              <RowMenu label={`Actions for ${play.name}`} items={items} className="hidden group-hover:block" />
            </>
          )
        )}
      </div>
      {open && (
        <div className="ml-[15px] flex flex-col gap-[1px] border-l border-slate-200 py-[2px] pl-[6px]">
          <TreeLabel
            icon="users"
            muted
            title="Audience. Opens Configure."
            onClick={() => openConfigure(play.id, 1)}
          >
            {play.audience.targetAll ? 'All subscribers' : audienceUnset(play.audience) ? 'No audience yet' : audienceText(play.audience)}
          </TreeLabel>
          {play.splitBy === 'segments' ? (
            <>
              {play.subAudiences.map((x, n) => (
                <div key={x.id}>
                  <TreeLabel icon="users-round" title="Sub-audience. Opens Configure." onClick={() => openConfigure(play.id, 2)}>
                    {audienceUnset(x.audience) ? `Sub-audience ${n + 1}` : audienceText(x.audience)}
                  </TreeLabel>
                  <Nested>
                    {pagesIn(play, x.id).map((v) => variantRow(v))}
                    {pagesIn(play, x.id).length === 0 && <EmptyLine />}
                  </Nested>
                </div>
              ))}
              <div>
                <TreeLabel icon="shield" title="For people in no sub-audience. Opens Configure." onClick={() => openConfigure(play.id, 2)}>
                  Fallback
                </TreeLabel>
                <Nested>{fallbackVariant(play) ? variantRow(fallbackVariant(play)!) : <EmptyLine />}</Nested>
              </div>
            </>
          ) : (
            play.variants.map((v) => variantRow(v))
          )}
          <div
            className={`flex items-center ${play.variants.length === 0 ? '' : 'invisible group-hover/play:visible group-focus-within/play:visible'}`}
          >
            {play.splitBy === 'segments' ? (
              <button
                type="button"
                onClick={() => {
                  addSubAudience(play.id)
                  openConfigure(play.id, 2)
                }}
                className="ml-[2px] flex h-6 items-center gap-[4px] rounded-md pl-[5px] pr-[6px] text-[11.5px] text-slate-400 hover:bg-white hover:text-slate-800"
              >
                <SIcon name="plus" size={13} /> Add sub-audience
              </button>
            ) : (
              <>
                <AddVariant play={play} />
                <span className="pl-[4px] text-[11.5px] text-slate-400">Add variant</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** A non-page line in a play's tree: its audience, a sub-audience, or the fallback. */
function TreeLabel({ icon, children, title, muted, onClick }: { icon: 'users' | 'users-round' | 'shield'; children: React.ReactNode; title: string; muted?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-7 w-full min-w-0 items-center gap-[6px] rounded-lg pl-[8px] pr-[4px] text-left text-[12px] hover:bg-slate-200/50 ${muted ? 'text-slate-400' : 'font-medium text-slate-600'}`}
    >
      <SIcon name={icon} size={12} className="flex-none opacity-80" />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  )
}

function Nested({ children }: { children: React.ReactNode }) {
  return <div className="ml-[13px] flex flex-col gap-[1px] border-l border-slate-200 pl-[6px]">{children}</div>
}

function EmptyLine() {
  return <p className="flex h-7 items-center pl-[8px] text-[11.5px] text-slate-400">No page yet</p>
}

export function LooseRow({ thread, current }: { thread: ExperienceThread; current: boolean }) {
  const renaming = useWorkspaceUi((s) => s.renaming === thread.id)
  const dirty = useOrchestration((s) => s.dirty)
  const activeLive = useOrchestration((s) => s.play.publishState === 'live')
  const activeId = useWorkspace((s) => s.activeId)
  const items: MenuItem[] = [
    { label: 'Rename', icon: 'pencil', onClick: () => useWorkspaceUi.getState().setRenaming(thread.id) },
    { label: 'Duplicate', icon: 'copy', onClick: () => duplicateInto(thread.id, null) },
    { label: 'Add to a play…', icon: 'folder-input', items: addToOtherPlays(thread.id, null) },
    ...(V9 ? [archiveExperienceItem(thread.id)] : []),
    deleteExperienceItem(thread.id),
  ]
  return (
    <div
      draggable={!renaming}
      onDragStart={(e) => startDrag(e, { experienceId: thread.id, fromPlayId: null, variantId: null })}
      onClick={() => openExperience(thread.id, null)}
      aria-current={current ? 'true' : undefined}
      className={`group flex h-8 cursor-pointer items-center gap-[6px] rounded-lg pl-[10px] pr-[4px] transition-colors ${
        current ? 'bg-slate-200/60' : 'hover:bg-slate-200/50'
      }`}
    >
      <InlineName
        value={thread.title}
        editing={renaming}
        onStart={() => useWorkspaceUi.getState().setRenaming(thread.id)}
        onDone={() => useWorkspaceUi.getState().setRenaming(null)}
        onCommit={(name) => renameThread(thread.id, name)}
        className={`flex-1 text-[12.5px] ${current ? 'font-semibold text-slate-900' : 'text-slate-700'}`}
      />
      {!renaming && (
        <>
          {current && dirty ? (
            <span className="flex-none text-[11px] text-slate-400 group-hover:hidden">Unsaved</span>
          ) : (
            <span className="flex-none group-hover:hidden">
              <StatusChip live={threadIsLive(thread, activeId, activeLive)} />
            </span>
          )}
          <RowMenu label={`Actions for ${thread.title}`} items={items} className="hidden group-hover:block" />
        </>
      )}
    </div>
  )
}

function SectionHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex h-7 items-center px-[10px]">
      <span className="min-w-0 flex-1 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">{title}</span>
      {action}
    </div>
  )
}

/** v8 side pane body: plays with their variants, then experiences not in any play. */
export function PlaysTree() {
  const plays = useRankedPlays()
  const threads = useWorkspace((s) => s.threads)
  const activeId = useWorkspace((s) => s.activeId)
  const page = useWorkspaceUi((s) => s.page)
  const playId = useWorkspaceUi((s) => s.playId)
  const templatesOpen = useOrchestration((s) => s.templatesOpen)
  const [folded, setFolded] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (playId && folded.has(playId)) setFolded((s) => {
      const next = new Set(s)
      next.delete(playId)
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playId])

  const inAPlay = new Set(plays.flatMap((p) => p.variants.map((v) => v.experienceId)))
  const loose = orderedThreads(threads).filter((t) => !inAPlay.has(t.id))
  const toggle = (id: string) =>
    setFolded((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="flex flex-col gap-[12px]">
      <div>
        <SectionHead
          title="Plays"
          action={
            <button
              type="button"
              title="New play"
              aria-label="New play"
              onClick={() => {
                const id = createPlay()
                openPlay(id)
                useWorkspaceUi.getState().setRenaming(id)
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-slate-900"
            >
              <SIcon name="plus" size={13} />
            </button>
          }
        />
        <div className="flex flex-col gap-[2px]">
          {plays.map((p) => (
            <PlayRow key={p.id} play={p} open={!folded.has(p.id)} onToggle={() => toggle(p.id)} />
          ))}
          {plays.length === 0 && <p className="px-[10px] py-[4px] text-[12px] text-slate-400">No plays yet.</p>}
        </div>
      </div>
      {loose.length > 0 && (
        <div className="border-t border-slate-200 pt-[12px]">
          <SectionHead title="Not in a play" />
          <div className="flex flex-col gap-[2px]">
            {loose.map((t) => (
              <LooseRow
                key={t.id}
                thread={t}
                current={page === 'thread' && !templatesOpen && t.id === activeId && (!playId || !inAPlay.has(t.id))}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
