import type { ReactNode } from 'react'
import { OFFER_VARIANTS, offerVariantLabel } from '../lib/offerVariants'
import {
  cancelStepCount,
  setStepOffer,
  switchTemplate,
  templateForCount,
  templateLabel,
} from '../journey/templates'
import type { AudienceKey, OfferKey } from '../journey/types'
import { audienceLabel, useJourney } from '../store/useJourney'
import type { ShellLayout } from '../types/experience'

const AUDIENCES: AudienceKey[] = ['all', 'paying', 'high_value', 'high_risk', 'annual', 'in_trial']

const SHELLS: { id: ShellLayout; label: string; hint: string }[] = [
  { id: 'modal', label: 'Modal', hint: 'Overlay on the merchant site' },
  { id: 'fullpage', label: 'Full page', hint: 'Hosted cancel page' },
  { id: 'fullpage_scroll', label: 'Scrolling page', hint: 'Full page that scrolls' },
]

const OFFER_KEYS = OFFER_VARIANTS.map((v) => v.category as OfferKey)

/**
 * The settings that used to live in side panels, as one plan the merchant
 * clicks through. Chat can still patch the file; this is how the rest is
 * configured without typing.
 */
export function JourneyPlan({
  onConfirm,
  onPreview,
  confirmed,
}: {
  onConfirm: () => void
  onPreview: () => void
  confirmed?: boolean
}) {
  const file = useJourney((s) => s.file)
  const replaceFile = useJourney((s) => s.replaceFile)
  const patchFile = useJourney((s) => s.patchFile)

  const authored = file.steps.filter(
    (s) => s.kind !== 'confirmation' && !s.kind.startsWith('outcome'),
  )
  const offerSteps = file.steps.filter((s) => s.kind === 'offer')
  const cancelCount = cancelStepCount(file.template)

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-3 py-2.5">
        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
          {confirmed ? 'Published plan' : 'Draft plan'}
        </div>
        <div className="mt-0.5 text-[14px] font-bold text-slate-900">{file.name}</div>
        <div className="mt-0.5 text-[11.5px] text-slate-500">
          {templateLabel(file.template)} · {audienceLabel(file.audience)}
        </div>
      </div>

      <div className="space-y-4 px-3 py-3">
        {file.kind === 'cancel' && cancelCount > 0 && (
          <PlanRow label="Steps" hint={templateLabel(file.template)}>
            <div className="flex items-center gap-2">
              <Stepper
                value={cancelCount}
                min={1}
                max={5}
                onChange={(n) => replaceFile(switchTemplate(file, templateForCount(n)))}
              />
              <span className="text-[12px] text-slate-500">
                {cancelCount} step{cancelCount === 1 ? '' : 's'}
              </span>
            </div>
          </PlanRow>
        )}

        <PlanRow label="Flow">
          <ol className="space-y-1">
            {authored.map((s, i) => (
              <li key={s.id} className="flex items-center gap-2 text-[12px] text-slate-700">
                <span className="flex h-4 w-4 flex-none items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold tabular-nums text-slate-500">
                  {i + 1}
                </span>
                <span className="font-semibold capitalize">{s.kind.replace(/_/g, ' ')}</span>
                {s.offer && (
                  <span className="truncate text-slate-400">{offerVariantLabel(s.offer)}</span>
                )}
              </li>
            ))}
          </ol>
        </PlanRow>

        {offerSteps.length > 0 && (
          <PlanRow label="Offers" hint="Click to swap — not a chat turn">
            <div className="space-y-1.5">
              {offerSteps.map((step, i) => (
                <select
                  key={step.id}
                  value={step.offer ?? 'discount'}
                  onChange={(e) =>
                    replaceFile({
                      ...file,
                      steps: setStepOffer(file.steps, step.id, e.target.value as OfferKey),
                    })
                  }
                  className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-slate-800 outline-none hover:border-slate-300 focus:border-slate-400"
                >
                  {OFFER_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {offerSteps.length > 1 ? `Offer ${i + 1}: ` : ''}
                      {offerVariantLabel(key)}
                    </option>
                  ))}
                </select>
              ))}
            </div>
          </PlanRow>
        )}

        <PlanRow label="Audience" hint="Who sees this">
          <MiniSelect
            value={AUDIENCES.indexOf(file.audience)}
            options={AUDIENCES.map(audienceLabel)}
            onChange={(i) => patchFile({ audience: AUDIENCES[i] })}
          />
        </PlanRow>

        <PlanRow label="Shell" hint="How it renders">
          <MiniSelect
            value={Math.max(0, SHELLS.findIndex((s) => s.id === file.shell))}
            options={SHELLS.map((s) => s.label)}
            onChange={(i) => patchFile({ shell: SHELLS[i].id })}
          />
          <div className="mt-1 text-[11px] text-slate-400">
            {SHELLS.find((s) => s.id === file.shell)?.hint}
          </div>
        </PlanRow>

        <PlanRow
          label="Holdout"
          hint={file.holdout === 0 ? 'Everyone in treatment' : `${file.holdout}% see nothing`}
        >
          <input
            type="range"
            min={0}
            max={50}
            step={5}
            value={file.holdout}
            onChange={(e) => patchFile({ holdout: Number(e.target.value) })}
            className="w-full accent-slate-800"
          />
        </PlanRow>

        <PlanRow label="Brand" hint="The knobs that used to be a side panel">
          <div className="space-y-2">
            <input
              value={file.brand.merchant}
              onChange={(e) => patchFile({ brand: { ...file.brand, merchant: e.target.value } })}
              placeholder="Merchant name"
              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px] text-slate-800 outline-none focus:border-slate-400"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-slate-600">Primary color</span>
              <div className="flex overflow-hidden rounded-lg border border-slate-200">
                <label className="relative block h-8 w-9 cursor-pointer" style={{ background: file.brand.primary }}>
                  <input
                    type="color"
                    value={file.brand.primary}
                    onChange={(e) => patchFile({ brand: { ...file.brand, primary: e.target.value } })}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </label>
                <input
                  value={file.brand.primary.toUpperCase()}
                  onChange={(e) => patchFile({ brand: { ...file.brand, primary: e.target.value } })}
                  spellCheck={false}
                  className="w-[86px] border-l border-slate-200 px-2 py-1.5 text-[12px] uppercase text-slate-600 outline-none"
                />
              </div>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] text-slate-600">Corner radius</span>
                <span className="text-[11px] tabular-nums text-slate-400">{file.brand.corners}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={24}
                step={1}
                value={file.brand.corners}
                onChange={(e) => patchFile({ brand: { ...file.brand, corners: Number(e.target.value) } })}
                className="mt-1 w-full accent-slate-800"
              />
            </div>
          </div>
        </PlanRow>
      </div>

      <div className="space-y-2 border-t border-slate-100 p-3">
        {!confirmed ? (
          <>
            <button
              type="button"
              onClick={onConfirm}
              className="w-full rounded-xl bg-slate-900 px-3 py-2.5 text-[13px] font-bold text-white hover:bg-slate-800"
            >
              Looks good
            </button>
            <button
              type="button"
              onClick={onPreview}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              Preview as subscriber
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onPreview}
            className="w-full rounded-xl bg-slate-900 px-3 py-2.5 text-[13px] font-bold text-white hover:bg-slate-800"
          >
            Preview as subscriber
          </button>
        )}
      </div>
    </div>
  )
}

function PlanRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
        {hint && <span className="truncate text-[10.5px] text-slate-400">{hint}</span>}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number
  min: number
  max: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex items-center overflow-hidden rounded-lg border border-slate-200">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        className="flex h-7 w-7 items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30"
      >
        −
      </button>
      <span className="w-6 text-center text-[12.5px] font-bold tabular-nums text-slate-900">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        className="flex h-7 w-7 items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30"
      >
        +
      </button>
    </div>
  )
}

function MiniSelect({
  value,
  options,
  onChange,
}: {
  value: number
  options: string[]
  onChange: (i: number) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-slate-800 outline-none hover:border-slate-300 focus:border-slate-400"
    >
      {options.map((o, i) => (
        <option key={o} value={i}>
          {o}
        </option>
      ))}
    </select>
  )
}
