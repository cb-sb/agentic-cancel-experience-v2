import { SIcon } from '@chargebee/sting-react'
import { V8 } from '../layout/layoutMode'
import { useJourney } from '../store/useJourney'
import { useCancelSettings } from '../workspace/useCancelSettings'
import { openTab } from '../workspace/paneTabs'
import { useWorkspace } from '../workspace/useWorkspace'
import { useWorkspaceUi, type PaneTab } from '../workspace/useWorkspaceUi'
import { ContextEditor } from './ContextEditor'
import { PlanSummary } from './JourneyPlan'
import { useSetupProgress } from './JourneySetupChrome'
import { jumpSetupItem } from './setupActions'
import type { SetupItemId } from './setupTracker'
import { useCopilotThread } from './copilotThread'
import { experienceRows, useSetupInputs, workspaceRows } from '../setup/progress'
import { SettingsSection } from '../setup/SettingsSection'

/** Where each setup row is fixed. Rows without a tab are answered in the chat. */
const ROW_TAB: Partial<Record<SetupItemId, PaneTab>> = {
  content: 'editor',
  survey: 'editor',
  offers: 'editor',
  confirmation: 'editor',
  stepConfig: 'editor',
  audience: 'targeting',
  experiment: 'targeting',
  walk: 'preview',
}

const TAB_NAME: Record<PaneTab, string> = {
  editor: 'Editor',
  canvas: 'Canvas',
  targeting: 'Targeting',
  preview: 'Preview',
  plan: V8 ? 'Summary' : 'Plan',
  tasks: 'Task list',
}

function goTo(id: SetupItemId) {
  if (id === 'holdout') {
    useCancelSettings.getState().setSettingsOpen(true)
    return
  }
  const tab = ROW_TAB[id]
  if (tab === 'preview') {
    openTab('preview')
    return
  }
  jumpSetupItem(id)
  if (tab) openTab(tab)
}

function rowAction(id: SetupItemId): string {
  if (id === 'holdout') return 'Settings'
  const tab = ROW_TAB[id]
  return tab ? TAB_NAME[tab] : 'Chat'
}

/** Summary edits leave a small line in the chat, so it knows what changed. */
function noteInChat(text: string) {
  useCopilotThread.getState().say('bot', text, { note: true })
}

/** v8: every decision for this experience, editable in place. */
function PlanPage() {
  const file = useJourney((s) => s.file)
  const activeId = useWorkspace((s) => s.activeId)
  const title = useWorkspace((s) => s.threads.find((t) => t.id === s.activeId)?.title)
  const inputs = useSetupInputs()
  const rows = experienceRows(activeId, inputs).filter((r) => r.entry.id !== 'layout' && r.entry.id !== 'brand')
  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-[720px] space-y-[20px] px-[28px] py-[24px]">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Summary</p>
          <h2 className="mt-[4px] text-[18px] font-semibold text-slate-900">{title ?? file.name}</h2>
          <p className="mt-[4px] text-[13px] text-slate-500">
            Every decision for this experience. Change anything here and the chat and Task list keep up.
          </p>
        </div>
        <ContextEditor confirmEdits page />
        {file.steps.length > 0 && (
          <>
            <SettingsSection title="Setup" hint="Offers, links and how the cancel is handled" rows={rows} onNote={noteInChat} />
            <SettingsSection title="Workspace" hint="Set once, used by every play" rows={workspaceRows(inputs)} onNote={noteInChat} />
          </>
        )}
      </div>
    </div>
  )
}

export function PlanTab() {
  if (V8) return <PlanPage />
  return <ReadinessPlan />
}

function ReadinessPlan() {
  const progress = useSetupProgress()
  const askBeat = useWorkspaceUi((s) => s.askBeat)

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto flex max-w-[720px] flex-col gap-[20px] px-[28px] py-[24px]">
        <PlanSummary onJump={askBeat} />

        <section className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-[16px] py-[12px]">
            <div className="flex items-baseline justify-between">
              <h3 className="text-[14px] font-semibold text-slate-900">Ready to publish</h3>
              <span className="text-[12px] tabular-nums text-slate-500">
                {progress.done} of {progress.total} done
              </span>
            </div>
            <div className="mt-[8px] h-[6px] overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress.percent}%` }} />
            </div>
          </div>
          {progress.groups.map((g) => (
            <div key={g.id} className="border-b border-slate-100 last:border-b-0">
              <p className="px-[16px] pb-[4px] pt-[12px] text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
                {g.title}
              </p>
              {g.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goTo(item.id)}
                  className="flex w-full items-center gap-[10px] px-[16px] py-[8px] text-left hover:bg-slate-50"
                >
                  <span
                    className={`flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full ${
                      item.info
                        ? 'border border-slate-200 text-slate-400'
                        : item.done
                          ? 'bg-emerald-500 text-white'
                          : 'border border-slate-300'
                    }`}
                  >
                    {item.info ? <SIcon name="info" size={11} /> : item.done ? <SIcon name="check" size={11} /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-slate-800">{item.label}</span>
                    <span className="block truncate text-[12px] text-slate-500">{item.hint}</span>
                  </span>
                  <span className="flex-none text-[12px] font-semibold text-indigo-600">{rowAction(item.id)}</span>
                </button>
              ))}
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
