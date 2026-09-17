import { useCallback, useRef, useState } from 'react'
import { SButton } from '@chargebee/sting-react'
import { zipToBlob } from './pack'
import { useUpload } from './useUpload'
import { formatContractIssue } from './validate'
import { CONTRACT_VERSION } from './contract'
import { SAMPLE_ZIP_NAME, kitClipboardPayload, kitZipBytes } from './kit'
import { useOrchestration } from '../store/useOrchestration'
import { SpotlightFrame } from '../orchestration/SpotlightFrame'

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function UploadTemplate() {
  const loadFiles = useUpload((s) => s.loadFiles)
  const loadSample = useUpload((s) => s.loadSample)
  const error = useUpload((s) => s.error)
  const checklist = useUpload((s) => s.checklist)
  const mappingOnly = useUpload((s) => s.mappingOnly)
  const openTemplates = useOrchestration((s) => s.openTemplates)
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [copied, setCopied] = useState(false)

  const onFiles = useCallback(
    (list: FileList | File[] | null) => {
      if (!list || (list as FileList).length === 0) return
      void loadFiles(list)
    },
    [loadFiles],
  )

  const copyForLlm = async () => {
    try {
      await navigator.clipboard.writeText(kitClipboardPayload())
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {mappingOnly && (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
          Layout change needs a new file. Catalog binds can skip this and stay on confirm.
        </p>
      )}

      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-5 py-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-500">1 · Get the Growth kit</p>
        <p className="mt-1 text-[13px] font-semibold text-slate-800">Primitives, not a journey</p>
        <p className="mt-1 text-[12.5px] text-slate-600">
          Tell your LLM the job, then export only those pages. Keep every{' '}
          <code className="rounded bg-white/80 px-1 text-[12px]">data-cb-*</code> mark. Don’t upload this zip back —
          Chargebee won’t open a chat for you.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <SButton size="small" variant="primary" onClick={() => download(SAMPLE_ZIP_NAME, zipToBlob(kitZipBytes()))}>
            Download kit
          </SButton>
          <SButton size="small" variant="neutral-outline" onClick={() => void copyForLlm()}>
            {copied ? 'Copied for your LLM' : 'Copy for your LLM'}
          </SButton>
        </div>
      </div>

      {checklist.length > 0 && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-800">
          <p className="font-semibold">Contract checklist — fix the HTML, then drop it again</p>
          <ul className="mt-1 list-disc pl-4">
            {checklist.map((item) => (
              <li key={formatContractIssue(item)}>{formatContractIssue(item)}</li>
            ))}
          </ul>
        </div>
      )}

      <SpotlightFrame id="upload">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          onFiles(e.dataTransfer.files)
        }}
        className={`mt-4 flex flex-none flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center ${
          over ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-slate-50'
        }`}
      >
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">2 · Upload what you composed</p>
        <p className="mt-2 text-[14px] font-semibold text-slate-800">Drop the composed HTML or zip</p>
        <p className="mt-1 max-w-sm text-[12.5px] text-slate-500">
          Confirm-only, fair save, or pricing + checkout — contract v{CONTRACT_VERSION} rejects unmarked files.
        </p>
        <SButton size="small" variant="neutral-outline" className="mt-4" onClick={() => inputRef.current?.click()}>
          Choose file
        </SButton>
        <input
          ref={inputRef}
          type="file"
          accept=".html,.htm,.zip,.css"
          multiple
          className="hidden"
          onChange={(e) => {
            onFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => loadSample()}
          className="mt-3 text-[12px] font-medium text-slate-400 underline decoration-slate-200 underline-offset-2 hover:text-slate-600"
        >
          Scan a composed demo as-is
        </button>
      </div>
      </SpotlightFrame>

      {error && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">
          {error}
        </div>
      )}

      <p className="mt-4 text-center text-[12.5px] text-slate-500">
        Meant to reopen chrome you already scanned?{' '}
        <button
          type="button"
          onClick={() => openTemplates('yours')}
          className="font-semibold text-[#4f46e5] underline decoration-[#c7d2fe] underline-offset-2 hover:text-[#4338ca]"
        >
          Open my templates
        </button>
      </p>
    </div>
  )
}
