import type { PricingTableComponent } from '../../types/experience'
import { useRenderCtx } from '../RenderContext'
import { EditableText, useComponentEdit } from '../Editable'

export function PricingTable({ component }: { component: PricingTableComponent }) {
  const { interactive, mode, actions } = useRenderCtx()
  const set = useComponentEdit(component.id)

  const updatePlan = (id: string, patch: Record<string, unknown>) =>
    set({ plans: component.plans.map((p) => (p.id === id ? { ...p, ...patch } : p)) })

  return (
    <div className={`grid gap-4 ${component.plans.length > 2 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
      {component.plans.map((plan) => (
        <div
          key={plan.id}
          className="flex flex-col rounded-xl border bg-white p-5"
          style={{
            borderColor: plan.highlighted ? 'var(--brand-primary)' : '#e2e8f0',
            boxShadow: plan.highlighted ? '0 8px 24px -12px rgba(37,99,235,0.35)' : 'none',
          }}
        >
          {plan.highlighted && (
            <span
              className="mb-2 self-start rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
              style={{ background: 'var(--brand-primary)' }}
            >
              Recommended
            </span>
          )}
          <EditableText
            as="div"
            value={plan.name}
            onCommit={(v) => updatePlan(plan.id, { name: v })}
            singleLine
            className="text-sm font-semibold text-slate-500"
          />
          <div className="mt-1 flex items-baseline gap-1">
            <EditableText
              as="span"
              value={plan.price}
              onCommit={(v) => updatePlan(plan.id, { price: v })}
              singleLine
              className="text-3xl font-bold text-slate-900"
              style={{ fontFamily: 'var(--brand-font-heading)' }}
            />
            <span className="text-sm text-slate-400">{plan.cadence}</span>
          </div>
          <ul className="mt-4 flex-1 space-y-2">
            {plan.features.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                <span style={{ color: 'var(--brand-primary)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <EditableText
                  value={f}
                  onCommit={(v) =>
                    updatePlan(plan.id, {
                      features: plan.features.map((x, xi) => (xi === i ? v : x)),
                    })
                  }
                  singleLine
                />
              </li>
            ))}
          </ul>
          {mode === 'compose' ? (
            <div
              className="mt-5 w-full text-center text-sm font-semibold"
              style={{
                background: plan.highlighted ? 'var(--brand-primary)' : '#fff',
                color: plan.highlighted ? '#fff' : 'var(--brand-primary)',
                border: `1px solid var(--brand-primary)`,
                borderRadius: 'calc(var(--brand-radius) * 0.66)',
                padding: '10px 14px',
              }}
            >
              <EditableText
                value={plan.ctaLabel}
                onCommit={(v) => updatePlan(plan.id, { ctaLabel: v })}
                singleLine
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => interactive && actions.acceptOffer(component.id)}
              className="mt-5 w-full text-sm font-semibold"
              style={{
                background: plan.highlighted ? 'var(--brand-primary)' : '#fff',
                color: plan.highlighted ? '#fff' : 'var(--brand-primary)',
                border: `1px solid var(--brand-primary)`,
                borderRadius: 'calc(var(--brand-radius) * 0.66)',
                padding: '10px 14px',
                cursor: interactive ? 'pointer' : 'default',
              }}
              dangerouslySetInnerHTML={{ __html: plan.ctaLabel }}
            />
          )}
        </div>
      ))}
    </div>
  )
}
