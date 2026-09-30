import { useJourney } from '../store/useJourney'
import { useWorkspace } from '../workspace/useWorkspace'
import type { LibOffer, LibPricingTable } from './model'

export function useBrandColor(): string {
  const shared = useWorkspace((s) => s.brand?.primary)
  const current = useJourney((s) => s.file.brand.primary)
  return shared ?? current ?? '#4f46e5'
}

/** The offer as the subscriber sees it, in its widget. */
export function OfferPreview({ offer }: { offer: Pick<LibOffer, 'widget' | 'title' | 'description' | 'cta'> }) {
  const color = useBrandColor()
  const button = (
    <span className="inline-flex rounded-[8px] px-[14px] py-[7px] text-[12.5px] font-semibold text-white" style={{ backgroundColor: color }}>
      {offer.cta || 'Accept'}
    </span>
  )
  const frame = 'relative overflow-hidden rounded-[12px] border border-slate-200 bg-[#f5f7fa]'

  if (offer.widget === 'banner') {
    return (
      <div className={`${frame} h-[220px]`}>
        <div className="flex items-center justify-between gap-[12px] px-[16px] py-[10px] text-white" style={{ backgroundColor: color }}>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">{offer.title}</p>
            <p className="truncate text-[12px] opacity-90">{offer.description}</p>
          </div>
          <span className="flex-none rounded-[7px] bg-white px-[10px] py-[5px] text-[12px] font-semibold" style={{ color }}>
            {offer.cta || 'Accept'}
          </span>
        </div>
        <AppSkeleton />
      </div>
    )
  }

  if (offer.widget === 'popup') {
    return (
      <div className={`${frame} h-[260px]`}>
        <AppSkeleton />
        <div className="absolute bottom-[14px] right-[14px] w-[230px] rounded-[12px] bg-white p-[14px] shadow-[0_12px_32px_-8px_rgba(15,23,42,0.35)]">
          <p className="text-[13.5px] font-semibold text-slate-900">{offer.title}</p>
          <p className="mt-[4px] text-[12px] leading-[1.5] text-slate-600">{offer.description}</p>
          <div className="mt-[10px]">{button}</div>
        </div>
      </div>
    )
  }

  if (offer.widget === 'la_card') {
    return (
      <div className={`${frame} flex h-[260px] items-center justify-center p-[20px]`}>
        <div className="w-full max-w-[300px] rounded-[12px] border-2 bg-white p-[16px]" style={{ borderColor: color }}>
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color }}>
            Before you go
          </p>
          <p className="mt-[4px] text-[14px] font-semibold text-slate-900">{offer.title}</p>
          <p className="mt-[4px] text-[12.5px] leading-[1.5] text-slate-600">{offer.description}</p>
          <div className="mt-[12px]">{button}</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`${frame} h-[260px]`}>
      <AppSkeleton />
      <div className="absolute inset-0 flex items-center justify-center bg-slate-900/30 p-[20px]">
        <div className="w-full max-w-[300px] rounded-[14px] bg-white p-[18px] text-center shadow-[0_16px_40px_-12px_rgba(15,23,42,0.45)]">
          <p className="text-[15px] font-semibold text-slate-900">{offer.title}</p>
          <p className="mt-[6px] text-[12.5px] leading-[1.5] text-slate-600">{offer.description}</p>
          <div className="mt-[14px]">{button}</div>
          <p className="mt-[8px] text-[11.5px] text-slate-400">No thanks</p>
        </div>
      </div>
    </div>
  )
}

function AppSkeleton() {
  return (
    <div className="flex flex-col gap-[8px] p-[16px]" aria-hidden>
      <div className="h-[10px] w-[40%] rounded bg-slate-200" />
      <div className="h-[8px] w-[70%] rounded bg-slate-200/70" />
      <div className="mt-[6px] grid grid-cols-3 gap-[8px]">
        <div className="h-[60px] rounded-[8px] bg-white" />
        <div className="h-[60px] rounded-[8px] bg-white" />
        <div className="h-[60px] rounded-[8px] bg-white" />
      </div>
    </div>
  )
}

export function PricingPreview({ table }: { table: Pick<LibPricingTable, 'plans' | 'cta' | 'accent'> }) {
  const brand = useBrandColor()
  const color = table.accent ?? brand
  return (
    <div className="rounded-[12px] border border-slate-200 bg-[#f5f7fa] p-[16px]">
      <div
        className="grid gap-[10px]"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.min(table.plans.length, 4))}, minmax(0, 1fr))` }}
      >
        {table.plans.map((p) => (
          <div
            key={p.id}
            className="flex flex-col rounded-[12px] bg-white p-[14px]"
            style={p.highlight ? { boxShadow: `0 0 0 2px ${color}` } : { boxShadow: '0 0 0 1px #e2e8f0' }}
          >
            <p className="text-[13px] font-semibold text-slate-900">{p.name}</p>
            <p className="mt-[6px] text-[20px] font-bold text-slate-900">
              ${p.price}
              <span className="text-[12px] font-normal text-slate-500">/{p.period}</span>
            </p>
            <ul className="mt-[8px] flex flex-1 flex-col gap-[3px] text-[12px] text-slate-600">
              {p.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <span
              className="mt-[12px] rounded-[8px] px-[10px] py-[6px] text-center text-[12px] font-semibold text-white"
              style={{ backgroundColor: color }}
            >
              {table.cta === 'contact' ? 'Contact us' : 'Choose plan'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
