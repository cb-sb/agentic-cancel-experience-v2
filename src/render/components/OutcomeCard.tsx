import type { OutcomeComponent } from '../../types/experience'
import type { PlayResult } from '../../store/useExperience'
import { useRenderCtx } from '../RenderContext'
import { BrandButton } from '../BrandUI'
import { EditableCTA, EditableText, useComponentEdit } from '../Editable'

function SuccessBadge({ saved }: { saved: boolean }) {
  return (
    <div
      className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
      style={{ background: saved ? '#dcfce7' : '#e0e7ff' }}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={saved ? '#16a34a' : '#4f46e5'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </div>
  )
}

/**
 * The post-confirmation outcome. In Compose it is edited inline (its own step /
 * tab). In Play it is shown by PlayerShell once a result is set, adapting its
 * copy to the result (kept / saved / cancelled) and the chosen variant.
 */
export function OutcomeCard({
  component,
  result = null,
  onUndo,
}: {
  component: OutcomeComponent
  result?: PlayResult | null
  onUndo?: () => void
}) {
  const { mode, interactive, session, actions } = useRenderCtx()
  const set = useComponentEdit(component.id)

  // ---- Compose: edit the (cancelled) outcome inline --------------------------
  if (mode === 'compose') {
    return (
      <div className="flex h-full flex-col items-center justify-center py-8 text-center">
        <SuccessBadge saved={component.forResult === 'saved'} />
        <EditableText
          as="h2"
          value={component.headline}
          onCommit={(v) => set({ headline: v })}
          placeholder="Outcome headline"
          maxChars={60}
          className="mx-auto mt-5 text-2xl font-bold text-slate-900"
          style={{ fontFamily: 'var(--brand-font-heading)' }}
        />
        <EditableText
          as="p"
          value={component.body ?? ''}
          onCommit={(v) => set({ body: v })}
          placeholder="Add a short message about what happens next…"
          maxChars={180}
          className="mx-auto mt-2 max-w-md text-sm leading-relaxed"
          style={{ color: 'var(--brand-text)' }}
        />

        {component.variant === 'reactivation' && (
          <div className="mt-6">
            <EditableCTA
              label={component.undoCta ?? 'Undo — restore my plan'}
              onCommit={(v) => set({ undoCta: v })}
              maxChars={32}
              className="text-sm font-semibold text-white"
              style={{
                background: 'var(--brand-accent)',
                borderRadius: 'calc(var(--brand-radius) * 0.66)',
                padding: '11px 20px',
              }}
            />
            <p className="mt-2 text-[12px] text-slate-400">You can restore anytime in the next 30 days.</p>
          </div>
        )}

        {component.variant === 'feedback' && (
          <div className="mx-auto mt-7 w-full max-w-sm text-left">
            <EditableText
              as="label"
              value={component.feedbackPrompt ?? ''}
              onCommit={(v) => set({ feedbackPrompt: v })}
              placeholder="Feedback prompt"
              singleLine
              maxChars={80}
              className="text-[13px] font-medium text-slate-600"
            />
            <textarea
              readOnly
              rows={3}
              placeholder="The subscriber’s feedback appears here…"
              className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-400 outline-none"
            />
          </div>
        )}
      </div>
    )
  }

  // ---- Play ----------------------------------------------------------------
  // The card is picked by result upstream, so what it says is what the merchant
  // wrote on it. The one substitution left is a subscriber who kept their plan
  // outright: they reach the saved terminal without an offer having been
  // applied, so copy about an applied offer would be a lie.
  const saved = result === 'saved' || result === 'kept'
  const headline =
    result === 'kept' ? "You're all set — nothing has changed" : component.headline
  const body =
    result === 'kept'
      ? 'Your subscription is unchanged and every feature stays right where it was.'
      : component.body

  return (
    <div className="flex h-full flex-col items-center justify-center py-8 text-center">
      <SuccessBadge saved={saved} />
      <h2 className="mt-5 text-2xl font-bold text-slate-900" style={{ fontFamily: 'var(--brand-font-heading)' }}>
        {session.undone ? 'Welcome back — your plan is restored' : headline}
      </h2>
      {body && !session.undone && (
        <p className="mt-2 max-w-md text-sm leading-relaxed" style={{ color: 'var(--brand-text)' }}>
          {body}
        </p>
      )}

      {!saved && !session.undone && component.variant === 'reactivation' && (
        <div className="mt-6">
          <BrandButton
            variant="primary"
            style={{ background: 'var(--brand-accent)' }}
            onClick={() => interactive && onUndo?.()}
          >
            {component.undoCta ?? 'Undo — restore my plan'}
          </BrandButton>
          <p className="mt-2 text-[12px] text-slate-400">You can restore anytime in the next 30 days.</p>
        </div>
      )}

      {!saved && !session.undone && component.variant === 'feedback' && (
        <div className="mt-7 w-full max-w-sm text-left">
          <label className="text-[13px] font-medium text-slate-600">{component.feedbackPrompt}</label>
          <textarea
            value={session.feedback}
            onChange={(e) => actions.setFeedback(e.target.value)}
            readOnly={!interactive}
            rows={3}
            className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
        </div>
      )}
    </div>
  )
}
