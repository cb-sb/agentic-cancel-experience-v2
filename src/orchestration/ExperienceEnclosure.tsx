import { useEffect, useState, type ReactNode } from 'react'
import { blueprintMeta } from '../lib/blueprints'
import { AddMenu, type AddOption } from './flow/AddMenu'
import { experienceBadge } from '../lib/experienceUtils'
import { useExperience } from '../store/useExperience'
import { useOrchestration } from '../store/useOrchestration'
import type { Experience, StageId } from '../types/experience'
import type { TargetType } from '../types/orchestration'
import {
  COLLAPSED_H,
  COLLAPSED_W,
  FRAME_BORDER,
  TITLE_MAX_SCALE,
  TITLE_PILL_GAP,
} from './flow/canvasTokens'
import { ScreenBox, useCounterScale } from './flow/screen'

const TARGET_FLOW: TargetType[] = ['CANCEL_PAGE', 'HOSTED_PAGE']
const TARGET_COMPACT: TargetType[] = ['OFFER', 'PRICING_PAGE']

const STAGE_LABEL: Record<StageId, string> = {
  value_reinforcement: 'Value reinforcement',
  entry_offer: 'Entry offer',
  route_detection: 'Reason survey',
  save_mechanic: 'Save offer',
  checkout: 'Checkout',
  confirmation: 'Confirmation',
  outcome: 'Outcome',
}

/**
 * The title pill floats detached above the frame, so hovering it lights the
 * frame's contour: that is the only thing tying the two together, and it
 * previews what the pill's buttons are about to act on.
 */
const TITLE_HOVER_FRAME =
  'peer-hover/title:border-indigo-400 peer-hover/title:bg-indigo-50/40 peer-hover/title:ring-2 peer-hover/title:ring-indigo-400/25'

const POSTURE_LABEL: Record<'clean_exit' | 'balanced' | 'save_aggressive', string> = {
  clean_exit: 'Clean exit',
  balanced: 'Balanced',
  save_aggressive: 'Save-focused',
}

export function isExperienceTarget(target: TargetType): boolean {
  return TARGET_FLOW.includes(target)
}

interface ExperienceEnclosureProps {
  experience: Experience
  flowNodeId: string
  /** The frame is explicitly selected (via its title) — strong ring + brand drawer. */
  selected: boolean
  /** A step inside is being edited — subtle outline only. */
  active: boolean
  onSelect: () => void
  width: number
  height: number
  collapsed: boolean
  onToggleCollapse: () => void
}

/**
 * The artboard a cancel experience's steps sit on. It draws the frame and its
 * title and nothing else: the steps are their own nodes, positioned by
 * `enclosureGrid`, so this cannot disagree with them about how much room they
 * need.
 */
export function ExperienceEnclosure({
  experience,
  flowNodeId,
  selected,
  active,
  onSelect,
  width,
  height,
  collapsed,
  onToggleCollapse,
}: ExperienceEnclosureProps) {
  const titleScale = useCounterScale(TITLE_MAX_SCALE)
  const renameExperience = useExperience((s) => s.renameExperience)
  const duplicateExperience = useExperience((s) => s.duplicateExperience)
  const activeStepId = useExperience((s) => s.activeStepId)
  const addTreatmentBranch = useOrchestration((s) => s.addTreatmentBranch)
  const focusStep = useOrchestration((s) => s.focusStep)
  const play = useOrchestration((s) => s.play)
  const removeBranch = useOrchestration((s) => s.removeBranch)
  const [renaming, setRenaming] = useState(false)
  const [dupOpen, setDupOpen] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [draftName, setDraftName] = useState(experience.name)

  const split = play.targeting.kind === 'split' ? play.targeting : null
  const treatmentCount = split?.branches.filter((b) => b.node.kind === 'flow').length ?? 0

  const commitRename = () => {
    const trimmed = draftName.trim()
    if (trimmed && trimmed !== experience.name) renameExperience(experience.id, trimmed)
    setRenaming(false)
  }

  const startRename = () => {
    setDraftName(experience.name)
    setRenaming(true)
  }

  /**
   * Edit the experience: open its steps in the editing drawer.
   *
   * Resumes on the step last worked on when it belongs here, so coming back to
   * an experience lands where it was left rather than at the top. A collapsed
   * frame expands first — the drawer pans the step it is editing into the strip
   * beside itself, and a summary card has no step for it to pan to.
   */
  const onEdit = () => {
    const step = experience.steps.find((s) => s.id === activeStepId) ?? experience.steps[0]
    if (!step) return
    if (collapsed) onToggleCollapse()
    focusStep({ experienceId: experience.id, stepId: step.id })
  }

  /**
   * Duplicating used to mean starting an A/B test.
   *
   * One click on a copy icon added a treatment branch and flipped the play into
   * percent mode — a live experiment, from a button whose tooltip said
   * "Duplicate experience". The two things it could plausibly have meant are now
   * both offered by name, and neither happens by accident. One-click A/B still
   * exists where it is labelled: the split card's own Add variant.
   */
  const duplicateOptions: AddOption[] = [
    {
      id: 'ab',
      label: 'Duplicate as A/B variant',
      desc: 'Splits traffic between the two',
      disabledReason: split ? undefined : 'This play has no traffic split',
      onPick: () => {
        if (split) addTreatmentBranch(split.id, duplicateExperience(experience.id))
      },
    },
    {
      id: 'library',
      label: 'Duplicate to library',
      desc: 'A copy to reuse, attached to nothing',
      onPick: () => duplicateExperience(experience.id, `${experience.name} copy`),
    },
  ]

  /**
   * Taking the experience off the play. The store refuses to leave a split with
   * no flows at all, so rather than let the click do nothing, the button says
   * why it cannot.
   */
  const removable = split && treatmentCount > 1
  const branchId = split?.branches.find((b) => b.node.id === flowNodeId)?.id ?? null

  return (
    <div style={{ width, height }} className="group/frame relative">
      {/* Frame title — sits just OUTSIDE, above the frame. Clicking it selects
          the whole enclosure; clicking inside the frame does not. Counter-scaled
          so it holds its on-screen size as the canvas zooms out, as far as the
          clearance above the frame allows — past that it shrinks with the canvas
          rather than landing on the row above. */}
      <div
        data-chrome
        data-enclosure-title
        // `w-max` matters: an absolutely positioned box otherwise shrink-to-fits
        // inside the frame's width, so a narrow frame — a collapsed one, say —
        // wrapped the pill onto two lines and clipped the name. The pill floats
        // over empty canvas, so it is free to be wider than what it labels.
        className={`peer/title absolute bottom-full left-0 z-20 flex w-max items-center whitespace-nowrap rounded-xl ${
          renaming ? 'gap-1.5' : 'gap-0.5 bg-white p-[3px] shadow-[0_1px_4px_rgba(15,23,42,0.1)]'
        }`}
        style={{
          transform: `scale(${titleScale}) translateY(-${TITLE_PILL_GAP}px)`,
          transformOrigin: 'bottom left',
        }}
      >
        {renaming ? (
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') {
                setDraftName(experience.name)
                setRenaming(false)
              }
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="rounded-md border border-indigo-300 px-2 py-1 text-[12.5px] font-semibold text-slate-900 outline-none ring-2 ring-indigo-200"
          />
        ) : (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onSelect()
            }}
            // Renaming lives on the name itself rather than on a second pencil
            // beside the one that opens the editor: two edit affordances in a
            // 32px pill, one meaning "the name" and one meaning "everything
            // else", is a coin toss every time. The name is the thing being
            // renamed, so it is the thing you double-click.
            onDoubleClick={(e) => {
              e.stopPropagation()
              startRename()
            }}
            title="Click to select · double-click to rename"
            className={`flex max-w-[420px] items-center gap-2 rounded-lg px-2 py-1 text-[12.5px] font-semibold transition-colors ${
              selected
                ? 'bg-indigo-600 text-white'
                : 'text-slate-800 hover:bg-indigo-50 hover:text-indigo-700'
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5" />
            </svg>
            <span className="truncate">{experience.name}</span>
            <span
              className={`flex-none font-mono text-[9.5px] uppercase tracking-wide ${
                selected ? 'text-indigo-100' : 'text-slate-400'
              }`}
            >
              {experienceBadge(experience.id)}
            </span>
          </button>
        )}
        <div className="flex items-center gap-0.5">
          <EnclosureBtn
            title="Edit this experience — opens the step editor"
            onClick={onEdit}
            disabled={!experience.steps.length}
          >
            <PencilIcon />
          </EnclosureBtn>
          <div className="relative">
            <EnclosureBtn title="Duplicate…" onClick={() => setDupOpen((v) => !v)}>
              <CopyIcon />
            </EnclosureBtn>
            {dupOpen && (
              <AddMenu
                align="left"
                onClose={() => setDupOpen(false)}
                sections={[{ title: 'Duplicate this experience', options: duplicateOptions }]}
              />
            )}
          </div>
          <EnclosureBtn
            title={collapsed ? 'Expand experience' : 'Collapse to summary'}
            onClick={onToggleCollapse}
          >
            {collapsed ? <ExpandIcon /> : <CollapseIcon />}
          </EnclosureBtn>
          <span className="mx-0.5 h-4 w-px bg-slate-200" />
          {removing ? (
            <RemoveConfirm
              onCancel={() => setRemoving(false)}
              onConfirm={() => {
                setRemoving(false)
                if (split && branchId) removeBranch(split.id, branchId)
              }}
            />
          ) : (
            <EnclosureBtn
              title={
                removable
                  ? 'Remove this experience from the play'
                  : 'A play needs at least one experience'
              }
              danger
              disabled={!removable}
              onClick={() => setRemoving(true)}
            >
              <TrashIcon />
            </EnclosureBtn>
          )}
        </div>
      </div>

      <div
        onPointerDown={(e) => e.stopPropagation()}
        style={{ width, height }}
        // Selection and editing tint the fill; zoom never does. The artboard has
        // to look like one surface whether you are reading the whole play or a
        // single card, so nothing here keys off the tier.
        className={`cursor-default rounded-2xl transition-all ${
          selected
            ? 'border-2 border-indigo-500 bg-indigo-50/40 shadow-md ring-2 ring-indigo-500/20'
            : active
            ? `border-2 border-indigo-300 bg-indigo-50/25 shadow-sm ${TITLE_HOVER_FRAME}`
            : // Pale but not thin: the frame's job is to group, so its edge
              // should never compete with the cards inside it — but a 1px stroke
              // in world units falls below a screen pixel once zoomed out.
              `border-2 border-slate-200 bg-white/60 hover:border-slate-300 ${TITLE_HOVER_FRAME}`
        }`}
      >
        {collapsed && (
          // Inside the frame's border, which the box model puts inside `width`
          // but which still pushes the content box down and right.
          <ScreenBox w={COLLAPSED_W - FRAME_BORDER * 2} h={COLLAPSED_H - FRAME_BORDER * 2}>
            {(size) => (
              <CollapsedSummary
                experience={experience}
                size={size}
                onExpand={onToggleCollapse}
              />
            )}
          </ScreenBox>
        )}
      </div>
    </div>
  )
}

/**
 * A collapsed experience, in a box that never changes size. What changes is how
 * much of the flow it can spell out: at a glance it is a stack of bars, and as
 * there is room it becomes the named steps.
 */
function CollapsedSummary({
  experience,
  size,
  onExpand,
}: {
  experience: Experience
  size: { w: number; h: number; tier: string }
  onExpand: () => void
}) {
  const meta = blueprintMeta(experience.blueprint)
  const pad = size.w < 200 ? 12 : 18
  const abstract = size.tier === 't0' || size.tier === 't1'

  // Rows that fit, computed rather than measured: everything here is a known
  // height, so there is nothing to wait for and nothing to clip.
  const rowH = abstract ? 14 : 22
  const headH = abstract ? 0 : 26
  const footH = abstract ? 0 : 26
  const room = size.h - pad * 2 - headH - footH
  const fits = Math.max(1, Math.floor(room / rowH))
  const shown = experience.steps.slice(0, fits)
  const hidden = experience.steps.length - shown.length

  if (abstract) {
    return (
      <div className="flex h-full flex-col justify-center gap-2" style={{ padding: pad }} aria-hidden>
        {shown.map((step, i) => (
          <div key={step.id} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 flex-none rounded-full bg-slate-300" />
            <span
              className="h-2 rounded-full bg-slate-200"
              style={{ width: `${52 + ((i * 13) % 34)}%` }}
            />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col" style={{ padding: pad }}>
      <div className="flex flex-none flex-wrap items-center gap-1.5 text-[11px]">
        <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 font-semibold text-indigo-700">
          {meta.name}
        </span>
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">
          {POSTURE_LABEL[meta.posture]}
        </span>
      </div>

      <ol className="mt-2 min-h-0 flex-1 space-y-1">
        {shown.map((step, i) => (
          <li key={step.id} className="flex items-center gap-2 text-[12px] text-slate-700" style={{ height: rowH - 4 }}>
            <span className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-600 ring-1 ring-inset ring-indigo-100">
              {i + 1}
            </span>
            <span className="truncate">{STAGE_LABEL[step.stage]}</span>
          </li>
        ))}
        {hidden > 0 && (
          <li className="text-[11px] font-semibold text-slate-400">+{hidden} more</li>
        )}
      </ol>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onExpand()
        }}
        className="-ml-1.5 mt-1 inline-flex flex-none items-center gap-1 self-start rounded-md px-1.5 py-1 text-[11px] font-semibold text-indigo-600 transition-colors hover:bg-indigo-50"
      >
        Expand steps
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  )
}

function EnclosureBtn({
  title,
  onClick,
  disabled,
  danger,
  children,
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`flex h-6 w-6 items-center justify-center rounded-md text-slate-400 disabled:pointer-events-none disabled:opacity-40 ${
        danger ? 'hover:bg-rose-50 hover:text-rose-600' : 'hover:bg-slate-100 hover:text-slate-800'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * Same shape as the step toolbar's delete: the question takes over the pill it
 * was asked from, because the answer belongs beside the thing it is about.
 */
function RemoveConfirm({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void
  onConfirm: () => void
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onCancel])

  return (
    <span className="flex items-center gap-0.5 pl-1">
      <span className="whitespace-nowrap pr-0.5 text-[11.5px] font-semibold text-slate-700">
        Remove from play?
      </span>
      <button
        type="button"
        className="rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          onCancel()
        }}
      >
        Keep
      </button>
      <button
        type="button"
        className="rounded-md bg-rose-600 px-1.5 py-0.5 text-[11.5px] font-semibold text-white hover:bg-rose-700"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          onConfirm()
        }}
      >
        Remove
      </button>
    </span>
  )
}

const TrashIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  </svg>
)

const CopyIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)

const PencilIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
)

/**
 * A matched pair around the same centre line: collapse folds the chevrons in
 * towards it, expand pushes them out. Bare chevrons on purpose — at 12px, arrows
 * with shafts collapse into a smudge.
 */
const CollapseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 4v16M5 8l4 4-4 4M19 8l-4 4 4 4" />
  </svg>
)

const ExpandIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 4v16M9 8l-4 4 4 4M15 8l4 4-4 4" />
  </svg>
)

export { TARGET_FLOW, TARGET_COMPACT }
