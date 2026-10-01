import { SButton, SIcon } from '@chargebee/sting-react'
import { audienceText } from '../../plays/resolve'
import { ALL_AUDIENCE, variantLetter, type PlayVariant } from '../../plays/types'
import { Chip, InlineName, RowMenu, toast, type MenuItem } from '../../plays/ui'
import { savedAudience } from '../../plays/usePlays'
import { BackButton } from '../../shell/BackButton'
import { AUDIENCE_LIBRARY, type Audience } from '../../types/orchestration'
import { TYPE_LABEL, type GrowthObjective } from '../model'
import { useGrowthExperiences } from '../useGrowthExperiences'
import {
  removeFromGrowthPlay,
  renameGrowthPlay,
  setGrowthPlayLive,
  setGrowthSplitBy,
  setGrowthVariant,
  updateGrowthPlay,
  useGrowthPlays,
  type GrowthPlay,
} from '../useGrowthPlays'
import { existingExperienceItems, growthPlayChecks, newExperienceItems, refName } from './actions'
import { CopilotColumn, Field, inputCls, Section, TabStrip } from './ui'
import { goGrowth, openGrowthExperience, openGrowthPlay, setGrowthView, setRenaming, useGrowthUi, useGrowthView } from './useGrowthUi'

function audienceValue(a: Audience | undefined): string {
  if (!a || a.targetAll) return 'all'
  return a.savedAudienceId ?? 'all'
}

function audienceFor(id: string): Audience {
  return id === 'all' ? ALL_AUDIENCE : savedAudience(id)
}

function AudienceSelect({ value, onChange, allLabel }: { value: string; onChange: (id: string) => void; allLabel: string }) {
  return (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="all">{allLabel}</option>
      {AUDIENCE_LIBRARY.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  )
}

function VariantLine({ play, v, index }: { play: GrowthPlay; v: PlayVariant; index: number }) {
  const x = useGrowthExperiences((s) => s.items.find((i) => i.id === v.experienceId))
  if (!x) return null
  const shows = refName(x)
  return (
    <li className="flex items-center gap-[12px] border-t border-slate-100 py-[10px] first:border-t-0">
      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-slate-100 text-[11.5px] font-bold text-slate-600">{variantLetter(index)}</span>
      <button type="button" onClick={() => openGrowthExperience(play.objective, x.id, play.id)} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[13px] font-medium text-slate-900 hover:underline">{x.name}</span>
        <span className="block truncate text-[12px] text-slate-500">
          {TYPE_LABEL[x.type]} · {shows ?? 'Nothing picked yet'}
        </span>
      </button>
      {play.variants.length > 1 &&
        (play.splitBy === 'percent' ? (
          <label className="flex flex-none items-center gap-[4px] text-[12.5px] text-slate-500">
            <input
              type="number"
              min={0}
              max={100}
              value={v.weight}
              onChange={(e) => setGrowthVariant(play.id, v.id, { weight: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
              aria-label={`Share for variant ${variantLetter(index)}`}
              className="w-[64px] rounded-[8px] border border-slate-200 px-[8px] py-[5px] text-right text-[13px] text-slate-900 outline-none focus:border-slate-400"
            />
            %
          </label>
        ) : (
          <div className="w-[200px] flex-none">
            <AudienceSelect
              value={audienceValue(v.audience)}
              allLabel="Everyone else"
              onChange={(id) => setGrowthVariant(play.id, v.id, { audience: id === 'all' ? undefined : savedAudience(id) })}
            />
          </div>
        ))}
      <button
        type="button"
        aria-label={`Remove ${x.name} from this play`}
        title="Remove from this play"
        onClick={() => {
          removeFromGrowthPlay(play.id, v.id)
          toast(`Removed ${x.name} from ${play.name}`)
        }}
        className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        <SIcon name="x" size={14} />
      </button>
    </li>
  )
}

function Summary({ play }: { play: GrowthPlay }) {
  const items = useGrowthExperiences((s) => s.items)
  const plays = useGrowthPlays((s) => s.plays)
  const existing: MenuItem[] = existingExperienceItems(play, items, plays)
  const total = play.variants.reduce((s, v) => s + v.weight, 0)
  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto flex max-w-[720px] flex-col gap-[16px] px-[28px] py-[24px]">
        <Section title="Who sees it" hint="The audience, and how many of them are held back to measure lift">
          <Field label="Audience">
            <AudienceSelect value={audienceValue(play.audience)} allLabel="All subscribers" onChange={(id) => updateGrowthPlay(play.id, { audience: audienceFor(id) })} />
          </Field>
          <Field label="Control group" hint="They see nothing from this play">
            <label className="flex items-center gap-[6px] text-[13px] text-slate-500">
              <input
                type="number"
                min={0}
                max={50}
                value={play.control}
                onChange={(e) => updateGrowthPlay(play.id, { control: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })}
                aria-label="Control group percent"
                className="w-[72px] rounded-[8px] border border-slate-200 px-[8px] py-[6px] text-right text-[13px] text-slate-900 outline-none focus:border-slate-400"
              />
              % of the audience
            </label>
          </Field>
        </Section>
        <Section title="Variants" hint="The experiences this play shows, and how the audience is split across them">
          {play.variants.length > 1 && (
            <Field label="Split by">
              <div className="inline-flex rounded-lg bg-slate-100 p-[2px] text-[12.5px] font-medium">
                {(['percent', 'segments'] as const).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setGrowthSplitBy(play.id, id)}
                    className={`rounded-md px-[10px] py-[4px] ${play.splitBy === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    {id === 'percent' ? 'Percent' : 'Sub-audience'}
                  </button>
                ))}
              </div>
              {play.splitBy === 'percent' && total !== 100 && <p className="mt-[6px] text-[12px] text-amber-700">The split adds up to {total}%. Make it 100%.</p>}
            </Field>
          )}
          <ul>
            {play.variants.map((v, i) => (
              <VariantLine key={v.id} play={play} v={v} index={i} />
            ))}
            {play.variants.length === 0 && <li className="py-[12px] text-[13px] text-slate-500">No variants yet. Add an experience below.</li>}
          </ul>
          <div className="flex items-center border-t border-slate-100 py-[10px]">
            <RowMenu
              label="Add a variant"
              icon="plus"
              align="left"
              width={260}
              items={[...newExperienceItems(play.objective, play.id).map((i) => ({ ...i, label: `New ${i.label.toLowerCase()}` })), { label: 'Use an existing one…', icon: 'corner-down-right', items: existing }]}
            />
            <span className="pl-[6px] text-[12.5px] text-slate-500">Add a variant</span>
          </div>
        </Section>
      </div>
    </div>
  )
}

function TaskList({ play }: { play: GrowthPlay }) {
  const checks = growthPlayChecks(play)
  const open = checks.filter((c) => !c.passed).length
  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-[720px] px-[28px] py-[24px]">
        <p className="text-[13px] text-slate-500">
          {open === 0 ? (play.status === 'live' ? 'Everything passes and the play is live.' : 'Everything passes. You can go live.') : `${open} of ${checks.length} still to pass before it can go live.`}
        </p>
        <ul className="mt-[12px] overflow-hidden rounded-xl border border-slate-200 bg-white">
          {checks.map((c) => (
            <li key={c.id} className="flex items-start gap-[10px] border-t border-slate-100 px-[16px] py-[12px] first:border-t-0">
              <span className={`mt-[1px] flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full ${c.passed ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                <SIcon name={c.passed ? 'check' : 'circle'} size={11} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-slate-800">{c.label}</span>
                {!c.passed && <span className="block text-[12.5px] text-slate-500">{c.fix}</span>}
              </span>
              {!c.passed && (
                <button type="button" onClick={() => setGrowthView(play.objective, { playTab: 'summary' })} className="flex-none text-[12.5px] font-medium text-slate-600 hover:text-slate-900">
                  Open Summary
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function GoLive({ play }: { play: GrowthPlay }) {
  const open = growthPlayChecks(play).filter((c) => !c.passed)
  const live = play.status === 'live'
  const blocked = !live && open.length > 0
  return (
    <span title={blocked ? `Still to pass: ${open.map((c) => c.label).join('. ')}` : undefined}>
      <SButton
        size="small"
        variant={live ? 'neutral-outline' : 'primary'}
        className="w-auto"
        disabled={blocked}
        onClick={() => {
          setGrowthPlayLive(play.id, !live)
          toast(live ? `${play.name} is paused` : `${play.name} is live`)
        }}
      >
        {live ? 'Pause' : 'Go live'}
      </SButton>
    </span>
  )
}

/** A play's own workspace: Summary and Task list on the left, Copilot on the right. */
export function PlayPage({ objective }: { objective: GrowthObjective }) {
  const view = useGrowthView(objective)
  const play = useGrowthPlays((s) => s.plays.find((p) => p.id === view.playId))
  const renaming = useGrowthUi((s) => s.renaming === play?.id)

  if (!play) {
    return <div className="flex h-full flex-1 items-center justify-center text-[13px] text-slate-500">This play was deleted. Pick another from the left.</div>
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-[52px] flex-none items-center gap-[10px] border-b border-slate-200 px-[16px]">
          <BackButton fallback={() => goGrowth(objective, { page: 'index' })} className="-ml-[6px]" />
          <SIcon name="workflow" size={15} className="flex-none text-slate-500" />
          <InlineName
            value={play.name}
            editing={renaming}
            onStart={() => setRenaming(play.id)}
            onDone={() => setRenaming(null)}
            onCommit={(name) => renameGrowthPlay(play.id, name)}
            className="text-[15px] font-semibold text-slate-900"
            inputClassName="text-[15px] font-semibold"
          />
          <Chip tone={play.status === 'live' ? 'emerald' : 'amber'}>{play.status === 'live' ? 'Live' : 'Draft'}</Chip>
          <span className="truncate text-[12.5px] text-slate-500">{audienceText(play.audience)}</span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => goGrowth(objective, { page: 'order' })}
            className="inline-flex items-center gap-[5px] rounded-lg px-[8px] py-[5px] text-[12px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <SIcon name="list-ordered" size={13} /> Play order
          </button>
          <GoLive play={play} />
        </header>
        <TabStrip
          tabs={[
            { id: 'summary', label: 'Summary', icon: 'file-text' },
            { id: 'tasks', label: 'Task list', icon: 'list-checks' },
          ]}
          active={view.playTab}
          onPick={(playTab) => openGrowthPlay(objective, play.id, playTab)}
        />
        <div className="min-h-0 flex-1">{view.playTab === 'summary' ? <Summary play={play} /> : <TaskList play={play} />}</div>
      </div>
      <CopilotColumn subtitle={play.name} />
    </div>
  )
}
