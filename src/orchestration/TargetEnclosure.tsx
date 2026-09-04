import { makeOffer, makePricingTable } from '../lib/factories'
import { brandStyle } from '../render/brand'
import { RenderProvider, defaultRenderActions, type RenderCtxValue } from '../render/RenderContext'
import { OfferCard } from '../render/components/OfferCard'
import { PricingTable } from '../render/components/PricingTable'
import { experienceBadge } from '../lib/experienceUtils'
import type { Experience } from '../types/experience'
import type { FlowNode, TargetType } from '../types/orchestration'
import type { DeviceKind, PlaySession } from '../store/useExperience'

function previewSession(): PlaySession {
  return {
    index: 0,
    selectedReasonId: null,
    reasonText: {},
    acceptedOfferId: null,
    checkout: { open: false, offerId: null },
    result: null,
    undone: false,
    confirmInput: '',
    consentChecked: false,
    feedback: '',
  }
}

const MOCK_BRANDING: Experience['branding'] = {
  merchantName: 'Acme SaaS',
  siteColor: '#f8fafc',
  cardColor: '#ffffff',
  cardFillType: 'solid',
  cardGradientFrom: '#ffffff',
  cardGradientTo: '#f1f5f9',
  cardGradientAngle: 135,
  cardBorderColor: '#e2e8f0',
  cardBorderType: 'solid',
  cardBorderGradientFrom: '#e2e8f0',
  cardBorderGradientTo: '#cbd5e1',
  cardBorderGradientAngle: 135,
  cardBorderWidth: 1,
  primaryColor: '#4f46e5',
  secondaryColor: '#0f172a',
  accentColor: '#6366f1',
  titleColor: '#0f172a',
  textColor: '#334155',
  mutedColor: '#64748b',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSizeBase: 15,
  fontLineHeight: 1.5,
  fontWeight: 400,
  letterSpacing: 0,
  textAlign: 'left',
  cornerRadius: 12,
  tone: 'Friendly-professional',
}

interface TargetEnclosureProps {
  flow: FlowNode
  target: TargetType
  selected: boolean
  onSelect: () => void
  /** Absent when this is the play's last remaining path. */
  onRemove?: () => void
  width: number
  device: DeviceKind
}

/** Compact enclosure for offer / pricing-table branch targets. */
export function TargetEnclosure({
  flow,
  target,
  selected,
  onSelect,
  onRemove,
  width,
  device,
}: TargetEnclosureProps) {
  const label = target === 'OFFER' ? 'Save offer' : 'Pricing table'
  const offer = makeOffer()
  const pricing = makePricingTable()

  const ctx: RenderCtxValue = {
    mode: 'compose',
    interactive: false,
    shell: 'modal',
    device,
    branding: MOCK_BRANDING,
    session: previewSession(),
    actions: defaultRenderActions,
    edit: null,
  }

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onSelect}
      style={{ width }}
      className={`rounded-2xl border-2 transition-all ${
        selected
          ? 'border-amber-500 bg-amber-50/40 shadow-md ring-2 ring-amber-500/20'
          : 'border-slate-300/80 bg-slate-50/60 hover:border-slate-400 hover:shadow-sm'
      }`}
    >
      <div
        className={`flex items-center gap-2 border-b px-3 py-2 ${
          selected ? 'border-amber-200/80 bg-amber-50/60' : 'border-slate-200/80 bg-white/70'
        }`}
      >
        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-amber-500 text-white">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v20M2 12h20" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-bold text-slate-900">{flow.name}</div>
          <div className="text-[10px] text-slate-400">{label}</div>
        </div>
        <span className="rounded-md bg-slate-200/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
          {experienceBadge(flow.id)}
        </span>
        {/* Standalone targets had no way off the canvas at all: the enclosure's
            toolbar belongs to experiences, and this is not one. */}
        <button
          type="button"
          title={
            onRemove ? 'Remove this path from the play' : 'A play needs at least one path'
          }
          disabled={!onRemove}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onRemove?.()
          }}
          className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:pointer-events-none disabled:opacity-40"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          </svg>
        </button>
      </div>
      <div className="p-3" style={{ ...brandStyle(MOCK_BRANDING), maxWidth: width - 24 }}>
        <RenderProvider value={ctx}>
          {target === 'OFFER' ? (
            <OfferCard component={offer} stacked />
          ) : (
            <PricingTable component={pricing} />
          )}
        </RenderProvider>
      </div>
    </div>
  )
}
