import { useMemo, useState } from 'react'
import { SIcon } from '@chargebee/sting-react'
import { StatusChip } from '../../layout/StatusChip'
import { ago } from '../../layout/ThreadSidebar'
import { DropdownButton } from '../../plays/ui'
import { TYPE_LABEL, type GrowthObjective, type GrowthType } from '../model'
import { experiencesFor, useGrowthExperiences } from '../useGrowthExperiences'
import { growthExperienceLive, useGrowthPlays } from '../useGrowthPlays'
import { GROWTH_TYPES, newExperienceItems } from './actions'
import { Empty, PageShell } from './ui'
import { openGrowthExperience } from './useGrowthUi'

export const SEARCH_ID = 'growth-experience-search'

export function ExperiencesPage({ objective }: { objective: GrowthObjective }) {
  const items = useGrowthExperiences((s) => s.items)
  const plays = useGrowthPlays((s) => s.plays)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<GrowthType | 'all'>('all')

  const playLine = useMemo(() => {
    const names = new Map<string, string[]>()
    for (const p of plays) for (const v of p.variants) names.set(v.experienceId, [...(names.get(v.experienceId) ?? []), p.name])
    return (id: string) => {
      const n = names.get(id) ?? []
      if (n.length === 0) return 'Not in a play'
      return n.length === 1 ? n[0] : `${n[0]} and ${n.length - 1} more`
    }
  }, [plays])

  const q = query.trim().toLowerCase()
  const all = experiencesFor(items, objective)
  const rows = all.filter((x) => (filter === 'all' || x.type === filter) && (!q || x.name.toLowerCase().includes(q)))

  return (
    <PageShell
      objective={objective}
      title="Experiences"
      actions={
        <>
          <div className="flex h-[28px] w-[300px] min-w-[160px] shrink items-center gap-[8px] rounded-md border border-slate-200 bg-white px-[10px] transition-colors hover:border-slate-300 focus-within:border-slate-400">
            <SIcon name="search" size={14} className="flex-none text-slate-400" />
            <input
              id={SEARCH_ID}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search experiences"
              aria-label="Search experiences"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-800 outline-none placeholder:text-slate-400"
            />
          </div>
          <DropdownButton label="New" items={newExperienceItems(objective)} />
        </>
      }
    >
      <div className="flex gap-[4px] text-[12.5px]">
        {(['all', ...GROWTH_TYPES] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-full px-[10px] py-[4px] ${filter === id ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
          >
            {id === 'all' ? 'All' : `${TYPE_LABEL[id]}s`}
          </button>
        ))}
      </div>
      <div className="mt-[12px]">
        {rows.length === 0 ? (
          <Empty>{q ? 'Nothing matches that search.' : 'Nothing here yet. Use New to make the first one.'}</Empty>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-slate-200">
            {rows.map((x) => (
              <li key={x.id} className="border-t border-slate-100 first:border-t-0">
                <button
                  type="button"
                  onClick={() => openGrowthExperience(objective, x.id)}
                  className="flex w-full items-center gap-[16px] px-[16px] py-[10px] text-left transition-colors hover:bg-slate-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-[8px]">
                      <span className="truncate text-[13.5px] font-medium text-slate-900">{x.name}</span>
                      {growthExperienceLive(x.id, plays) && <StatusChip live />}
                    </span>
                    <span className="block truncate text-[12.5px] text-slate-500">
                      {TYPE_LABEL[x.type]} · {playLine(x.id)}
                    </span>
                  </span>
                  <span className="flex-none text-[12.5px] text-slate-400">{ago(x.updatedAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  )
}
