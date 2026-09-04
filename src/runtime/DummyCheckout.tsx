import type { ExperienceComponent } from '../types/experience'
import { stripHtml } from '../render/Editable'

/**
 * Mock checkout that opens inside the cancel-experience container for
 * billing-altering offers (discounts, plan changes, add-ons, pricing tables).
 */
export function DummyCheckout({ component }: { component: ExperienceComponent | undefined }) {
  const isPricing = component?.kind === 'pricing_table'
  const isCheckout = component?.kind === 'checkout'
  const title =
    component?.kind === 'offer'
      ? stripHtml(component.title)
      : isPricing
        ? 'Switch your plan'
        : isCheckout
          ? stripHtml(component.title)
          : 'Update your subscription'

  const lineItem = isPricing ? 'Growth plan' : 'Pro plan'
  const basePrice = 49
  const discounted = component?.kind === 'offer' && component.category === 'discount' ? 24.5 : 29

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-5 text-center">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Secure checkout</div>
        <h3 className="mt-1 text-xl font-bold text-slate-900" style={{ fontFamily: 'var(--brand-font-heading)' }}>
          {title}
        </h3>
      </div>

      <div className="rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">{lineItem}</span>
          <span className="text-slate-500 line-through">${basePrice.toFixed(2)}/mo</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-slate-500">Applied offer</span>
          <span className="font-medium" style={{ color: 'var(--brand-accent)' }}>
            −${(basePrice - discounted).toFixed(2)}
          </span>
        </div>
        <div className="my-4 border-t border-dashed border-slate-200" />
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Due today</span>
          <span className="text-lg font-bold text-slate-900">${discounted.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Payment method</div>
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-11 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-500">
            VISA
          </div>
          <span className="text-sm text-slate-600">•••• •••• •••• 4242</span>
        </div>
      </div>

      <p className="mt-3 text-center text-[12px] text-slate-400">
        You won't be charged extra — this simply updates your existing subscription.
      </p>
    </div>
  )
}
