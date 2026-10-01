import { SButton, SIcon, type SIconName } from '@chargebee/sting-react'
import { CopilotRail } from '../orchestration/CopilotRail'
import { SettingsSection } from '../setup/SettingsSection'
import { PlayTaskList } from '../setup/TaskList'
import { failing, playChecks } from '../setup/checks'
import { playRows, useSetupInputs, workspaceRows } from '../setup/progress'
import { useWorkspaceUi, type PlayTab, type PlayTabRef } from '../workspace/useWorkspaceUi'
import { closePlayTab, openAnotherPlayTab, openOrder } from './navigate'
import { PlayCanvas } from './PlayCanvas'
import { noteInPlayChat, PlayChat } from './PlayChat'
import { renamePlay, setPlayLive, usePlays } from './usePlays'
import { Chip, InlineName, RowMenu } from './ui'
import type { CancelPlay } from './types'
import { doInChat } from '../setup/actions'

const PLAY_TAB: Record<PlayTab, { label: string; icon: SIconName; hint: string }> = {
  canvas: { label: 'Canvas', icon: 'workflow', hint: 'Every variant, and a test with a subscriber' },
  summary: { label: 'Summary', icon: 'file-text', hint: 'Every setting for this play' },
  tasks: { label: 'Task list', icon: 'list-checks', hint: 'What has to pass, and every setting' },
}

function tabLabel(tabs: PlayTabRef[], ref: PlayTabRef): string {
  const same = tabs.filter((t) => t.kind === ref.kind)
  const base = PLAY_TAB[ref.kind].label
  return same.length > 1 ? `${base} ${same.indexOf(ref) + 1}` : base
}

function PlaySummary({ play }: { play: CancelPlay }) {
  const inputs = useSetupInputs()
  const rows = playRows(play.id, inputs)
  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-[720px] space-y-[20px] px-[28px] py-[24px]">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Summary</p>
          <h2 className="mt-[4px] text-[18px] font-semibold text-slate-900">{play.name}</h2>
          <p className="mt-[4px] text-[13px] text-slate-500">Every setting for this play. Change anything here and the chat and Task list keep up.</p>
        </div>
        <SettingsSection title="Who and how" hint="Audience, variants, split and control" rows={rows.filter((r) => r.entry.track === 'play')} onNote={(t) => noteInPlayChat(play.id, t)} />
        <SettingsSection title="Workspace" hint="Set once, used by every play" rows={workspaceRows(inputs)} onNote={(t) => noteInPlayChat(play.id, t)} />
      </div>
    </div>
  )
}

function GoLive({ play }: { play: CancelPlay }) {
  const inputs = useSetupInputs()
  const rows = playRows(play.id, inputs)
  const open = failing(playChecks(play.id, inputs))
  const blocked = play.status !== 'live' && open.length > 0
  const why = open.map((c) => c.label).join('. ')
  return (
    <div className="flex items-center gap-[8px]">
      <span title={blocked ? `Still to pass: ${why}` : undefined}>
        <SButton
          size="small"
          variant={play.status === 'live' ? 'neutral-outline' : 'primary'}
          className="w-auto"
          disabled={blocked}
          onClick={() => {
            if (play.status === 'live') return setPlayLive(play.id, false)
            const row = rows.find((r) => r.entry.id === 'goLive')
            if (row) doInChat(row)
          }}
        >
          {play.status === 'live' ? 'Pause' : 'Go live'}
        </SButton>
      </span>
    </div>
  )
}

/** A play's own workspace: tabs on the left, its Copilot on the right. */
export function PlayWorkspace() {
  const playId = useWorkspaceUi((s) => s.playId)
  const play = usePlays((s) => s.plays.find((p) => p.id === playId))
  const tabs = useWorkspaceUi((s) => (playId ? s.playTabs[playId] : undefined))
  const renaming = useWorkspaceUi((s) => s.renaming === playId)
  const collapsed = useWorkspaceUi((s) => s.copilotCollapsed)

  if (!play) {
    return (
      <div className="flex h-full flex-1 items-center justify-center text-[13px] text-slate-500">
        This play was deleted. Pick another from the left.
      </div>
    )
  }
  const open = tabs?.open ?? []
  const active = open.find((t) => t.id === tabs?.active) ?? open[0] ?? null
  const setActive = (id: string) => useWorkspaceUi.getState().setPlayTabs(play.id, { open, active: id })

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-[52px] flex-none items-center gap-[10px] border-b border-slate-200 px-[16px]">
          <SIcon name="workflow" size={15} className="flex-none text-slate-500" />
          <InlineName
            value={play.name}
            editing={renaming}
            onStart={() => useWorkspaceUi.getState().setRenaming(play.id)}
            onDone={() => useWorkspaceUi.getState().setRenaming(null)}
            onCommit={(name) => renamePlay(play.id, name)}
            className="text-[15px] font-semibold text-slate-900"
            inputClassName="text-[15px] font-semibold"
          />
          <Chip tone={play.status === 'live' ? 'emerald' : 'amber'}>{play.status === 'live' ? 'Live' : 'Draft'}</Chip>
          <div className="flex-1" />
          <button type="button" onClick={openOrder} className="inline-flex items-center gap-[5px] rounded-lg px-[8px] py-[5px] text-[12px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800">
            <SIcon name="list-ordered" size={13} /> Play order
          </button>
          <GoLive play={play} />
        </header>
        <div role="tablist" aria-label="Play tabs" className="flex h-[40px] flex-none items-center gap-[2px] border-b border-slate-200 px-[10px]">
          {open.map((ref) => {
            const on = ref.id === active?.id
            const meta = PLAY_TAB[ref.kind]
            return (
              <div key={ref.id} className={`group flex h-[30px] items-center rounded-lg ${on ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={on}
                  title={meta.hint}
                  onClick={() => setActive(ref.id)}
                  onAuxClick={(e) => e.button === 1 && open.length > 1 && closePlayTab(play.id, ref.id)}
                  className={`flex items-center gap-[6px] pl-[10px] pr-[4px] text-[12.5px] font-semibold ${on ? 'text-slate-900' : 'text-slate-500'}`}
                >
                  <SIcon name={meta.icon} size={13} />
                  {tabLabel(open, ref)}
                </button>
                {open.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Close ${tabLabel(open, ref)}`}
                    onClick={() => closePlayTab(play.id, ref.id)}
                    className="mr-[4px] flex h-[18px] w-[18px] items-center justify-center rounded text-slate-400 opacity-0 hover:bg-slate-200 hover:text-slate-700 group-hover:opacity-100"
                  >
                    <SIcon name="x" size={11} />
                  </button>
                )}
              </div>
            )
          })}
          <div className="relative">
            <RowMenu
              label="Open a tab"
              icon="plus"
              align="left"
              items={(Object.keys(PLAY_TAB) as PlayTab[]).map((kind) => ({
                label: PLAY_TAB[kind].label,
                icon: PLAY_TAB[kind].icon,
                hint: PLAY_TAB[kind].hint,
                onClick: () => openAnotherPlayTab(play.id, kind, active?.id),
              }))}
            />
          </div>
        </div>
        <div className="min-h-0 flex-1">
          {active?.kind === 'canvas' && <PlayCanvas key={active.id} play={play} />}
          {active?.kind === 'summary' && <PlaySummary key={active.id} play={play} />}
          {active?.kind === 'tasks' && <PlayTaskList key={active.id} playId={play.id} />}
          {!active && (
            <div className="flex h-full items-center justify-center text-[13px] text-slate-500">Open a tab with the + above.</div>
          )}
        </div>
      </div>
      <div
        className={`flex min-h-0 flex-none flex-col border-l border-slate-200 ${collapsed ? 'w-[48px]' : 'w-[clamp(340px,30%,460px)]'}`}
      >
        {collapsed && <CopilotRail />}
        <div className={collapsed ? 'hidden' : 'flex min-h-0 flex-1 flex-col'}>
          <PlayChat play={play} />
        </div>
      </div>
    </div>
  )
}
