import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from 'react'
import { useJourney } from '../store/useJourney'
import { compileBrand } from './theme'
import {
  isBrandMatched,
  matchMerchantBrand,
  matchMerchantBrandFromMedia,
  type MatchSiteResult,
} from './matchSite'
import { BrandTokensEditor } from './BrandTokensEditor'
import { MEDIA_ACCEPT, isMediaFile } from './sampleMedia'

/**
 * Required brand beat for every authored experience — cancel and pricing table.
 * Copilot asks it as a chat step; the branding studio keeps the same card for later edits.
 */
export function MatchSiteCard({
  compact,
  setup,
  onMatched,
  onFailed,
}: {
  compact?: boolean
  /** Copilot home — Figma cancel-flow-setup card. Label lives on the parent section. */
  setup?: boolean
  onMatched?: (result: MatchSiteResult) => void
  onFailed?: (result: MatchSiteResult) => void
}) {
  const brand = useJourney((s) => s.file.brand)
  const applyBrand = useJourney((s) => s.applyBrand)
  const matched = isBrandMatched(brand)
  const [url, setUrl] = useState('')
  const [sampling, setSampling] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const finish = (result: MatchSiteResult) => {
    setNote(result.reply)
    if (!result.applied) {
      onFailed?.(result)
      return
    }
    applyBrand(result.branding, true)
    setUrl('')
    onMatched?.(result)
  }

  const sampleUrl = async () => {
    const text = url.trim()
    if (!text) return
    setSampling(true)
    const result = await matchMerchantBrand(text, compileBrand(useJourney.getState().file.brand))
    setSampling(false)
    finish(result)
  }

  const sampleFile = async (file: File) => {
    if (!isMediaFile(file)) {
      setNote('Drop a screenshot (PNG, JPG, WebP) or a short screen recording (MP4, WebM).')
      return
    }
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    })
    setSampling(true)
    const result = await matchMerchantBrandFromMedia(file, compileBrand(useJourney.getState().file.brand))
    setSampling(false)
    finish(result)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void sampleFile(file)
  }

  const copy = matched
    ? 'Every cancel and pricing-table experience uses this look. Edit a token, rematch from a URL, or drop a new capture.'
    : setup || compact
      ? 'An in-product URL can be hard to paste. Drop a screenshot or video of the billing page — or add the URL — and we’ll pull design tokens you can edit.'
      : 'Paste the account or billing URL, or drop a screenshot or video of that page. I’ll sample what I can and apply it as tokens.'

  const drop = (
    <DropZone
      setup={!!setup}
      dragging={dragging}
      sampling={sampling}
      preview={preview}
      onBrowse={() => fileRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    />
  )

  const urlRow = setup ? (
    <div className="flex items-center gap-2">
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void sampleUrl()
        }}
        placeholder={matched ? 'Paste a new URL to rematch' : 'https://account.example.com'}
        className="h-[38px] min-w-0 flex-1 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 text-[13px] leading-[1.4] text-[#111827] outline-none placeholder:text-[#4b5563] focus:border-slate-400"
      />
      <button
        type="button"
        disabled={!url.trim() || sampling}
        onClick={() => void sampleUrl()}
        className={`flex h-[38px] flex-none items-center justify-center rounded-lg px-4 text-[13px] font-semibold ${
          url.trim() && !sampling ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-[#9ca3af] text-[#f9fafb]'
        }`}
      >
        {sampling ? 'Sampling…' : matched ? 'Rematch' : 'Match'}
      </button>
    </div>
  ) : (
    <div className={`flex gap-2 ${compact && matched ? 'mt-2' : 'mt-2.5'}`}>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void sampleUrl()
        }}
        placeholder={matched ? 'Paste a new URL to rematch' : 'https://account.example.com'}
        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-slate-400"
      />
      <button
        type="button"
        disabled={!url.trim() || sampling}
        onClick={() => void sampleUrl()}
        className="flex-none rounded-xl bg-slate-900 px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-slate-800 disabled:opacity-30"
      >
        {sampling ? 'Sampling…' : matched ? 'Rematch' : 'Match'}
      </button>
    </div>
  )

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept={MEDIA_ACCEPT}
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (file) void sampleFile(file)
      }}
    />
  )

  const onPasteCapture = (e: ClipboardEvent) => {
    const file = [...e.clipboardData.files].find(isMediaFile)
    if (!file) return
    e.preventDefault()
    void sampleFile(file)
  }

  if (setup) {
    return (
      <div
        className={`flex flex-col gap-3 rounded-[12px] border p-4 ${
          matched ? 'border-emerald-200 bg-emerald-50/60' : 'border-[#e5e7eb] bg-white'
        }`}
        onPaste={onPasteCapture}
      >
        {fileInput}
        <p className="text-[12px] leading-[1.3] text-[#4b5563]">{copy}</p>
        {urlRow}
        {drop}
        {note && <p className="text-[11px] leading-relaxed text-slate-500">{note}</p>}
        {matched && <BrandTokensEditor />}
      </div>
    )
  }

  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        matched ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-slate-50'
      }`}
      onPaste={onPasteCapture}
    >
      {fileInput}
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
        {matched ? 'Site look' : 'Match your site'}
      </p>
      <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500">{copy}</p>
      {urlRow}
      <div className="mt-2">{drop}</div>
      {note && <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{note}</p>}
      {matched && (
        <div className="mt-3">
          <BrandTokensEditor />
        </div>
      )}
    </div>
  )
}

function DropZone({
  setup,
  dragging,
  sampling,
  preview,
  onBrowse,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  setup: boolean
  dragging: boolean
  sampling: boolean
  preview: string | null
  onBrowse: () => void
  onDragOver: (e: DragEvent<HTMLButtonElement>) => void
  onDragLeave: () => void
  onDrop: (e: DragEvent<HTMLButtonElement>) => void
}) {
  const active = dragging || sampling
  return (
    <button
      type="button"
      data-testid="match-site-drop"
      onClick={onBrowse}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      disabled={sampling}
      className={`flex w-full items-center gap-3 rounded-[10px] border border-dashed px-3 py-2.5 text-left ${
        active
          ? 'border-[#6366f1] bg-[#eef2ff]'
          : setup
            ? 'border-[#e5e7eb] bg-[#f9fafb] hover:border-slate-300'
            : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      {preview ? (
        <img src={preview} alt="" className="h-9 w-9 flex-none rounded-md object-cover ring-1 ring-black/10" />
      ) : (
        <span
          className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-white text-slate-400 ring-1 ring-black/5"
          aria-hidden
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 16.5V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9.5" />
            <path d="m4 15 4.5-4.5a2 2 0 0 1 2.8 0L16 16" />
            <path d="m14 14 1.5-1.5a2 2 0 0 1 2.8 0L20 15" />
            <circle cx="9" cy="8.5" r="1" fill="currentColor" stroke="none" />
          </svg>
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-[12.5px] font-semibold text-[#111827]">
          {sampling ? 'Sampling colors…' : preview ? 'Replace screenshot or video' : 'Drop a screenshot or video'}
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug text-[#4b5563]">
          PNG, JPG, WebP, or a short MP4 / WebM. Paste works too.
        </span>
      </span>
    </button>
  )
}
