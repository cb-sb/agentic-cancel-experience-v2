import { useEffect, useRef, useState } from 'react'
import { SIcon, type SIconName } from '@chargebee/sting-react'
import { DEFAULT_JOURNEY_BRAND } from '../../journey/types'
import { StatusChip } from '../../layout/StatusChip'
import { variantShare } from '../../plays/resolve'
import { variantLetter } from '../../plays/types'
import { InlineName, RowMenu, toast, type MenuItem } from '../../plays/ui'
import { useWorkspace } from '../../workspace/useWorkspace'
import { useWorkspaceUi } from '../../workspace/useWorkspaceUi'
import { objectiveLabel, TYPE_LABEL, type GrowthExperience, type GrowthObjective } from '../model'
import {
  duplicateGrowthExperience,
  experiencesFor,
  removeGrowthExperience,
  renameGrowthExperience,
  useGrowthExperiences,
} from '../useGrowthExperiences'
import {
  addToGrowthPlay,
  createGrowthPlay,
  deleteGrowthPlay,
  dropGrowthExperience,
  duplicateGrowthPlay,
  experienceTabs,
  growthExperienceLive,
  growthPlaysUsing,
  removeFromGrowthPlay,
  renameGrowthPlay,
  useGrowthPlays,
  useRankedGrowthPlays,
  type GrowthPlay,
} from '../useGrowthPlays'
import { existingExperienceItems, experienceName, newExperienceItems } from './actions'
import { SOON, type SoonPlace } from '../Soon'
import { SEARCH_ID } from './ExperiencesPage'
import { ObjectivePaneShell, PaneSection, type PaneRowSpec } from './ObjectivePaneShell'
import { otherObjective, SharedMark } from './ui'
import { goGrowth, openGrowthExperience, openGrowthPlay, setRenaming, useGrowthUi, useGrowthView } from './useGrowthUi'

export function HeaderButton({ label, icon, onClick }: { label: string; icon: 'search' | 'panel-left'; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/60 hover:text-slate-900"
    >
      <SIcon name={icon} size={16} />
    </button>
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

function addToPlayItems(objective: GrowthObjective, experienceId: string, exceptPlayId: string | null): MenuItem[] {
  return useGrowthPlays
    .getState()
    .plays.filter((p) => p.objective === objective && p.id !== exceptPlayId)
    .map((p) => {
      const already = p.variants.some((v) => v.experienceId === experienceId)
      return {
        label: p.name,
        icon: 'folder-input' as const,
        disabled: already,
        hint: already ? 'Already in this play' : undefined,
        onClick: () => {
          if (addToGrowthPlay(p.id, experienceId)) toast(`${experienceName(experienceId)} is now in ${p.name}`)
        },
      }
    })
}

/** Shares the same experience with the other tab's plays. */
function addToOtherTabItem(objective: GrowthObjective, experienceId: string): MenuItem {
  const other = otherObjective(objective)
  const plays = useGrowthPlays.getState().plays.filter((p) => p.objective === other)
  return {
    label: `Add to an ${objectiveLabel(other)} play…`,
    icon: 'link',
    items: plays.length
      ? plays.map((p) => {
          const already = p.variants.some((v) => v.experienceId === experienceId)
          return {
            label: p.name,
            icon: 'folder-input' as const,
            disabled: already,
            hint: already ? 'Already in this play' : 'Same experience, shared',
            onClick: () => {
              if (addToGrowthPlay(p.id, experienceId)) toast(`${experienceName(experienceId)} is now also in ${p.name}, in ${objectiveLabel(other)}`)
            },
          }
        })
      : [{ label: `No ${objectiveLabel(other)} plays yet`, disabled: true }],
  }
}

/** A separate copy that lives in the other tab. */
function duplicateToOtherTabItem(objective: GrowthObjective, experienceId: string): MenuItem {
  const other = otherObjective(objective)
  const copyInto = (playId: string | null) => {
    const copy = duplicateGrowthExperience(experienceId, other)
    if (!copy) return
    const play = playId ? useGrowthPlays.getState().plays.find((p) => p.id === playId) : undefined
    if (play) addToGrowthPlay(play.id, copy.id)
    toast(`Copied to ${objectiveLabel(other)} as ${copy.name}${play ? `, in ${play.name}` : ''}`)
  }
  return {
    label: `Duplicate to ${objectiveLabel(other)}…`,
    icon: 'copy',
    items: [
      { label: 'Not in a play', icon: 'circle-dashed', hint: 'A separate copy', onClick: () => copyInto(null) },
      ...useGrowthPlays
        .getState()
        .plays.filter((p) => p.objective === other)
        .map((p) => ({ label: p.name, icon: 'folder-input' as const, hint: 'A separate copy in this play', onClick: () => copyInto(p.id) })),
    ],
  }
}

function deleteExperienceItem(objective: GrowthObjective, experienceId: string): MenuItem {
  const n = growthPlaysUsing(experienceId).length
  const tabs = experienceTabs(experienceId)
  const where = tabs.length > 1 ? ` in ${tabs.map(objectiveLabel).join(' and ')}` : ''
  return {
    label: 'Delete experience',
    icon: 'trash-2',
    danger: true,
    confirm: n > 0 ? `Delete it from ${n} play${n === 1 ? '' : 's'}${where} too?` : 'Click again to delete',
    onClick: () => {
      const name = experienceName(experienceId)
      dropGrowthExperience(experienceId)
      removeGrowthExperience(experienceId)
      const view = useGrowthUi.getState().views[objective]
      if (view.page === 'experience' && view.experienceId === experienceId) goGrowth(objective, { page: 'index', experienceId: null })
      toast(`Deleted ${name}`)
    },
  }
}

function duplicateItem(objective: GrowthObjective, experienceId: string, playId: string | null): MenuItem {
  return {
    label: 'Duplicate',
    icon: 'copy',
    hint: playId ? 'A separate copy under this play' : undefined,
    onClick: () => {
      const copy = duplicateGrowthExperience(experienceId)
      if (!copy) return
      if (playId) addToGrowthPlay(playId, copy.id)
      openGrowthExperience(objective, copy.id, playId)
      setRenaming(copy.id)
    },
  }
}

function ExperienceName({ x, current, className }: { x: GrowthExperience; current: boolean; className: string }) {
  const renaming = useGrowthUi((s) => s.renaming === x.id)
  return (
    <InlineName
      value={x.name}
      editing={renaming}
      onStart={() => setRenaming(x.id)}
      onDone={() => setRenaming(null)}
      onCommit={(name) => renameGrowthExperience(x.id, name)}
      className={`flex-1 text-[12.5px] ${current ? 'font-semibold text-slate-900' : 'text-slate-700'} ${className}`}
    />
  )
}

function VariantRow({ play, index, current }: { play: GrowthPlay; index: number; current: boolean }) {
  const v = play.variants[index]
  const x = useGrowthExperiences((s) => s.items.find((i) => i.id === v.experienceId))
  const renaming = useGrowthUi((s) => s.renaming === v.experienceId)
  const plays = useGrowthPlays((s) => s.plays)
  if (!x) return null
  const items: MenuItem[] = [
    { label: 'Rename', icon: 'pencil', onClick: () => setRenaming(x.id) },
    duplicateItem(play.objective, x.id, play.id),
    duplicateToOtherTabItem(play.objective, x.id),
    { label: 'Add to another play…', icon: 'folder-input', items: addToPlayItems(play.objective, x.id, play.id) },
    addToOtherTabItem(play.objective, x.id),
    {
      label: 'Remove from this play',
      icon: 'circle-slash',
      onClick: () => {
        removeFromGrowthPlay(play.id, v.id)
        toast(`Removed ${x.name} from ${play.name}`)
      },
    },
    deleteExperienceItem(play.objective, x.id),
  ]
  return (
    <div
      onClick={() => openGrowthExperience(play.objective, x.id, play.id)}
      aria-current={current ? 'true' : undefined}
      title={`Variant ${variantLetter(index)}, ${variantShare(play, v)}`}
      className={`group flex h-8 cursor-pointer items-center gap-[6px] rounded-lg pl-[8px] pr-[4px] transition-colors ${
        current ? 'bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-slate-200' : 'hover:bg-slate-200/50'
      }`}
    >
      <ExperienceName x={x} current={current} className="" />
      {!renaming && <SharedMark objective={play.objective} experienceId={x.id} />}
      {!renaming && (
        <>
          <span className="flex-none group-hover:hidden">
            <StatusChip live={growthExperienceLive(x.id, plays)} />
          </span>
          <RowMenu label={`Actions for ${x.name}`} items={items} className="hidden group-hover:block" />
        </>
      )}
    </div>
  )
}

function AddVariant({ play }: { play: GrowthPlay }) {
  const items = useGrowthExperiences((s) => s.items)
  const plays = useGrowthPlays((s) => s.plays)
  const existing = existingExperienceItems(play, items, plays)
  return (
    <RowMenu
      label={`Add a variant to ${play.name}`}
      icon="plus"
      align="left"
      width={250}
      className="ml-[2px]"
      items={[...newExperienceItems(play.objective, play.id).map((i) => ({ ...i, label: `New ${i.label.toLowerCase()}` })), { label: 'Use an existing one…', icon: 'corner-down-right', items: existing }]}
    />
  )
}

function PlayRow({ play, open, onToggle }: { play: GrowthPlay; open: boolean; onToggle: () => void }) {
  const view = useGrowthView(play.objective)
  const renaming = useGrowthUi((s) => s.renaming === play.id)
  const current = view.page === 'play' && view.playId === play.id
  const items: MenuItem[] = [
    { label: 'Rename', icon: 'pencil', onClick: () => setRenaming(play.id) },
    {
      label: 'Duplicate',
      icon: 'copy',
      hint: 'Same audience and variants, as a draft',
      onClick: () => {
        const id = duplicateGrowthPlay(play.id)
        if (id) setRenaming(id)
      },
    },
    { label: 'New experience in this play…', icon: 'plus', items: newExperienceItems(play.objective, play.id) },
    {
      label: 'Delete play',
      icon: 'trash-2',
      danger: true,
      confirm: 'Delete the play? Experiences stay.',
      onClick: () => {
        deleteGrowthPlay(play.id)
        if (current) goGrowth(play.objective, { page: 'index', playId: null })
        toast(`Deleted ${play.name}. Its experiences are still in the list.`)
      },
    },
  ]
  return (
    <div className="group/play">
      <div
        onClick={() => {
          openGrowthPlay(play.objective, play.id)
          if (!open) onToggle()
        }}
        aria-current={current ? 'true' : undefined}
        className={`group relative flex h-8 cursor-pointer items-center gap-[2px] rounded-lg pr-[4px] transition-colors ${
          current ? 'bg-slate-200/70' : 'hover:bg-slate-200/50'
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
          onStart={() => setRenaming(play.id)}
          onDone={() => setRenaming(null)}
          onCommit={(name) => renameGrowthPlay(play.id, name)}
          className={`flex-1 text-[13px] ${current ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'}`}
        />
        {!renaming && (
          <>
            <span className="flex-none group-hover:hidden">
              <StatusChip live={play.status === 'live'} />
            </span>
            <RowMenu label={`Actions for ${play.name}`} items={items} className="hidden group-hover:block" />
          </>
        )}
      </div>
      {open && (
        <div className="ml-[15px] flex flex-col gap-[1px] border-l border-slate-200 py-[2px] pl-[6px]">
          {play.variants.map((v, i) => (
            <VariantRow
              key={v.id}
              play={play}
              index={i}
              current={view.page === 'experience' && view.playId === play.id && view.experienceId === v.experienceId}
            />
          ))}
          <div className={`flex items-center ${play.variants.length === 0 ? '' : 'invisible group-hover/play:visible group-focus-within/play:visible'}`}>
            <AddVariant play={play} />
            <span className="pl-[4px] text-[11.5px] text-slate-400">Add variant</span>
          </div>
        </div>
      )}
    </div>
  )
}

function LooseRow({ x, current }: { x: GrowthExperience; current: boolean }) {
  const renaming = useGrowthUi((s) => s.renaming === x.id)
  const items: MenuItem[] = [
    { label: 'Rename', icon: 'pencil', onClick: () => setRenaming(x.id) },
    duplicateItem(x.objective, x.id, null),
    duplicateToOtherTabItem(x.objective, x.id),
    { label: 'Add to a play…', icon: 'folder-input', items: addToPlayItems(x.objective, x.id, null) },
    addToOtherTabItem(x.objective, x.id),
    deleteExperienceItem(x.objective, x.id),
  ]
  return (
    <div
      onClick={() => openGrowthExperience(x.objective, x.id, null)}
      aria-current={current ? 'true' : undefined}
      className={`group flex h-8 cursor-pointer items-center gap-[6px] rounded-lg pl-[10px] pr-[4px] transition-colors ${
        current ? 'bg-slate-200/60' : 'hover:bg-slate-200/50'
      }`}
    >
      <ExperienceName x={x} current={current} className="" />
      {!renaming && (
        <>
          <span className="flex-none text-[11px] text-slate-400 group-hover:hidden">{TYPE_LABEL[x.type]}</span>
          <RowMenu label={`Actions for ${x.name}`} items={items} className="hidden group-hover:block" />
        </>
      )}
    </div>
  )
}

export function PlaysTree({ objective }: { objective: GrowthObjective }) {
  const plays = useRankedGrowthPlays(objective)
  const allPlays = useGrowthPlays((s) => s.plays)
  const items = useGrowthExperiences((s) => s.items)
  const view = useGrowthView(objective)
  const [folded, setFolded] = useState<Set<string>>(new Set())

  useEffect(() => {
    const id = view.playId
    if (id && folded.has(id))
      setFolded((s) => {
        const next = new Set(s)
        next.delete(id)
        return next
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.playId])

  const inAPlay = new Set(allPlays.flatMap((p) => p.variants.map((v) => v.experienceId)))
  const loose = experiencesFor(items, allPlays, objective).filter((x) => !inAPlay.has(x.id))
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
                const id = createGrowthPlay(objective)
                openGrowthPlay(objective, id)
                setRenaming(id)
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
            {loose.map((x) => (
              <LooseRow key={x.id} x={x} current={view.page === 'experience' && view.experienceId === x.id && !view.playId} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function BrandPopover({ objective, onClose }: { objective: GrowthObjective; onClose: () => void }) {
  const brand = useWorkspace((s) => s.brand) ?? DEFAULT_JOURNEY_BRAND
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [onClose])
  return (
    <div
      ref={ref}
      className="absolute left-full top-0 z-40 ml-2 w-[260px] rounded-xl border border-slate-200 bg-white p-[14px] shadow-[0_12px_40px_rgba(15,23,42,0.16)]"
    >
      <p className="text-[13px] font-semibold text-slate-900">Brand</p>
      <p className="mt-[2px] text-[12px] leading-snug text-slate-500">Offers and pricing tables use this look unless one sets its own colour.</p>
      <div className="mt-[12px] flex items-center gap-[10px]">
        <span className="h-8 w-8 flex-none border border-slate-200" style={{ background: brand.primary, borderRadius: Math.min(brand.corners, 16) }} aria-hidden />
        <div className="min-w-0 text-[12px] text-slate-600">
          <p className="font-mono">{brand.primary}</p>
          <p>{brand.matched ? 'Matched to your site' : 'Not matched to your site yet'}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          goGrowth(objective, { page: 'brand' })
          onClose()
        }}
        className="mt-[12px] w-full rounded-lg bg-slate-900 px-[10px] py-[7px] text-[12.5px] font-semibold text-white hover:bg-slate-800"
      >
        Edit brand
      </button>
    </div>
  )
}

type PartRow = { page: 'templates' | 'pricing_tables'; label: string; icon: SIconName } | { soon: SoonPlace }

const TEMPLATES_ROW: PartRow = { page: 'templates', label: 'Templates', icon: 'layout-template' }
const PRICING_ROW: PartRow = { page: 'pricing_tables', label: 'Pricing tables', icon: 'table' }

/** What each objective's experiences are made of. The soon rows are placeholders. */
const EXPERIENCE_PARTS: Record<GrowthObjective, PartRow[]> = {
  acquisition: [TEMPLATES_ROW, { soon: SOON.checkout }, PRICING_ROW, { soon: SOON.notifications }],
  expansion: [TEMPLATES_ROW, { soon: SOON.portal }, { soon: SOON.planChanges }, PRICING_ROW, { soon: SOON.notifications }],
}

/** Acquisition or Expansion's own pane, beside the Growth nav, laid out like Retention's. */
export function GrowthPane({ objective }: { objective: GrowthObjective }) {
  const open = useWorkspaceUi((s) => s.sidebarOpen)
  const setOpen = useWorkspaceUi((s) => s.setSidebarOpen)
  const view = useGrowthView(objective)
  const folded = !open
  const go = (page: typeof view.page) => goGrowth(objective, { page })
  const goSoon = (soon: SoonPlace) => goGrowth(objective, { page: 'soon', soon })
  const onSoon = (soon: SoonPlace) => view.page === 'soon' && view.soon?.id === soon.id
  const plays = useRankedGrowthPlays(objective).slice(0, 4)
  const allPlays = useGrowthPlays((s) => s.plays)
  const items = useGrowthExperiences((s) => s.items)
  const inAPlay = new Set(allPlays.flatMap((p) => p.variants.map((v) => v.experienceId)))
  const loose = experiencesFor(items, allPlays, objective).filter((x) => !inAPlay.has(x.id)).slice(0, 4)
  const [openPlays, setOpenPlays] = useState<Set<string>>(() => new Set(view.playId ? [view.playId] : []))

  useEffect(() => {
    if (view.playId) setOpenPlays((s) => (s.has(view.playId!) ? s : new Set(s).add(view.playId!)))
  }, [view.playId])

  const toggle = (id: string) =>
    setOpenPlays((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const parts: PaneRowSpec[] = EXPERIENCE_PARTS[objective].map((part) =>
    'soon' in part
      ? {
          id: part.soon.id,
          label: part.soon.label,
          icon: part.soon.icon,
          active: onSoon(part.soon),
          onClick: () => goSoon(part.soon),
        }
      : {
          id: part.page,
          label: part.label,
          icon: part.icon,
          active: view.page === part.page,
          onClick: () =>
            part.page === 'templates'
              ? goGrowth(objective, { page: 'templates', fillId: null })
              : go(part.page),
        },
  )

  const allExperiences: PaneRowSpec = {
    id: 'all-experiences',
    label: 'All experiences',
    icon: 'layers',
    active: view.page === 'index',
    section: parts.some((row) => row.active),
    showWhenFolded: true,
    onClick: () => go('index'),
    add: <RowMenu label="New experience" icon="plus" items={newExperienceItems(objective)} width={270} align="beside" />,
  }

  const performance: PaneRowSpec = {
    id: SOON.performance.id,
    label: SOON.performance.label,
    icon: SOON.performance.icon,
    active: onSoon(SOON.performance),
    showWhenFolded: true,
    onClick: () => goSoon(SOON.performance),
  }

  return (
    <ObjectivePaneShell
      title={objectiveLabel(objective)}
      folded={folded}
      onSearch={() => {
        go('index')
        window.requestAnimationFrame(() => document.getElementById(SEARCH_ID)?.focus())
      }}
      onToggle={() => setOpen(folded)}
      topRows={[
        {
          id: 'plays',
          label: 'Plays',
          icon: 'list-ordered',
          active: view.page === 'order' || view.page === 'play',
          showWhenFolded: true,
          onClick: () => go('order'),
          add: (
            <RowMenu
              label="New play"
              icon="plus"
              items={[{ label: 'New play', icon: 'plus', onClick: () => openGrowthPlay(objective, createGrowthPlay(objective)) }]}
              align="beside"
            />
          ),
        },
      ]}
      sections={[
        {
          id: 'experiences',
          title: 'Experiences',
          rows: [
            allExperiences,
            ...parts,
            { id: 'brand', label: 'Brand', icon: 'palette', active: view.page === 'brand', onClick: () => go('brand') },
          ],
        },
        {
          id: 'offers',
          title: 'Offers and pages',
          rows: [
            {
              id: 'offers',
              label: 'Offers',
              icon: 'gift',
              active: view.page === 'offers',
              showWhenFolded: true,
              onClick: () => go('offers'),
            },
          ],
        },
        { id: 'reporting', title: 'Reporting', rows: [performance] },
      ]}
      recent={
        <>
          {plays.length > 0 && (
            <PaneSection title="Recent plays">
              {plays.map((play) => <PlayRow key={play.id} play={play} open={openPlays.has(play.id)} onToggle={() => toggle(play.id)} />)}
            </PaneSection>
          )}
          {loose.length > 0 && (
            <PaneSection title="Recent experiences">
              {loose.map((x) => <LooseRow key={x.id} x={x} current={view.page === 'experience' && view.experienceId === x.id && !view.playId} />)}
            </PaneSection>
          )}
        </>
      }
      footer={{
        id: SOON.archive.id,
        label: SOON.archive.label,
        icon: SOON.archive.icon,
        active: onSoon(SOON.archive),
        onClick: () => goSoon(SOON.archive),
      }}
    />
  )
}
