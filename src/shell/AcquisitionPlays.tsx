import { useState } from 'react'
import { SButton, SIcon, SSwitch } from '@chargebee/sting-react'
import { CANCEL_ROUTE, useGrowthShell } from './useGrowthShell'
import { useOrchestration } from '../store/useOrchestration'

const PLAYS = [
  {
    name: 'Trial to paid conversion',
    type: 'Modal',
    typeIcon: 'layout' as const,
    modified: '2 years ago',
  },
  {
    name: 'Premium Plan Trial Conversion to Ultimate',
    type: 'Pricing table',
    typeIcon: 'table' as const,
    modified: '2 years ago',
  },
]

/**
 * Growth Acquisition plays index — the live app's home, so Cancel experience
 * has a real door rather than dropping the merchant on a blank canvas.
 */
export function AcquisitionPlays() {
  const go = useGrowthShell((s) => s.go)
  const applyLibraryTemplate = useOrchestration((s) => s.applyLibraryTemplate)
  const [tab, setTab] = useState<'list' | 'dashboard' | 'trends'>('list')
  const [demo, setDemo] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pricing' | 'in_app'>('all')

  const rows =
    filter === 'pricing'
      ? PLAYS.filter((p) => p.type === 'Pricing table')
      : filter === 'in_app'
        ? PLAYS.filter((p) => p.type === 'Modal')
        : PLAYS

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <header className="flex flex-none items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-2">
          <h1 className="text-[20px] font-semibold tracking-tight text-slate-900">Acquisition plays</h1>
          <SIcon name="info" size={16} className="text-slate-400" />
        </div>
        <div className="flex flex-none items-center gap-3">
          <SSwitch label="Enable demo data" checked={demo} onCheckedChange={setDemo} />
          <SButton size="small" variant="neutral-outline" icon={<SIcon name="kanban" size={14} />}>
            Play Priority
          </SButton>
          <SButton
            size="small"
            variant="primary"
            icon={<SIcon name="plus" size={14} />}
            onClick={() => {
              go(CANCEL_ROUTE)
              applyLibraryTemplate('acquire_2')
            }}
          >
            Create New Play
          </SButton>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-6">
        <div className="flex flex-none items-center justify-between gap-4 border-b border-slate-200 pt-1">
          <div className="flex items-center gap-5 text-[13px] font-medium">
            {(
              [
                ['list', 'Play list'],
                ['dashboard', 'Dashboard'],
                ['trends', 'Trends'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`relative py-3 ${
                  tab === id ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {label}
                {tab === id && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-slate-900" />
                )}
              </button>
            ))}
          </div>
          <div className="max-w-md flex-1 px-6">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-center text-[12px] text-amber-900">
              Sample data shown here. Launch a play to view real data.
            </div>
          </div>
          <div className="flex items-center gap-1 text-[12.5px] text-slate-500">
            {(
              [
                ['all', 'All'],
                ['pricing', 'Pricing table'],
                ['in_app', 'In-app offer'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`rounded-full px-2.5 py-1 ${
                  filter === id ? 'bg-slate-100 font-medium text-slate-800' : 'hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab !== 'list' ? (
          <div className="flex flex-1 items-center justify-center text-[13px] text-slate-400">
            {tab === 'dashboard' ? 'Dashboard is sample data in this prototype.' : 'Trends is sample data in this prototype.'}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto py-4">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-[12px] font-medium text-slate-400">
                  <th className="w-10 pb-2 pl-1 font-medium">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Last modified</th>
                  <th className="w-10 pb-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((play) => (
                  <tr key={play.name} className="border-t border-slate-100">
                    <td className="py-3 pl-1">
                      <input type="checkbox" className="h-3.5 w-3.5 rounded border-slate-300" />
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        className="font-medium text-blue-600 hover:underline"
                        onClick={() => {
                          go(CANCEL_ROUTE)
                          applyLibraryTemplate('acquire_2')
                        }}
                      >
                        {play.name}
                      </button>
                    </td>
                    <td className="py-3 text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <SIcon name={play.typeIcon} size={14} className="text-slate-400" />
                        {play.type}
                      </span>
                    </td>
                    <td className="py-3 text-slate-400">—</td>
                    <td className="py-3 text-slate-500">{play.modified}</td>
                    <td className="py-3 pr-1 text-right">
                      <button type="button" className="rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700">
                        <SIcon name="ellipsis" size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button
              type="button"
              className="mt-6 flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50"
            >
              <span className="inline-flex items-center gap-2">
                <SIcon name="archive" size={14} className="text-slate-400" />
                Archive (2)
              </span>
              <SIcon name="chevron-down" size={14} className="text-slate-400" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
