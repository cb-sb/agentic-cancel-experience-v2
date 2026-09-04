import type { ConfirmationComponent } from '../../types/experience'
import { uid } from '../../lib/id'
import { useRenderCtx } from '../RenderContext'
import { EditableText, InlineAddIconButton, InlineDeleteButton, useComponentEdit } from '../Editable'

function WarningBadge() {
  return (
    <div
      className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
      style={{ background: '#fef3c7' }}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
    </div>
  )
}

export function ConfirmationCard({ component }: { component: ConfirmationComponent }) {
  const { interactive, session, actions } = useRenderCtx()
  const set = useComponentEdit(component.id)
  const updateImpact = (id: string, patch: Record<string, unknown>) =>
    set({ impact: component.impact.map((it) => (it.id === id ? { ...it, ...patch } : it)) })
  const removeImpact = (id: string) =>
    set({ impact: component.impact.filter((it) => it.id !== id) })
  const addImpact = () =>
    set({ impact: [...component.impact, { id: uid('im'), label: 'New benefit', severity: 'amber' }] })

  return (
    <div className="flex h-full flex-col items-center justify-center py-6 text-center">
      <WarningBadge />
      <EditableText
        as="h2"
        value={component.title}
        onCommit={(v) => set({ title: v })}
        placeholder="Are you sure?"
        className="mt-5 text-2xl font-bold text-slate-900"
        style={{ fontFamily: 'var(--brand-font-heading)' }}
      />
      <EditableText
        as="p"
        value={component.subtitle}
        onCommit={(v) => set({ subtitle: v })}
        placeholder="Explain what happens next…"
        className="mx-auto mt-2 max-w-md text-sm leading-relaxed"
        style={{ color: 'var(--brand-text)' }}
      />

      {/* Benefits belong only to the "simple" variant — removable inline. */}
      {component.variant === 'simple' && (
        <ul className="mt-5 w-full max-w-sm space-y-2 text-left">
          {component.impact.map((item) => (
            <li key={item.id} className="group/item flex items-start gap-2.5 text-sm">
              <span
                className="mt-1.5 h-2 w-2 flex-none rounded-full"
                style={{ background: item.severity === 'red' ? '#dc2626' : '#f59e0b' }}
              />
              <span className="min-w-0 flex-1 text-slate-600">
                <span className="inline-flex max-w-full items-center gap-0.5 align-top">
                  <EditableText
                    value={item.label}
                    onCommit={(v) => updateImpact(item.id, { label: v })}
                    placeholder="Benefit"
                    singleLine
                  />
                  <InlineDeleteButton
                    onRemove={() => removeImpact(item.id)}
                    title="Remove benefit"
                    className="opacity-0 transition-opacity group-hover/item:opacity-100 group-focus-within/item:opacity-100"
                  />
                </span>
                {item.detail !== undefined && (
                  <EditableText
                    as="span"
                    value={item.detail}
                    onCommit={(v) => updateImpact(item.id, { detail: v })}
                    placeholder="Detail"
                    className="block text-[13px] text-slate-400"
                  />
                )}
              </span>
            </li>
          ))}
          <li className="flex items-center gap-1.5 pl-[18px]">
            <InlineAddIconButton onAdd={addImpact} title="Add benefit" />
          </li>
        </ul>
      )}

      {component.variant === 'consent' && (
        <label className="mx-auto mt-5 flex max-w-sm items-center justify-center gap-2.5 text-center text-sm text-slate-600">
          <input
            type="checkbox"
            checked={session.consentChecked}
            onChange={(e) => actions.setConsent(e.target.checked)}
            disabled={!interactive}
            className="mt-0.5"
          />
          <EditableText
            value={component.consentText ?? ''}
            onCommit={(v) => set({ consentText: v })}
            placeholder="Consent statement…"
          />
        </label>
      )}

      {component.variant === 'type_confirm' && (
        <div className="mt-5 w-full max-w-xs text-center">
          <label className="text-[13px] font-medium text-slate-600">
            Type <span className="font-bold">{component.confirmKeyword}</span> to confirm
          </label>
          <input
            value={session.confirmInput}
            onChange={(e) => actions.setConfirmInput(e.target.value)}
            readOnly={!interactive}
            placeholder={component.confirmKeyword}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
        </div>
      )}
    </div>
  )
}
