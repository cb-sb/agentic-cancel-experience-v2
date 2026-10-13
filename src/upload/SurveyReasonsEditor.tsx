import { SIcon } from '@chargebee/sting-react'
import { useEffect, useRef, useState } from 'react'
import { uid } from '../lib/id'
import type { ManifestOffer, ManifestReason, ManifestSettings, SurveyConfiguration } from './manifestSettings'

function Switch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[18px] w-[30px] flex-none rounded-full transition-colors disabled:cursor-not-allowed ${
        checked ? 'bg-[#0b5cd6]' : 'bg-slate-300'
      } ${disabled ? 'opacity-40' : ''}`}
    >
      <span
        className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-[left] ${
          checked ? 'left-[14px]' : 'left-[2px]'
        }`}
      />
    </button>
  )
}

function SharedBadge() {
  return (
    <span className="ml-[6px] inline-flex align-middle rounded-[3px] bg-[#e5efff] px-[5px] py-[1px] text-[10.5px] font-medium leading-[14px] text-[#0b5cd6]">
      Shared
    </span>
  )
}

function OfferSelect({
  value,
  offers,
  disabled,
  label,
  onChange,
}: {
  value: string | null
  offers: ManifestOffer[]
  disabled: boolean
  label: string
  onChange: (offerId: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = offers.find((offer) => offer.id === value)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  const pick = (offerId: string | null) => {
    onChange(offerId)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="flex h-[30px] w-full items-center justify-between gap-[8px] border border-slate-200 bg-white px-[8px] text-left text-[12.5px] text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
      >
        <span className={`truncate ${current ? '' : 'text-slate-500'}`}>{current?.offerName ?? 'None'}</span>
        {!disabled && <SIcon name="chevron-down" size={14} />}
      </button>
      {open && (
        <ul role="listbox" className="absolute left-0 right-0 top-[32px] z-20 border border-slate-200 bg-white py-[4px] shadow-md">
          <li>
            <button
              type="button"
              role="option"
              aria-selected={!current}
              onClick={() => pick(null)}
              className={`flex w-full items-center px-[10px] py-[5px] text-left text-[12.5px] hover:bg-slate-50 ${!current ? 'bg-[#eef4ff] text-[#0b5cd6]' : 'text-slate-800'}`}
            >
              None
            </button>
          </li>
          {offers.map((offer) => (
            <li key={offer.id}>
              <button
                type="button"
                role="option"
                aria-selected={offer.id === value}
                onClick={() => pick(offer.id)}
                className={`flex w-full items-center px-[10px] py-[5px] text-left text-[12.5px] hover:bg-slate-50 ${offer.id === value ? 'bg-[#eef4ff] text-[#0b5cd6]' : 'text-slate-800'}`}
              >
                <span className="truncate">{offer.offerName}</span>
                {offer.shared && <SharedBadge />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const ROW = 'grid grid-cols-[minmax(0,1.7fr)_136px_minmax(168px,0.9fr)_32px] items-center gap-x-[12px] px-[12px]'

/** Survey reasons, laid out like the product's Edit survey reasons modal. */
export function SurveyReasonsEditor({
  settings,
  disabled,
  update,
}: {
  settings: ManifestSettings
  disabled: boolean
  update: (next: ManifestSettings) => void
}) {
  const survey = settings.survey
  const pageBased = survey.offerStrategy === 'page'
  const off = disabled || !survey.reasonsEnabled
  const setSurvey = (patch: Partial<SurveyConfiguration>) => update({ ...settings, survey: { ...survey, ...patch } })
  const setRow = (id: string, patch: Partial<ManifestReason>) =>
    setSurvey({ reasons: survey.reasons.map((row) => (row.id === id ? { ...row, ...patch } : row)) })

  return (
    <div className="space-y-[20px]">
      <div>
        <label className="flex items-center gap-[10px] text-[13px] font-semibold text-slate-900">
          <Switch
            label="Enable Survey Reasons"
            checked={survey.reasonsEnabled}
            disabled={disabled}
            onChange={(reasonsEnabled) => setSurvey({ reasonsEnabled })}
          />
          Enable Survey Reasons
        </label>
        <div className="ml-[14px] mt-[6px] border-l border-slate-200 py-[4px] pl-[22px]">
          <label className="flex items-center gap-[8px] text-[12.5px] text-slate-700">
            <input
              type="checkbox"
              checked={survey.reasonRequired}
              disabled={off}
              onChange={(event) => setSurvey({ reasonRequired: event.target.checked })}
            />
            Survey reason is required
          </label>
        </div>
      </div>

      <label className="block">
        <span className="mb-[8px] block text-[12px] font-medium leading-[16px] text-[#62676d]">Label</span>
        <input
          className="w-full border border-[#e1e2e6] bg-white px-[10px] py-[8px] text-[13px] leading-[20px] text-[#1a1d21] outline-none focus:border-[#0472e1] disabled:bg-[#f7f7f8]"
          value={survey.label}
          disabled={off}
          onChange={(event) => setSurvey({ label: event.target.value })}
        />
      </label>

      <label className="block">
        <span className="mb-[8px] block text-[12px] font-medium leading-[16px] text-[#62676d]">Reasons order</span>
        <select
          className="w-full border border-[#e1e2e6] bg-white px-[10px] py-[8px] text-[13px] leading-[20px] text-[#1a1d21] outline-none disabled:bg-[#f7f7f8]"
          value="random"
          disabled={off}
          onChange={() => setSurvey({ order: 'random' })}
        >
          <option value="random">Random</option>
        </select>
      </label>

      <div className="flex items-center justify-center gap-[10px] text-[12.5px]">
        <span className={pageBased ? 'font-semibold text-slate-900' : 'text-slate-600'}>Page based offer</span>
        <Switch
          label="Reason based offer"
          checked={!pageBased}
          disabled={off}
          onChange={(reason) => setSurvey({ offerStrategy: reason ? 'reason' : 'page' })}
        />
        <span className={!pageBased ? 'font-semibold text-slate-900' : 'text-slate-600'}>Reason based offer</span>
      </div>

      {pageBased && (
        <div>
          <p className="bg-slate-100 px-[12px] py-[8px] text-[12.5px] font-semibold text-slate-900">Modal offer</p>
          <div className="px-[12px] py-[10px]">
            <OfferSelect
              label="Modal offer"
              value={survey.pageOfferId}
              offers={settings.offers}
              disabled={off}
              onChange={(pageOfferId) => setSurvey({ pageOfferId })}
            />
          </div>
        </div>
      )}

      <div className="border border-slate-200">
        <div className={`${ROW} bg-slate-100 py-[8px] text-[12px] font-semibold text-slate-900`}>
          <span>Survey reason</span>
          <span className="flex items-center gap-[4px] whitespace-nowrap font-normal text-slate-600">
            Reason Feedback
            <span aria-label="About reason feedback" className="text-slate-400">
              <SIcon name="circle-help" size={12} />
            </span>
          </span>
          <span className="flex min-w-0 items-center justify-between gap-[8px] whitespace-nowrap font-normal text-slate-600">
            <span className="truncate">Current card/offer</span>
            {pageBased && (
              <button
                type="button"
                disabled={off}
                className="font-normal text-slate-700 underline disabled:no-underline disabled:opacity-50"
                onClick={() =>
                  setSurvey({
                    reasons: survey.reasons.map((row) => (row.selected ? { ...row, active: true, offerId: survey.pageOfferId } : row)),
                  })
                }
              >
                Apply to all
              </button>
            )}
          </span>
          <span />
        </div>
        {survey.reasons.map((row, index) => (
          <div key={row.id} className={`${ROW} py-[5px] ${index % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}>
            <div className="min-w-0 text-[12.5px] leading-[18px] text-slate-800">
              <input
                type="checkbox"
                aria-label={`Select ${row.label || 'reason'}`}
                checked={row.selected}
                disabled={off}
                className="mr-[8px] align-middle"
                onChange={(event) => setRow(row.id, { selected: event.target.checked })}
              />
              {row.shared ? (
                <span className="align-middle">{row.label}</span>
              ) : (
                <input
                  aria-label="Reason label"
                  className="w-[calc(100%-22px)] min-w-0 border border-slate-200 bg-white px-[6px] py-[3px] align-middle text-[12.5px] text-slate-800 outline-none focus:border-slate-400"
                  value={row.label}
                  placeholder="New reason"
                  disabled={off}
                  onChange={(event) => setRow(row.id, { label: event.target.value })}
                />
              )}
              {row.shared && <SharedBadge />}
            </div>
            <div className="flex items-center gap-[8px]">
              {row.selected && (
                <>
                  <Switch
                    label={`Reason feedback for ${row.label}`}
                    checked={row.feedbackEnabled}
                    disabled={off}
                    onChange={(feedbackEnabled) => setRow(row.id, { feedbackEnabled })}
                  />
                  <span className={`text-[12.5px] ${row.feedbackEnabled ? 'text-slate-500' : 'text-slate-800'}`}>Enabled</span>
                </>
              )}
            </div>
            <div className="min-w-0">
              {pageBased ? (
                <div className="flex items-center gap-[8px]">
                  <Switch
                    label={`Activate ${row.label}`}
                    checked={row.selected && row.active}
                    disabled={off || !row.selected}
                    onChange={(active) => setRow(row.id, { active, offerId: active ? survey.pageOfferId : null })}
                  />
                  <span className={`text-[12.5px] ${row.selected ? 'text-slate-800' : 'text-slate-400'}`}>Activate</span>
                </div>
              ) : (
                <OfferSelect
                  label={`Offer for ${row.label}`}
                  value={row.selected ? row.offerId : null}
                  offers={settings.offers}
                  disabled={off || !row.selected}
                  onChange={(offerId) => setRow(row.id, { offerId })}
                />
              )}
            </div>
            <button
              type="button"
              aria-label="Reason actions"
              className="flex h-[24px] w-[24px] items-center justify-center border border-slate-200 bg-white text-slate-600"
            >
              <SIcon name="ellipsis-vertical" size={14} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={off}
        className="flex items-center gap-[6px] text-[12.5px] text-[#0b5cd6] disabled:opacity-50"
        onClick={() =>
          setSurvey({
            reasons: [
              ...survey.reasons,
              { id: uid('rs'), label: '', selected: true, shared: false, feedbackEnabled: false, offerId: null, active: false },
            ],
          })
        }
      >
        <SIcon name="plus" size={14} />
        Add a reason
      </button>
    </div>
  )
}
