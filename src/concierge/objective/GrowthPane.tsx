import { useEffect, useState } from 'react'
import { SIcon, type SIconName } from '@chargebee/sting-react'
import { AddButton, HeaderButton, PaneRow, Section } from '../../layout/ObjectivePane'
import { EmptyLine, Nested, splitTag, TreeLabel } from '../../layout/PlaysTree'
import { navItem } from '../../layout/navStyle'
import { StatusChip } from '../../layout/StatusChip'
import { SettingRow } from '../../layout/ThreadSidebar'
import { audienceUnset } from '../../plays/playOps'
import { revealPlayTarget } from '../../plays/revealPlay'
import { audienceText, fallbackVariant, pagesIn } from '../../plays/resolve'
import type { CancelPlay, PlayVariant } from '../../plays/types'
import { InlineName, RowMenu, toast, type MenuItem } from '../../plays/ui'
import { useWorkspaceUi } from '../../workspace/useWorkspaceUi'
import { objectiveLabel, TYPE_LABEL, type GrowthExperience, type GrowthObjective, type GrowthType } from '../model'
import { SOON, type SoonPlace } from '../Soon'
import {
  archiveGrowthExperience,
  duplicateGrowthExperience,
  experiencesFor,
  removeGrowthExperience,
  renameGrowthExperience,
  useGrowthExperiences,
} from '../useGrowthExperiences'
import {
  addToGrowthPlay,
  archiveGrowthPlay,
  createGrowthPlay,
  deleteGrowthPlay,
  dropGrowthExperience,
  duplicateGrowthPlay,
  experienceTabs,
  growthExperienceLive,
  growthPlayOps,
  growthPlaysUsing,
  renameGrowthPlay,
  useGrowthPlays,
  type GrowthPlay,
} from '../useGrowthPlays'
import { existingExperienceItems, experienceName, GROWTH_TYPES, newExperienceItems } from './actions'
import { SEARCH_ID } from './ExperiencesPage'
import { otherObjective, SharedMark } from './ui'
import { goGrowth, openGrowthExperience, openGrowthPlay, setRenaming, useGrowthUi, useGrowthView, type GrowthPage } from './useGrowthUi'

const RECENT_PLAYS = 4
const RECENT_EXPERIENCES = 4
const AUDIENCES_SHOWN = 3

/** Opens the play's Configure tab on a step, the way Retention's tree does. */
function openConfigure(play: GrowthPlay, step: 1 | 2) {
  useWorkspaceUi.getState().setConfigureStep(play.id, step)
  openGrowthPlay(play.objective, play.id, 'configure')
}

function playsIn(objective: GrowthObjective, exceptPlayId: string | null) {
  return useGrowthPlays.getState().plays.filter((p) => p.objective === objective && p.id !== exceptPlayId)
}

function addToPlayItems(objective: GrowthObjective, experienceId: string, exceptPlayId: string | null): MenuItem[] {
  return playsIn(objective, exceptPlayId).map((p) => {
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

function moveToPlayItems(play: GrowthPlay, v: PlayVariant): MenuItem[] {
  return playsIn(play.objective, play.id).map((p) => {
    const already = p.variants.some((x) => x.experienceId === v.experienceId)
    return {
      label: p.name,
      icon: 'move' as const,
      disabled: already,
      hint: already ? 'Already in this play' : undefined,
      onClick: () => {
        if (growthPlayOps.moveToPlay(play.id, v.id, p.id)) toast(`Moved ${experienceName(v.experienceId)} to ${p.name}`)
      },
    }
  })
}

/** Shares the same experience with the other tab's plays. */
function addToOtherTabItem(objective: GrowthObjective, experienceId: string): MenuItem {
  const other = otherObjective(objective)
  const plays = playsIn(other, null)
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
      ...playsIn(other, null).map((p) => ({ label: p.name, icon: 'folder-input' as const, hint: 'A separate copy in this play', onClick: () => copyInto(p.id) })),
    ],
  }
}

function leaveIfOpen(objective: GrowthObjective, experienceId: string) {
  const view = useGrowthUi.getState().views[objective]
  if (view.page === 'experience' && view.experienceId === experienceId) goGrowth(objective, { page: 'index', experienceId: null })
}

function archiveExperienceItem(objective: GrowthObjective, experienceId: string): MenuItem {
  const n = growthPlaysUsing(experienceId).length
  return {
    label: 'Archive experience',
    icon: 'archive',
    confirm: n > 0 ? `Take it out of ${n} play${n === 1 ? '' : 's'}?` : undefined,
    onClick: () => {
      const name = experienceName(experienceId)
      dropGrowthExperience(experienceId)
      archiveGrowthExperience(experienceId)
      leaveIfOpen(objective, experienceId)
      toast(n > 0 ? `Archived ${name} and took it out of ${n} play${n === 1 ? '' : 's'}.` : `Archived ${name}.`)
    },
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
      leaveIfOpen(objective, experienceId)
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

function ExperienceName({ x }: { x: GrowthExperience }) {
  const renaming = useGrowthUi((s) => s.renaming === x.id)
  return (
    <InlineName
      value={x.name}
      editing={renaming}
      onStart={() => setRenaming(x.id)}
      onDone={() => setRenaming(null)}
      onCommit={(name) => renameGrowthExperience(x.id, name)}
      className="flex-1 text-[13px] font-normal"
    />
  )
}

function VariantRow({ play, v, current }: { play: GrowthPlay; v: PlayVariant; current: boolean }) {
  const x = useGrowthExperiences((s) => s.items.find((i) => i.id === v.experienceId))
  const renaming = useGrowthUi((s) => s.renaming === v.experienceId)
  const plays = useGrowthPlays((s) => s.plays)
  if (!x) return null
  const items: MenuItem[] = [
    { label: 'Rename', icon: 'pencil', onClick: () => setRenaming(x.id) },
    duplicateItem(play.objective, x.id, play.id),
    duplicateToOtherTabItem(play.objective, x.id),
    { label: 'Add to another play…', icon: 'folder-input', items: addToPlayItems(play.objective, x.id, play.id) },
    { label: 'Move to another play…', icon: 'move', items: moveToPlayItems(play, v) },
    addToOtherTabItem(play.objective, x.id),
    {
      label: 'Remove from this play',
      icon: 'circle-slash',
      onClick: () => {
        growthPlayOps.removeFromPlay(play.id, v.id)
        toast(`Removed ${x.name} from ${play.name}`)
      },
    },
    archiveExperienceItem(play.objective, x.id),
    deleteExperienceItem(play.objective, x.id),
  ]
  const split = splitTag(play, v)
  const live = growthExperienceLive(x.id, plays)
  return (
    <div
      onClick={() => openGrowthExperience(play.objective, x.id, play.id)}
      onMouseEnter={() => revealPlayTarget(play.id, `variant:${v.id}`)}
      aria-current={current ? 'true' : undefined}
      title={TYPE_LABEL[x.type]}
      className={`group flex h-8 cursor-pointer items-center gap-[8px] pl-[8px] pr-[4px] ${navItem(current)}`}
    >
      {split && (
        <span className="slg-avatar flex h-[16px] w-[16px] flex-none items-center justify-center bg-slate-200/80 text-[10px] font-semibold text-slate-500">
          {split.letter}
        </span>
      )}
      <ExperienceName x={x} />
      {!renaming && (
        <>
          <SharedMark objective={play.objective} experienceId={x.id} />
          <span className="flex flex-none items-center gap-[6px] group-hover:hidden">
            {split && <span className="text-[11px] tabular-nums text-slate-400">{split.share}</span>}
            {live && <StatusChip live />}
          </span>
          <RowMenu label={`Actions for ${x.name}`} items={items} className="hidden group-hover:block" />
        </>
      )}
    </div>
  )
}

function AddExperience({ play }: { play: GrowthPlay }) {
  const items = useGrowthExperiences((s) => s.items)
  const plays = useGrowthPlays((s) => s.plays)
  const existing = existingExperienceItems(play, items, plays)
  return (
    <RowMenu
      label={`Add an experience to ${play.name}`}
      icon="plus"
      align="left"
      width={250}
      text="Add experience"
      className="ml-[2px]"
      items={[
        ...newExperienceItems(play.objective, play.id).map((i) => ({ ...i, label: `New ${i.label.toLowerCase()}` })),
        { label: 'Use an existing one…', icon: 'corner-down-right', items: existing },
      ]}
    />
  )
}

export function GrowthPlayRow({ play, open, onToggle }: { play: GrowthPlay; open: boolean; onToggle: () => void }) {
  const view = useGrowthView(play.objective)
  const renaming = useGrowthUi((s) => s.renaming === play.id)
  const step = useWorkspaceUi((s) => s.configureStep[play.id] ?? 1)
  const [picked, setPicked] = useState<string | null>(null)
  const onConfigure = view.page === 'play' && view.playId === play.id && view.playTab === 'configure'
  const pickedNow = (id: string, onStep: number) => onConfigure && picked === id && step === onStep
  const configure = (id: string, onStep: 1 | 2) => {
    setPicked(id)
    openConfigure(play, onStep)
  }
  const childPicked = pickedNow('audience', 1) || play.subAudiences.some((x) => pickedNow(x.id, 2)) || pickedNow('fallback', 2)
  const current = view.page === 'play' && view.playId === play.id && !childPicked
  const inside =
    (view.page === 'play' && view.playId === play.id && childPicked) ||
    (view.page === 'experience' && view.playId === play.id && play.variants.some((v) => v.experienceId === view.experienceId))
  const audienceLine = play.audience.targetAll ? 'All subscribers' : audienceUnset(play.audience) ? 'No audience yet' : audienceText(play.audience)
  const variantRow = (v: PlayVariant) => (
    <VariantRow key={v.id} play={play} v={v} current={view.page === 'experience' && view.playId === play.id && view.experienceId === v.experienceId} />
  )
  const items: MenuItem[] = [
    { label: 'Rename', icon: 'pencil', onClick: () => setRenaming(play.id) },
    {
      label: 'Duplicate',
      icon: 'copy',
      hint: 'Same audience and experiences, as a draft',
      onClick: () => {
        const id = duplicateGrowthPlay(play.id)
        if (id) setRenaming(id)
      },
    },
    { label: 'New experience in this play…', icon: 'plus', items: newExperienceItems(play.objective, play.id) },
    {
      label: 'Archive play',
      icon: 'archive',
      confirm: play.status === 'live' ? 'It stops showing. Click again to archive' : undefined,
      onClick: () => {
        archiveGrowthPlay(play.id)
        if (view.page === 'play' && view.playId === play.id) goGrowth(play.objective, { page: 'order', playId: null })
        toast(`Archived ${play.name}. Its experiences stay in the list.`)
      },
    },
    {
      label: 'Delete play',
      icon: 'trash-2',
      danger: true,
      confirm: 'Delete the play? Experiences stay.',
      onClick: () => {
        deleteGrowthPlay(play.id)
        if (view.page === 'play' && view.playId === play.id) goGrowth(play.objective, { page: 'index', playId: null })
        toast(`Deleted ${play.name}. Its experiences are still in the list.`)
      },
    },
  ]
  return (
    <div className="group/play">
      <div
        onClick={() => {
          setPicked(null)
          openGrowthPlay(play.objective, play.id)
          if (!open) onToggle()
        }}
        onMouseEnter={() => revealPlayTarget(play.id, 'top')}
        aria-current={current ? 'true' : undefined}
        className={`group relative flex h-8 cursor-pointer items-center gap-[6px] pl-[6px] pr-[4px] ${navItem(current, inside)}`}
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
          className="flex-1 text-[13px] font-normal"
        />
        {!renaming && (
          <>
            {play.status === 'live' && (
              <span className="flex-none group-hover:hidden">
                <StatusChip live />
              </span>
            )}
            <RowMenu label={`Actions for ${play.name}`} items={items} className="hidden group-hover:block" />
          </>
        )}
      </div>
      {open && (
        <button
          type="button"
          title="Audience. Opens Configure."
          onClick={() => configure('audience', 1)}
          onMouseEnter={() => revealPlayTarget(play.id, 'audience')}
          aria-current={pickedNow('audience', 1) ? 'true' : undefined}
          className={`${navItem(pickedNow('audience', 1))} slg-nav-quiet mb-[2px] ml-[30px] flex h-[24px] max-w-[calc(100%-34px)] items-center gap-[6px] px-[6px] text-left text-[12px] font-medium`}
        >
          <SIcon name="users" size={12} className="slg-nav-icon flex-none" />
          <span className="min-w-0 truncate">{audienceLine}</span>
        </button>
      )}
      {open && (
        <div className="slg-nav-tree mb-[6px] ml-[18px] flex flex-col gap-[2px] border-l pl-[12px]">
          {play.splitBy === 'segments' ? (
            <>
              {play.subAudiences.map((x, n) => (
                <div key={x.id}>
                  <TreeLabel icon="users-round" title="Sub-audience. Opens Configure." active={pickedNow(x.id, 2)} onClick={() => configure(x.id, 2)} onMouseEnter={() => revealPlayTarget(play.id, `sub:${x.id}`)}>
                    {audienceUnset(x.audience) ? `Sub-audience ${n + 1}` : audienceText(x.audience)}
                  </TreeLabel>
                  <Nested>
                    {pagesIn(play, x.id).map((v) => variantRow(v))}
                    {pagesIn(play, x.id).length === 0 && <EmptyLine text="No experience yet" />}
                  </Nested>
                </div>
              ))}
              <div>
                <TreeLabel icon="shield" title="For people in no sub-audience. Opens Configure." active={pickedNow('fallback', 2)} onClick={() => configure('fallback', 2)} onMouseEnter={() => revealPlayTarget(play.id, 'fallback')}>
                  Fallback
                </TreeLabel>
                <Nested>{fallbackVariant(play) ? variantRow(fallbackVariant(play)!) : <EmptyLine text="No experience yet" />}</Nested>
              </div>
            </>
          ) : (
            play.variants.map((v) => variantRow(v))
          )}
          <div className="flex items-center">
            {play.splitBy === 'segments' ? (
              <button
                type="button"
                onClick={() => {
                  growthPlayOps.addSubAudience(play.id)
                  openConfigure(play, 2)
                }}
                className="ml-[2px] flex h-6 items-center gap-[4px] rounded-md pl-[5px] pr-[6px] text-[11.5px] text-slate-400 hover:bg-white hover:text-slate-800"
              >
                <SIcon name="plus" size={13} /> Add sub-audience
              </button>
            ) : (
              <AddExperience play={play} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function GrowthLooseRow({ x, current }: { x: GrowthExperience; current: boolean }) {
  const renaming = useGrowthUi((s) => s.renaming === x.id)
  const plays = useGrowthPlays((s) => s.plays)
  const live = growthExperienceLive(x.id, plays)
  const items: MenuItem[] = [
    { label: 'Rename', icon: 'pencil', onClick: () => setRenaming(x.id) },
    duplicateItem(x.objective, x.id, null),
    duplicateToOtherTabItem(x.objective, x.id),
    { label: 'Add to a play…', icon: 'folder-input', items: addToPlayItems(x.objective, x.id, null) },
    addToOtherTabItem(x.objective, x.id),
    archiveExperienceItem(x.objective, x.id),
    deleteExperienceItem(x.objective, x.id),
  ]
  return (
    <div
      onClick={() => openGrowthExperience(x.objective, x.id, null)}
      aria-current={current ? 'true' : undefined}
      className={`group flex h-8 cursor-pointer items-center gap-[6px] pl-[36px] pr-[4px] ${navItem(current)}`}
    >
      <ExperienceName x={x} />
      {!renaming && (
        <>
          <SharedMark objective={x.objective} experienceId={x.id} />
          {live && (
            <span className="flex-none group-hover:hidden">
              <StatusChip live />
            </span>
          )}
          <RowMenu label={`Actions for ${x.name}`} items={items} className="hidden group-hover:block" />
        </>
      )}
    </div>
  )
}

interface AudienceUse {
  key: string
  name: string
  play: GrowthPlay
}

/** The audiences of recent plays, each once: every play's own audience first, then sub-audiences. */
function audiencesOf(plays: GrowthPlay[]): AudienceUse[] {
  const out: AudienceUse[] = []
  const pairs = [...plays.map((p) => ({ p, a: p.audience })), ...plays.flatMap((p) => (p as CancelPlay).subAudiences.map((x) => ({ p, a: x.audience })))]
  for (const { p, a } of pairs) {
    const name = a.targetAll ? 'All subscribers' : audienceText(a)
    if (!name || out.some((x) => x.name === name)) continue
    out.push({ key: `${p.id}:${a.id}`, name, play: p })
  }
  return out.slice(0, AUDIENCES_SHOWN)
}

function AudienceRow({ use }: { use: AudienceUse }) {
  return (
    <button
      type="button"
      onClick={() => openConfigure(use.play, 1)}
      title={`Used in ${use.play.name}. Opens its audience.`}
      className={`${navItem()} group flex h-8 w-full min-w-0 items-center gap-[6px] pl-[36px] pr-[8px] text-left text-[13px] font-normal`}
    >
      <span className="min-w-0 flex-1 truncate">{use.name}</span>
      <span className="hidden max-w-[96px] flex-none truncate text-[11.5px] text-slate-400 group-hover:block">{use.play.name}</span>
    </button>
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

const recentTitle = (type: GrowthType) => `Recent ${TYPE_LABEL[type].toLowerCase()}s`

/** Acquisition or Expansion's pane: Retention's pane, with this objective's places. */
export function GrowthPane({ objective }: { objective: GrowthObjective }) {
  const sidebarOpen = useWorkspaceUi((s) => s.sidebarOpen)
  const setSidebarOpen = useWorkspaceUi((s) => s.setSidebarOpen)
  const view = useGrowthView(objective)
  const allPlays = useGrowthPlays((s) => s.plays)
  const items = useGrowthExperiences((s) => s.items)
  const archivedPlays = useGrowthPlays((s) => s.archived.filter((p) => p.objective === objective).length)
  const archivedExperiences = useGrowthExperiences((s) => s.archived.filter((x) => x.objective === objective).length)
  const folded = !sidebarOpen
  const go = (page: GrowthPage) => goGrowth(objective, { page })
  const goSoon = (soon: SoonPlace) => goGrowth(objective, { page: 'soon', soon })
  const onSoon = (soon: SoonPlace) => view.page === 'soon' && view.soon?.id === soon.id
  const [open, setOpen] = useState<Set<string>>(() => new Set(view.playId ? [view.playId] : []))

  const inPlay = (view.page === 'play' || view.page === 'experience') && view.playId ? view.playId : null
  useEffect(() => {
    if (inPlay) setOpen((s) => (s.has(inPlay) ? s : new Set(s).add(inPlay)))
  }, [inPlay])

  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const recentPlays = allPlays
    .filter((p) => p.objective === objective)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, RECENT_PLAYS)
  const recentExperiences = experiencesFor(items, allPlays, objective).slice(0, RECENT_EXPERIENCES)
  const audiences = audiencesOf(recentPlays)
  const openedInPlay = recentPlays.some((p) => p.id === view.playId && open.has(p.id) && p.variants.some((v) => v.experienceId === view.experienceId))
  const archivedCount = archivedPlays + archivedExperiences

  const search = () => {
    go('index')
    window.requestAnimationFrame(() => document.getElementById(SEARCH_ID)?.focus())
  }
  const newPlay = () => {
    const id = createGrowthPlay(objective)
    openGrowthPlay(objective, id, 'configure')
    setRenaming(id)
  }
  const partRow = (part: PartRow) =>
    'soon' in part ? (
      <PaneRow key={part.soon.id} icon={part.soon.icon} label={part.soon.label} active={onSoon(part.soon)} onClick={() => goSoon(part.soon)} />
    ) : (
      <PaneRow
        key={part.page}
        icon={part.icon}
        label={part.label}
        active={view.page === part.page}
        onClick={() => (part.page === 'templates' ? goGrowth(objective, { page: 'templates', fillId: null }) : go(part.page))}
      />
    )

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-slate-200 bg-white">
      <div className={`flex h-[60px] flex-none items-center border-b border-slate-200 ${folded ? 'justify-center' : 'gap-[2px] px-[14px]'}`}>
        {!folded && (
          <span className="min-w-0 flex-1 truncate font-[family-name:var(--slg-font-family-emphasis)] text-[16px] font-semibold text-[var(--slg-neutral-900)]">
            {objectiveLabel(objective)}
          </span>
        )}
        {!folded && <HeaderButton label="Search" icon="search" onClick={search} />}
        <HeaderButton label={folded ? 'Open side panel' : 'Close side panel'} icon="panel-left" onClick={() => setSidebarOpen(folded)} />
      </div>

      {folded ? (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-[2px] px-[8px] py-[10px]">
            <SettingRow icon="search" label="Search" folded onClick={search} />
            <SettingRow icon="list-ordered" label="Plays" folded active={view.page === 'order'} onClick={() => go('order')} />
            <SettingRow icon="layers" label="Experiences" folded active={view.page === 'index'} onClick={() => go('index')} />
            <SettingRow icon="gift" label="Offers" folded active={view.page === 'offers'} onClick={() => go('offers')} />
            <SettingRow icon={SOON.performance.icon} label={SOON.performance.label} folded active={onSoon(SOON.performance)} onClick={() => goSoon(SOON.performance)} />
          </div>
          <div className="flex-none border-t border-slate-200 px-[8px] py-[8px]">
            <SettingRow icon="archive" label="Archive" folded active={view.page === 'archive'} onClick={() => go('archive')} />
          </div>
        </>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-[16px] overflow-y-auto px-[10px] pb-[16px] pt-[10px]">
            <PaneRow icon="list-ordered" label="Plays" active={view.page === 'order'} onClick={() => go('order')} add={<AddButton label="New play" onClick={newPlay} />} />

            <Section title="Experiences">
              <PaneRow
                icon="layers"
                label="All experiences"
                active={view.page === 'index'}
                onClick={() => go('index')}
                add={<RowMenu label="New experience" icon="plus" items={newExperienceItems(objective)} width={270} align="beside" />}
              />
              {EXPERIENCE_PARTS[objective].map(partRow)}
              <PaneRow icon="palette" label="Brand" active={view.page === 'brand'} onClick={() => go('brand')} />
            </Section>

            <Section title="Offers and pages">
              <PaneRow icon="gift" label="Offers" active={view.page === 'offers'} onClick={() => go('offers')} />
            </Section>

            <Section title="Reporting">
              <PaneRow icon={SOON.performance.icon} label={SOON.performance.label} active={onSoon(SOON.performance)} onClick={() => goSoon(SOON.performance)} />
            </Section>

            {recentPlays.length === 0 && recentExperiences.length === 0 && (
              <Section title="Recent">
                <p className="px-[10px] py-[4px] text-[12px] leading-snug text-slate-400">Plays and experiences you open show up here.</p>
              </Section>
            )}
            {recentPlays.length > 0 && (
              <Section title="Recent plays">
                {recentPlays.map((p) => (
                  <GrowthPlayRow key={p.id} play={p} open={open.has(p.id)} onToggle={() => toggle(p.id)} />
                ))}
              </Section>
            )}
            {GROWTH_TYPES.filter((type) => recentExperiences.some((x) => x.type === type)).map((type) => (
              <Section key={type} title={recentTitle(type)}>
                {recentExperiences
                  .filter((x) => x.type === type)
                  .map((x) => (
                    <GrowthLooseRow key={x.id} x={x} current={view.page === 'experience' && view.experienceId === x.id && !openedInPlay && !view.playId} />
                  ))}
              </Section>
            ))}
            {audiences.length > 0 && (
              <Section title="Recent audiences">
                {audiences.map((a) => (
                  <AudienceRow key={a.key} use={a} />
                ))}
              </Section>
            )}
          </div>

          <div className="flex-none border-t border-slate-200 px-[10px] py-[8px]">
            <PaneRow
              icon="archive"
              label="Archive"
              active={view.page === 'archive'}
              onClick={() => go('archive')}
              trailing={archivedCount > 0 ? <span className="flex-none text-[11.5px] tabular-nums text-slate-400">{archivedCount}</span> : undefined}
            />
          </div>
        </>
      )}
    </aside>
  )
}
