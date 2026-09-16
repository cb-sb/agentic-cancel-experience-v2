import { useCallback, useRef, useState } from 'react'
import { SButton } from '@chargebee/sting-react'
import { SAMPLE_SINGLE_NAME, SAMPLE_ZIP_NAME, sampleZipBytes } from './samples'
import { zipToBlob } from './pack'
import { useUpload } from './useUpload'
import { formatContractIssue } from './validate'
import { CONTRACT_VERSION } from './contract'
import singleHtml from './sample/single.html?raw'

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
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const onFiles = useCallback(
    (list: FileList | File[] | null) => {
      if (!list || (list as FileList).length === 0) return
      void loadFiles(list)
    },
    [loadFiles],
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="text-[13px] leading-relaxed text-slate-600">
        Start from the kit — slots for loss aversion, survey, and offers are already marked. Restyle
        chrome; do not delete <code className="rounded bg-slate-100 px-1 text-[12px]">data-cb-*</code>{' '}
        attributes. Contract v{CONTRACT_VERSION}: unmarked HTML is rejected. Targeting, holdout, and
        publish stay in Copilot.
      </p>

      {mappingOnly && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
          Layout change needs a new file. Catalog binds can skip this and stay on confirm.
        </p>
      )}

      <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-5 py-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-500">Starter kit</p>
        <p className="mt-1 text-[13px] font-semibold text-slate-800">Pre-marked Growth slots</p>
        <p className="mt-1 text-[12.5px] text-slate-600">
          One HTML file or a zip of pages. Same primitives other experiences use — not cancel-only.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <SButton size="small" variant="primary" onClick={() => loadSample('html')}>
            Use HTML kit
          </SButton>
          <SButton size="small" variant="neutral-outline" onClick={() => loadSample('zip')}>
            Use zip kit
          </SButton>
          <SButton
            size="small"
            variant="neutral-outline"
            onClick={() => download(SAMPLE_SINGLE_NAME, new Blob([singleHtml], { type: 'text/html' }))}
          >
            Download HTML
          </SButton>
          <SButton
            size="small"
            variant="neutral-outline"
            onClick={() => download(SAMPLE_ZIP_NAME, zipToBlob(sampleZipBytes()))}
          >
            Download zip
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
        <p className="text-[14px] font-semibold text-slate-800">Or drop your marked HTML or zip</p>
        <p className="mt-1 max-w-sm text-[12.5px] text-slate-500">
          Static markup and CSS only. React apps are out of this cut.
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
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">
          {error}
        </div>
      )}
    </div>
  )
}
