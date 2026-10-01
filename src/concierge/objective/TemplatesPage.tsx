import { SButton } from '@chargebee/sting-react'
import { Chip } from '../../plays/ui'
import { TYPE_LABEL, type GrowthObjective } from '../model'
import { OfferPreview, PricingPreview } from '../Previews'
import { growthExperience } from '../useGrowthExperiences'
import { GROWTH_TYPES, startFromTemplate } from './actions'
import { previewOffer, previewTable, templatesFor } from './templates'
import { PageShell } from './ui'
import { setGrowthView, useGrowthView } from './useGrowthUi'

/** Starting points for in-app offers and pricing tables. Each one opens as an experience. */
export function TemplatesPage({ objective }: { objective: GrowthObjective }) {
  const view = useGrowthView(objective)
  const fill = view.fillId ? growthExperience(view.fillId) : undefined
  const type = fill ? fill.type : view.templateType
  const list = templatesFor(objective, type)

  return (
    <PageShell
      objective={objective}
      title="Templates"
      blurb={fill ? `Pick one for ${fill.name}.` : 'Starting points for in-app offers and pricing tables. Using one adds it to your Library.'}
      wide
    >
      {!fill && (
        <div className="mb-[16px] flex gap-[4px] text-[12.5px]">
          {(['all', ...GROWTH_TYPES] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setGrowthView(objective, { templateType: id })}
              className={`rounded-full px-[10px] py-[4px] ${type === id ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
            >
              {id === 'all' ? 'All' : `${TYPE_LABEL[id]}s`}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-[16px] min-[1000px]:grid-cols-2">
        {list.map((t) => (
          <article key={t.id} className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-start justify-between gap-[12px] px-[16px] pb-[12px] pt-[14px]">
              <div className="min-w-0">
                <div className="flex items-center gap-[8px]">
                  <p className="truncate text-[15px] font-semibold text-slate-900">{t.name}</p>
                  <Chip>{TYPE_LABEL[t.type]}</Chip>
                </div>
                <p className="mt-[2px] text-[13px] text-slate-500">{t.does}</p>
              </div>
              <SButton size="small" variant="neutral-outline" className="w-auto flex-none" onClick={() => startFromTemplate(objective, t, fill?.id ?? null)}>
                Use this template
              </SButton>
            </div>
            <div className="flex-1 border-t border-slate-100 bg-slate-50 p-[16px]">
              {t.type === 'pricing_table' ? <PricingPreview table={previewTable(t)} /> : <OfferPreview offer={previewOffer(t)} />}
            </div>
          </article>
        ))}
      </div>
    </PageShell>
  )
}
