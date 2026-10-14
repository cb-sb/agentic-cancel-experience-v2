import { V10_CHROME, V10_CHROME_BAND } from './V10Table'

const ROWS = [
  { name: 'Subscriber 1042', outcome: 'Saved', experience: 'Cancel page', when: '2 days ago' },
  { name: 'Subscriber 1088', outcome: 'Watch list', experience: 'Cancel page', when: '5 days ago' },
  { name: 'Subscriber 1101', outcome: 'Canceled', experience: 'Cancel page', when: '6 days ago' },
  { name: 'Subscriber 1130', outcome: 'Saved', experience: 'Cancel page', when: '9 days ago' },
]

/** The people who showed up. This sits with Reports, beside the totals. */
export function EngagedPage() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <header className={`flex ${V10_CHROME} flex-none items-end border-b border-slate-200 px-[28px]`}>
        <h1 className={`flex ${V10_CHROME_BAND} items-center text-[15px] font-semibold text-slate-900`}>Engaged subscribers</h1>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[880px] px-[28px] py-[28px]">
        <p className="max-w-[560px] text-[13px] text-slate-500">
          Subscribers who reached a cancel page, and what they did. Saved means they were still active 30 days later. Watch list means they left without cancelling, and that window is still open.
        </p>
        <div className="mt-[20px] overflow-hidden rounded-xl border border-slate-200">
          <div className="grid grid-cols-[minmax(0,1.4fr)_140px_minmax(0,1fr)_120px] gap-[12px] border-b border-slate-200 px-[16px] py-[8px] text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <span>Subscriber</span>
            <span>Outcome</span>
            <span>Experience</span>
            <span>When</span>
          </div>
          {ROWS.map((row) => (
            <div key={row.name} className="grid grid-cols-[minmax(0,1.4fr)_140px_minmax(0,1fr)_120px] items-center gap-[12px] border-b border-slate-100 px-[16px] py-[12px] text-[13px] last:border-b-0">
              <span className="truncate font-medium text-slate-900">{row.name}</span>
              <span className="text-slate-700">{row.outcome}</span>
              <span className="truncate text-slate-600">{row.experience}</span>
              <span className="text-slate-500">{row.when}</span>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  )
}
