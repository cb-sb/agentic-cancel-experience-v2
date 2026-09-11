import { useCallback, useRef, useState } from 'react'
import { SButton } from '@chargebee/sting-react'
import { SAMPLE_SINGLE_NAME, SAMPLE_ZIP_NAME, sampleZipBytes } from './samples'
import { zipToBlob } from './pack'
import { useUpload } from './useUpload'
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
        Design the cancel UI elsewhere. Upload one HTML file with multiple{' '}
        <code className="rounded bg-slate-100 px-1 text-[12px]">[data-cb-step]</code> sections, or a zip of
        static pages. Chargebee hosts it — we overlay offers, survey, fields, and tracking.
      </p>

      {mappingOnly && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
          Layout change needs a new file. Mapping-only edits can skip this and stay on confirm.
        </p>
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
        className={`mt-4 flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center ${
          over ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-slate-50'
        }`}
      >
        <p className="text-[14px] font-semibold text-slate-800">Drop HTML or zip</p>
        <p className="mt-1 max-w-sm text-[12.5px] text-slate-500">
          React apps are out of this cut. Static markup and CSS only.
        </p>
        <SButton
          size="small"
          variant="primary"
          className="mt-4"
          onClick={() => inputRef.current?.click()}
        >
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

      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Sample pack</p>
        <p className="mt-1 text-[12.5px] text-slate-500">
          Walk the loop without a real export. Generic pages — no merchant name.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <SButton size="small" variant="neutral-outline" onClick={() => loadSample('html')}>
            Use sample HTML
          </SButton>
          <SButton size="small" variant="neutral-outline" onClick={() => loadSample('zip')}>
            Use sample zip
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
    </div>
  )
}
