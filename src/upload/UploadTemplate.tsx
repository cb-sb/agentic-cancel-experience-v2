import { useCallback, useRef, useState } from 'react'
import { SButton } from '@chargebee/sting-react'
import { zipToBlob } from './pack'
import { useUpload } from './useUpload'
import { formatContractIssue } from './validate'
import { CONTRACT_VERSION } from './contract'
import { SAMPLE_ZIP_NAME, kitClipboardPayload, kitZipBytes } from './kit'
import { useOrchestration } from '../store/useOrchestration'
import { SpotlightFrame } from '../orchestration/SpotlightFrame'
import { useCopilotStage } from '../orchestration/copilotStage'

type Branch = 'fork' | 'upload' | 'kit'

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** Document sheet with an upload badge — mirrors the product's file-upload glyph. */
function UploadGlyph() {
  return (
    <span aria-hidden className="relative inline-flex h-[52px] w-[52px] items-center justify-center">
      <svg width="40" height="46" viewBox="0 0 40 46" fill="none">
        <path
          d="M6 3.5A2.5 2.5 0 0 1 8.5 1h16.4a2.5 2.5 0 0 1 1.77.73l6.6 6.6A2.5 2.5 0 0 1 34 10.1V42.5A2.5 2.5 0 0 1 31.5 45h-23A2.5 2.5 0 0 1 6 42.5V3.5Z"
          fill="#eef1f6"
          stroke="#cbd3e0"
          strokeWidth="1.4"
        />
        <path d="M25 1.5V8a2.5 2.5 0 0 0 2.5 2.5h6.3" stroke="#cbd3e0" strokeWidth="1.4" fill="none" />
      </svg>
      <span className="absolute -bottom-[2px] right-[2px] flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#0b1f33] shadow-[0_2px_6px_rgba(11,31,51,0.35)]">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M8 11.5V4M8 4 4.6 7.4M8 4l3.4 3.4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </span>
  )
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-[12px] inline-flex w-fit items-center gap-[4px] text-[12.5px] font-semibold text-slate-500 hover:text-slate-800"
    >
      ← Back
    </button>
  )
}

export function UploadTemplate() {
  const loadFiles = useUpload((s) => s.loadFiles)
  const loadSample = useUpload((s) => s.loadSample)
  const error = useUpload((s) => s.error)
  const checklist = useUpload((s) => s.checklist)
  const mappingOnly = useUpload((s) => s.mappingOnly)
  const openTemplates = useOrchestration((s) => s.openTemplates)
  const requestCopilotLibrary = useOrchestration((s) => s.requestCopilotLibrary)
  const stage = useCopilotStage()
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [copied, setCopied] = useState(false)
  const [branch, setBranch] = useState<Branch>(mappingOnly ? 'upload' : 'fork')

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

  const openMyTemplates = () => {
    if (stage === 'center') requestCopilotLibrary('yours')
    else openTemplates('yours')
  }

  const mappingBanner = mappingOnly && (
    <p className="mb-[12px] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
      Layout change needs a new file. Catalog binds can skip this and stay on confirm.
    </p>
  )

  // ---- Fork: pick the intent ------------------------------------------------
  if (branch === 'fork') {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {mappingBanner}
        <div className="mb-[4px]">
          <h2 className="text-[16px] font-bold text-[#19191f]">Upload a template</h2>
          <p className="mt-[2px] text-[13px] leading-[1.5] text-[#677488]">
            Copilot binds the catalog from your composed HTML — targeting, holdout, and publish stay here.
          </p>
        </div>

        <div className="mt-[12px] flex flex-col gap-[12px]">
          <button
            type="button"
            onClick={() => setBranch('upload')}
            className="flex w-full flex-col rounded-[14px] border border-[#e5e7eb] bg-white px-[18px] py-[14px] text-left transition-colors hover:bg-[#fbfcfd]"
          >
            <span className="text-[14px] font-semibold text-[#19191f]">I already have my file — upload it</span>
            <span className="mt-[2px] text-[12.5px] leading-[1.5] text-[#677488]">
              Drop the composed HTML or zip you prepared with your LLM.
            </span>
          </button>
          <button
            type="button"
            onClick={() => setBranch('kit')}
            className="flex w-full flex-col rounded-[14px] border border-[#e5e7eb] bg-white px-[18px] py-[14px] text-left transition-colors hover:bg-[#fbfcfd]"
          >
            <span className="text-[14px] font-semibold text-[#19191f]">I’m new here — get the Growth kit</span>
            <span className="mt-[2px] text-[12.5px] leading-[1.5] text-[#677488]">
              Download the kit, compose an experience with your LLM, then come back to upload.
            </span>
          </button>
        </div>

        <p className="mt-[16px] text-center text-[12.5px] text-slate-500">
          Meant to reopen chrome you already scanned?{' '}
          <button
            type="button"
            onClick={openMyTemplates}
            className="font-semibold text-[#4f46e5] underline decoration-[#c7d2fe] underline-offset-2 hover:text-[#4338ca]"
          >
            Open my templates
          </button>
        </p>
      </div>
    )
  }

  // ---- Kit: new user downloads and prepares ---------------------------------
  if (branch === 'kit') {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {mappingBanner}
        <BackLink onClick={() => setBranch('fork')} />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-500">Get the Growth kit</p>
          <h2 className="mt-[2px] text-[16px] font-bold text-[#19191f]">Primitives, not a journey</h2>
          <p className="mt-[6px] text-[13px] leading-[1.6] text-[#677488]">
            Tell your LLM the job, then export only those pages. Keep every{' '}
            <code className="rounded bg-slate-100 px-1 text-[12px]">data-cb-*</code> mark. Don’t upload this zip back —
            Chargebee won’t open a chat for you.
          </p>
        </div>

        <div className="mt-[16px] flex flex-wrap gap-[8px]">
          <SButton
            size="small"
            variant="primary"
            className="w-auto shrink-0"
            onClick={() => download(SAMPLE_ZIP_NAME, zipToBlob(kitZipBytes()))}
          >
            Download kit
          </SButton>
          <SButton
            size="small"
            variant="neutral-outline"
            className="w-auto shrink-0"
            onClick={() => void copyForLlm()}
          >
            {copied ? 'Copied for your LLM' : 'Copy for your LLM'}
          </SButton>
        </div>

        <div className="mt-[20px] border-t border-slate-100 pt-[16px]">
          <p className="text-[13px] leading-[1.5] text-[#677488]">Already prepared your file?</p>
          <SButton
            size="small"
            variant="primary"
            className="mt-[8px] w-auto shrink-0"
            onClick={() => setBranch('upload')}
          >
            I’ve prepared my file — upload it
          </SButton>
        </div>
      </div>
    )
  }

  // ---- Upload: returning user drops their file ------------------------------
  return (
    <div className="flex h-full min-h-0 flex-col">
      {mappingBanner}
      {!mappingOnly && <BackLink onClick={() => setBranch('fork')} />}

      <div className="mb-[4px]">
        <h2 className="text-[16px] font-bold text-[#19191f]">Upload your file</h2>
        <p className="mt-[2px] text-[13px] leading-[1.5] text-[#677488]">
          Drop the HTML or zip you built from the Growth kit. Copilot binds the catalog; targeting, holdout, and publish stay here.
        </p>
      </div>

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
          className={`mt-[12px] flex flex-none flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-[36px] text-center transition-colors ${
            over ? 'border-indigo-400 bg-indigo-50/70' : 'border-slate-300 bg-slate-50/60'
          }`}
        >
          <UploadGlyph />
          <p className="mt-[14px] text-[14px] leading-snug text-[#19191f]">
            Drag and drop your file here, or{' '}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="font-semibold text-[#0b1f33] underline underline-offset-2 hover:text-black"
            >
              Choose file
            </button>
          </p>
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
      </SpotlightFrame>

      <div className="mt-[8px] flex flex-wrap items-center justify-between gap-x-[12px] gap-y-[4px] px-[2px] text-[12px] text-slate-400">
        <span>
          HTML, ZIP, CSS · needs the kit’s{' '}
          <code className="rounded bg-slate-100 px-1 text-[11px] text-slate-500">data-cb-*</code> marks · v{CONTRACT_VERSION}
        </span>
        {!mappingOnly && (
          <button
            type="button"
            onClick={() => setBranch('kit')}
            className="font-semibold text-[#4f46e5] underline decoration-[#c7d2fe] underline-offset-2 hover:text-[#4338ca]"
          >
            No kit yet? Get the kit
          </button>
        )}
      </div>

      {checklist.length > 0 && (
        <div className="mt-[12px] rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-800">
          <p className="font-semibold">Contract checklist — fix the HTML, then drop it again</p>
          <ul className="mt-1 list-disc pl-4">
            {checklist.map((item) => (
              <li key={formatContractIssue(item)}>{formatContractIssue(item)}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="mt-[12px] rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">
          {error}
        </div>
      )}

      <p className="mt-[14px] text-center text-[11px] text-slate-300">
        <button
          type="button"
          onClick={() => loadSample()}
          className="underline decoration-slate-200 underline-offset-2 hover:text-slate-500"
        >
          Scan a composed demo as-is
        </button>
      </p>
    </div>
  )
}
