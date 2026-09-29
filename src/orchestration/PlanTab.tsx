import { SIcon } from '@chargebee/sting-react'
import { isBrandMatched } from '../brand/matchSite'
import { templateLabel } from '../journey/templates'
import { V8 } from '../layout/layoutMode'
import { audienceLabel, useJourney } from '../store/useJourney'
import { useOrchestration } from '../store/useOrchestration'
import { useCancelSettings } from '../workspace/useCancelSettings'
import { openTab } from '../workspace/paneTabs'
import { useWorkspace } from '../workspace/useWorkspace'
import { useWorkspaceUi, type PaneTab } from '../workspace/useWorkspaceUi'
import { PlanSummary, cancelHandlingLine, flowLine, offerLine, shellLabel } from './JourneyPlan'
import { useSetupProgress } from './JourneySetupChrome'
import { jumpSetupItem } from './setupActions'
import type { SetupItemId } from './setupTracker'
import { splitLine } from './targeting/SplitEditor'

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
  plan: 'Plan',
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

/** v8: the plan, row by row. Screens edit in the Editor, control in settings, the rest in the chat. */
function PlanPage() {
  const file = useJourney((s) => s.file)
  const play = useOrchestration((s) => s.play)
  const title = useWorkspace((s) => s.threads.find((t) => t.id === s.activeId)?.title)
  const globalControl = useCancelSettings((s) => s.globalControl)
  const openSettings = useCancelSettings((s) => s.setSettingsOpen)
  const askBeat = useWorkspaceUi((s) => s.askBeat)
  const hasOffers = file.steps.some((s) => s.kind === 'offer')

  const rows: { label: string; value: string; onEdit: () => void }[] = [
    { label: 'Flow', value: flowLine(file) || templateLabel(file.template), onEdit: () => openTab('editor') },
    ...(hasOffers ? [{ label: 'Offers', value: offerLine(file), onEdit: () => askBeat('offers') }] : []),
    { label: 'Audience', value: audienceLabel(file.audience), onEdit: () => askBeat('audience') },
    { label: 'Tests', value: splitLine(play), onEdit: () => askBeat('tests') },
    { label: 'Shell', value: shellLabel(file.shell), onEdit: () => askBeat('shell') },
    { label: 'Cancel handling', value: cancelHandlingLine(file) ?? 'Not set', onEdit: () => askBeat('cancel') },
    {
      label: 'Brand',
      value: isBrandMatched(file.brand) ? 'Matched to your site' : 'Default look',
      onEdit: () => askBeat('brand'),
    },
    {
      label: 'Control',
      value: globalControl === 0 ? 'Global control is off' : `Global control, ${globalControl}% see no cancel page`,
      onEdit: () => openSettings(true),
    },
  ]

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-[720px] px-[28px] py-[24px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-[20px] py-[16px]">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Plan</p>
            <h2 className="mt-[4px] text-[18px] font-semibold text-slate-900">{title ?? file.name}</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {rows.map((row) => (
              <button
                key={row.label}
                type="button"
                onClick={row.onEdit}
                className="flex w-full items-center gap-[16px] px-[20px] py-[14px] text-left transition-colors hover:bg-slate-50"
              >
                <span className="w-[120px] flex-none text-[12.5px] font-medium text-slate-500">{row.label}</span>
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-slate-900">{row.value}</span>
                <span className="flex-none text-[12.5px] font-semibold text-indigo-600">Edit</span>
              </button>
            ))}
          </div>
        </section>
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
