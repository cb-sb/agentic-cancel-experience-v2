import { useMerchantLibrary } from '../store/useMerchantLibrary'
import { CB_KIND_LABELS, type CbKind } from '../upload/contract'
import type { MerchantComponent, MerchantTemplate } from '../library/types'

export function YoursBrowse({
  onApplyJourney,
  onApplyComponent,
  onUpload,
  compact,
}: {
  onApplyJourney: (id: string) => void
  onApplyComponent: (id: string) => void
  onUpload: () => void
  compact?: boolean
}) {
  const templates = useMerchantLibrary((s) => s.templates)
  const components = useMerchantLibrary((s) => s.components)
  const removeTemplate = useMerchantLibrary((s) => s.removeTemplate)

  if (templates.length === 0 && components.length === 0) {
    return (
      <div className={compact ? 'px-[4px] py-[16px]' : 'px-6 py-10'}>
        <p className="text-[14px] font-semibold text-slate-800">No saved templates yet</p>
        <p className="mt-[6px] text-[13px] leading-relaxed text-slate-500">
          Scan a marked HTML pack. After Copilot reviews the contract, the journey and each primitive land here.
        </p>
        <button
          type="button"
          onClick={onUpload}
          className="mt-[14px] rounded-xl bg-slate-900 px-[14px] py-[8px] text-[13px] font-semibold text-white hover:bg-slate-800"
        >
          Upload a template
        </button>
      </div>
    )
  }

  return (
    <div className={compact ? 'flex flex-col gap-[16px]' : 'min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5'}>
      {templates.length > 0 && (
        <section>
          <p className="mb-[10px] text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Journeys
          </p>
          <div className="space-y-[10px]">
            {templates.map((t) => (
              <JourneyCard
                key={t.id}
                template={t}
                onApply={() => onApplyJourney(t.id)}
                onRemove={() => removeTemplate(t.id)}
              />
            ))}
          </div>
        </section>
      )}
      {components.length > 0 && (
        <section>
          <p className="mb-[10px] text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Components
          </p>
          <p className="mb-[10px] text-[12.5px] text-slate-500">
            Shared library objects. Attach onto an existing chain, or open one as a single step.
          </p>
          <div className="grid grid-cols-1 gap-[8px] sm:grid-cols-2">
            {components.map((c) => (
              <ComponentCard key={c.id} component={c} onApply={() => onApplyComponent(c.id)} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function JourneyCard({
  template,
  onApply,
  onRemove,
}: {
  template: MerchantTemplate
  onApply: () => void
  onRemove: () => void
}) {
  const kindLabel = template.kind === 'acquisition' ? 'Acquire' : 'Cancel'
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-[16px] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-[12px]">
        <div>
          <div className="text-[14px] font-bold text-slate-900">{template.name}</div>
          <div className="mt-[4px] text-[12px] font-medium text-slate-500">
            {template.stepLabels.join(' → ')} · {kindLabel}
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="text-[12px] font-semibold text-slate-400 hover:text-rose-600"
        >
          Remove
        </button>
      </div>
      <button
        type="button"
        onClick={onApply}
        className="mt-[12px] text-[12.5px] font-semibold text-indigo-600 hover:text-indigo-700"
      >
        Use this template →
      </button>
    </div>
  )
}

function ComponentCard({
  component,
  onApply,
}: {
  component: MerchantComponent
  onApply: () => void
}) {
  return (
    <button
      type="button"
      onClick={onApply}
      className="rounded-2xl border border-slate-200/90 bg-white p-[14px] text-left hover:border-slate-300 hover:shadow-[0_12px_28px_-18px_rgba(15,23,42,0.35)]"
    >
      <div className="text-[13px] font-bold text-slate-900">
        {CB_KIND_LABELS[component.kind as CbKind] ?? component.label}
      </div>
      <div className="mt-[4px] text-[12px] text-slate-500">Reusable on other experiences</div>
      <div className="mt-[8px] text-[12px] font-semibold text-indigo-600">Use this component →</div>
    </button>
  )
}
