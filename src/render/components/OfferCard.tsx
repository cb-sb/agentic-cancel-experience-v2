import { useState } from 'react'
import type { MediaAsset, OfferComponent } from '../../types/experience'
import { useRenderCtx } from '../RenderContext'
import { surfaceStyleCss } from '../brand'
import { EditableCTA, EditableText, useComponentEdit } from '../Editable'
import { MediaBlock } from './MediaBlock'

const DEFAULT_CONSENT_STATEMENT =
  'I understand this offer replaces my current plan and agree to the updated terms.'

/** Baseline offer-card appearance before merchant overrides. */
const OFFER_STYLE_DEFAULTS = {
  fillColor: '#ffffff',
  strokeColor: '#e6e9ef',
  strokeWidth: 1,
  shadow: 'lg',
} as const

function SwapSidesButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Swap media side"
      aria-label="Swap media side"
      className="absolute right-3 top-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-500 shadow-sm backdrop-blur transition-colors hover:border-blue-300 hover:text-blue-600"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
      </svg>
    </button>
  )
}

function ConfigButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Configure offer"
      aria-label="Configure offer"
      className="absolute -left-2.5 -top-2.5 z-20 hidden h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md ring-2 ring-white transition-colors hover:border-blue-300 hover:text-blue-600 group-hover:flex"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </svg>
    </button>
  )
}

/** Chip listing which survey reasons route to this offer (compose only). */
function LinkedReasonsBadge({
  reasons,
  color,
}: {
  reasons: { id: string; label: string }[]
  color: string
}) {
  return (
    <div
      className="mb-3 flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
      style={{ borderColor: color, background: `${color}14` }}
    >
      <span className="h-2 w-2 flex-none rounded-full" style={{ background: color }} />
      <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color }}>
        Shown for
      </span>
      <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-slate-600">
        {reasons.map((r) => r.label).join(', ')}
      </span>
    </div>
  )
}

export function OfferCard({ component, stacked = false }: { component: OfferComponent; stacked?: boolean }) {
  const { interactive, mode, actions, mapping } = useRenderCtx()
  const compose = mode === 'compose'
  const set = useComponentEdit(component.id)
  const [consentChecked, setConsentChecked] = useState(false)

  const linkedReasons = mapping?.reasonsByOffer[component.id] ?? []
  const offerColor = mapping?.colorForOffer(component.id) ?? '#94a3b8'

  const onMediaChange = (patch: Partial<MediaAsset>) =>
    set({ media: { type: 'image', ...(component.media ?? {}), ...patch } })

  const consentRequired = !!component.consentEnabled
  const ctaDisabled = interactive && consentRequired && !consentChecked

  // Media is part of the standalone-offer template. In Play we collapse to a
  // single column when nothing has been uploaded yet (no empty placeholder).
  const showMedia = !!component.media && (compose || !!component.media.url)
  const mediaSide = component.mediaSide ?? 'right'
  const mediaEl = showMedia ? (
    <MediaBlock media={component.media!} onChange={onMediaChange} aspect="portrait" />
  ) : null

  const content = (
    <div className={`flex min-w-0 flex-col justify-center ${stacked ? '' : 'flex-[1.35]'}`}>
      {compose && mapping && linkedReasons.length > 0 && (
        <LinkedReasonsBadge reasons={linkedReasons} color={offerColor} />
      )}
      {component.eyebrow && (
        <EditableText
          value={component.eyebrow}
          onCommit={(v) => set({ eyebrow: v })}
          placeholder="Eyebrow"
          singleLine
          maxChars={32}
          className="mb-2 text-[11px] font-bold uppercase tracking-wider"
          style={{ color: 'var(--brand-accent)' }}
        />
      )}
      <EditableText
        as="h3"
        value={component.title}
        onCommit={(v) => set({ title: v })}
        placeholder="Offer headline"
        maxChars={42}
        className="text-2xl font-bold leading-tight text-slate-900"
        style={{ fontFamily: 'var(--brand-font-heading)' }}
      />
      <EditableText
        as="p"
        value={component.description}
        onCommit={(v) => set({ description: v })}
        placeholder="Describe the offer…"
        maxChars={130}
        className="mt-2 text-sm leading-relaxed text-slate-500"
      />

      <div className="mt-5">
        {/* CTA hugs its text — never full width. */}
        <EditableCTA
          label={component.primaryCta}
          onCommit={(v) => set({ primaryCta: v })}
          onClick={() => interactive && !ctaDisabled && actions.acceptOffer(component.id)}
          disabled={ctaDisabled}
          maxChars={28}
          className="text-sm font-semibold text-white"
          style={{
            background: 'var(--brand-accent)',
            borderRadius: 'calc(var(--brand-radius) * 0.66)',
            padding: '11px 20px',
          }}
        />
        {component.downgradeLink && (
          <div className="mt-3">
            <EditableCTA
              label={component.downgradeLink}
              onCommit={(v) => set({ downgradeLink: v })}
              onClick={() => interactive && actions.acceptOffer(component.id)}
              maxChars={46}
              className="text-[13px] font-medium text-slate-600 underline decoration-slate-300 underline-offset-2"
              style={{ padding: '2px 2px' }}
            />
          </div>
        )}
      </div>

      {consentRequired && (
        <div className="mt-4 flex items-start gap-2 border-t border-orange-200/60 pt-3">
          {compose ? (
            <>
              <span
                aria-hidden
                className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border border-slate-300 bg-slate-100"
              />
              <EditableText
                as="p"
                value={component.consentStatement ?? DEFAULT_CONSENT_STATEMENT}
                onCommit={(v) => set({ consentStatement: v })}
                placeholder="Consent statement…"
                maxChars={120}
                className="min-w-0 text-[12px] leading-snug text-slate-500"
              />
            </>
          ) : (
            <label className="flex min-w-0 cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 shrink-0"
              />
              <span className="text-[12px] leading-snug text-slate-500">
                {component.consentStatement ?? DEFAULT_CONSENT_STATEMENT}
              </span>
            </label>
          )}
        </div>
      )}
    </div>
  )

  // Side-by-side on tablet/desktop; stack only on mobile. Portrait media uses a
  // fixed 4:5 box so the card height stays driven by the text column.
  const mediaColumn = mediaEl && (
    <div
      className={
        stacked
          ? 'min-w-0'
          : 'flex w-[140px] min-w-[120px] max-w-[150px] shrink-0 flex-col justify-center self-center'
      }
    >
      {mediaEl}
    </div>
  )

  return (
    <div
      data-offer-anchor={compose && mapping ? `${mapping.experienceId}:${component.id}` : undefined}
      className="relative flex flex-col p-6"
      style={{
        borderRadius: 'calc(var(--brand-radius) * 0.9)',
        ...surfaceStyleCss(component.cardStyle, OFFER_STYLE_DEFAULTS),
      }}
    >
      {compose && mapping && <ConfigButton onClick={() => mapping.configureOffer(component.id)} />}
      {compose && showMedia && (
        <SwapSidesButton onClick={() => set({ mediaSide: mediaSide === 'left' ? 'right' : 'left' })} />
      )}
      {mediaColumn ? (
        <div className={`flex gap-5 ${stacked ? 'flex-col' : 'flex-row items-center'}`}>
          {mediaSide === 'left' ? (
            <>
              {mediaColumn}
              {content}
            </>
          ) : (
            <>
              {content}
              {mediaColumn}
            </>
          )}
        </div>
      ) : (
        content
      )}
    </div>
  )
}
