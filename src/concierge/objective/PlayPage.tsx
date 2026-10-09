import { SButton, SIcon } from '@chargebee/sting-react'
import type { ReactNode } from 'react'
import { FRAME_FORM } from '../../layout/frames'
import { AngledTabs, PageHeader, ToolButton, ToolDivider } from '../../layout/SlgChrome'
import { PlayCanvas } from '../../plays/PlayCanvas'
import { PlayConfigure, RoutingTree, RulesList } from '../../plays/PlayConfigure'
import { PlaysBackendProvider } from '../../plays/PlaysBackend'
import { audienceText } from '../../plays/resolve'
import { Chip, InlineName, toast } from '../../plays/ui'
import { useWorkspaceUi } from '../../workspace/useWorkspaceUi'
import type { GrowthObjective } from '../model'
import { useGrowthExperiences } from '../useGrowthExperiences'
import { renameGrowthPlay, setGrowthPlayLive, useGrowthPlays, type GrowthPlay } from '../useGrowthPlays'
import { growthPlayChecks } from './actions'
import { growthBackend } from './growthBackend'
import { CopilotColumn } from './ui'
import { goGrowth, openGrowthExperience, openGrowthPlay, setGrowthView, setRenaming, useGrowthUi, useGrowthView, type PlayTab } from './useGrowthUi'

const PLAY_TABS: { id: PlayTab; label: string; hint: string }[] = [
  { id: 'configure', label: 'Configure', hint: 'Set up who sees this play and which experiences they get' },
  { id: 'summary', label: 'Summary', hint: 'Every setting for this play' },
  { id: 'tasks', label: 'Task list', hint: 'What has to pass before it can go live' },
]

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-[16px]">
      <h3 className="mb-[10px] text-[13px] font-semibold text-slate-900">{title}</h3>
      {children}
    </section>
  )
}

function Summary({ play }: { play: GrowthPlay }) {
  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className={`space-y-[16px] px-[28px] py-[24px] ${FRAME_FORM}`}>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Summary</p>
          <h2 className="mt-[4px] text-[18px] font-semibold text-slate-900">{play.name}</h2>
          <p className="mt-[4px] text-[13px] text-slate-500">Every setting for this play. Change them in Configure.</p>
        </div>
        <Block title={`Audience: ${audienceText(play.audience)}`}>
          <RulesList audience={play.audience} />
        </Block>
        <Block title="Routing">
          <RoutingTree play={play} />
        </Block>
        <Block title="Control group">
          <p className="text-[12.5px] text-slate-600">{growthBackend(play.objective).controlLine(play.control)}</p>
        </Block>
      </div>
    </div>
  )
}

function TaskList({ play }: { play: GrowthPlay }) {
  useGrowthExperiences((s) => s.items)
  const checks = growthPlayChecks(play)
  const open = checks.filter((c) => !c.passed).length
  const fix = (item: string) => {
    useWorkspaceUi.getState().setConfigureStep(play.id, item === 'control' ? 3 : 2)
    openGrowthPlay(play.objective, play.id, 'configure')
  }
  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className={`px-[28px] py-[24px] ${FRAME_FORM}`}>
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
              {!c.passed &&
                (c.openExperienceId ? (
                  <button type="button" onClick={() => openGrowthExperience(play.objective, c.openExperienceId!, play.id)} className="flex-none text-[12.5px] font-medium text-[#1a56db] hover:underline">
                    Open
                  </button>
                ) : (
                  <button type="button" onClick={() => fix(c.item)} className="flex-none text-[12.5px] font-medium text-[#1a56db] hover:underline">
                    Fix
                  </button>
                ))}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function GoLive({ play }: { play: GrowthPlay }) {
  useGrowthExperiences((s) => s.items)
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

/** A play's own workspace, the same as a Retention play: Configure, Summary and Task list, with Copilot on the right. */
export function PlayPage({ objective }: { objective: GrowthObjective }) {
  const view = useGrowthView(objective)
  const play = useGrowthPlays((s) => s.plays.find((p) => p.id === view.playId))
  const renaming = useGrowthUi((s) => s.renaming === play?.id)

  if (!play) {
    return <div className="flex h-full flex-1 items-center justify-center text-[13px] text-slate-500">This play was archived or deleted. Pick another from the left.</div>
  }

  return (
    <PlaysBackendProvider value={growthBackend(objective)}>
      <div className="flex h-full min-h-0 min-w-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex-none bg-white px-[16px] pt-[12px]">
            <PageHeader
              tabsAlign="start"
              title={
                <span className="min-w-0 max-w-[260px]">
                  <InlineName
                    value={play.name}
                    editing={renaming}
                    onStart={() => setRenaming(play.id)}
                    onDone={() => setRenaming(null)}
                    onCommit={(name) => renameGrowthPlay(play.id, name)}
                    className="font-[family-name:var(--slg-font-family-emphasis)] text-[16px] font-semibold leading-[24px] text-slate-900"
                    inputClassName="text-[15px] font-semibold"
                  />
                </span>
              }
              meta={[<Chip tone={play.status === 'live' ? 'emerald' : 'amber'}>{play.status === 'live' ? 'Live' : 'Draft'}</Chip>]}
              tabs={
                <AngledTabs
                  label="Play tabs"
                  value={view.playTab}
                  onChange={(tab) => openGrowthPlay(objective, play.id, tab)}
                  items={[
                    ...PLAY_TABS,
                    ...(view.canvasOpen
                      ? [
                          {
                            id: 'canvas' as const,
                            label: 'Canvas',
                            hint: 'Every variant, and a test with a subscriber',
                            onClose: () => setGrowthView(objective, { canvasOpen: false, playTab: view.playTab === 'canvas' ? 'configure' : view.playTab }),
                          },
                        ]
                      : []),
                  ]}
                />
              }
              actions={
                <>
                  <ToolButton icon="list-ordered" label="All plays" onClick={() => goGrowth(objective, { page: 'order' })}>
                    All plays
                  </ToolButton>
                  <ToolDivider />
                  <GoLive play={play} />
                </>
              }
            />
          </header>
          <div className="min-h-0 flex-1">
            {view.playTab === 'configure' && <PlayConfigure key={play.id} play={play} />}
            {view.playTab === 'canvas' && view.canvasOpen && <PlayCanvas key={play.id} play={play} />}
            {view.playTab === 'summary' && <Summary play={play} />}
            {view.playTab === 'tasks' && <TaskList play={play} />}
          </div>
        </div>
        <CopilotColumn subtitle={play.name} />
      </div>
    </PlaysBackendProvider>
  )
}
