import { useState } from 'react'
import { useJourney } from '../store/useJourney'
import { compileBrand } from './theme'
import { isBrandMatched, matchMerchantBrand, type MatchSiteResult } from './matchSite'

/**
 * Required brand step for every authored experience — cancel and pricing table.
 * Copilot, the plan, and the branding studio share this so matching isn't a
 * one-off action buried in the prompt list.
 */
export function MatchSiteCard({
  compact,
  onMatched,
  onFailed,
}: {
  compact?: boolean
  onMatched?: (result: MatchSiteResult) => void
  onFailed?: (result: MatchSiteResult) => void
}) {
  const brand = useJourney((s) => s.file.brand)
  const applyBrand = useJourney((s) => s.applyBrand)
  const matched = isBrandMatched(brand)
  const [url, setUrl] = useState('')
  const [sampling, setSampling] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const sample = async () => {
    const text = url.trim()
    if (!text) return
    setSampling(true)
    const result = await matchMerchantBrand(text, compileBrand(useJourney.getState().file.brand))
    setSampling(false)
    setNote(result.reply)
    if (!result.applied) {
      onFailed?.(result)
      return
    }
    applyBrand(result.branding, true)
    setUrl('')
    onMatched?.(result)
  }

  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        matched ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
        {matched ? 'Site look' : 'Match your site'}
      </p>
      {matched ? (
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-800">{brand.merchant}</span>
          {' · '}
          every cancel and pricing-table experience uses this look.
        </p>
      ) : (
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500">
          {compact
            ? 'Required for every experience. Paste the account or billing page the snippet will run on.'
            : 'Paste the account or billing URL — not a marketing homepage. I’ll sample what I can and apply it as tokens.'}
        </p>
      )}
      <div className={`flex gap-2 ${compact && matched ? 'mt-2' : 'mt-2.5'}`}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void sample()
          }}
          placeholder={matched ? 'Paste a new URL to rematch' : 'https://account.example.com'}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-slate-400"
        />
        <button
          type="button"
          disabled={!url.trim() || sampling}
          onClick={() => void sample()}
          className="flex-none rounded-xl bg-slate-900 px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-slate-800 disabled:opacity-30"
        >
          {sampling ? 'Sampling…' : matched ? 'Rematch' : 'Match'}
        </button>
      </div>
      {note && <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{note}</p>}
    </div>
  )
}
