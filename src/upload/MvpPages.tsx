import { useRef, useState } from 'react'
import { SButton, SIcon } from '@chargebee/sting-react'
import { OFFER_VARIANTS } from '../lib/offerVariants'
import { useOrchestration } from '../store/useOrchestration'
import { useJourney } from '../store/useJourney'
import { useMerchantLibrary } from '../store/useMerchantLibrary'
import type { MerchantComponent } from '../library/types'
import { CANCEL_ROUTE } from '../shell/nav'
import { useGrowthShell } from '../shell/useGrowthShell'
import { newTabId, useWorkspaceUi } from '../workspace/useWorkspaceUi'
import { journeyFromUpload } from './apply'
import { bumpArtifactVersion, filesToArtifact, scanArtifact } from './scan'
import type { TemplateManifest } from './types'
import { contractErrors, formatContractIssue } from './validate'

const SEED = [
  { name: 'jag exp 7', draft: true, languages: 'EN', placements: 'None', offers: 'None', modified: 'Yesterday at 12:32 PM' },
  { name: 'custom exp 13', draft: false, languages: 'EN', placements: 'None', offers: 'Multi-action', modified: 'Last Tuesday at 11:41 AM' },
  { name: 'custom exp 12', draft: false, languages: 'EN', placements: 'None', offers: 'Multi-action', modified: '10/01/2026' },
  { name: 'jag exp 1', draft: false, languages: 'EN', placements: 'None', offers: 'None', modified: 'Last Tuesday at 12:26 PM' },
]

function offerLabel(bind: string | undefined): string {
  if (!bind) return 'Offer'
  return OFFER_VARIANTS.find((item) => item.category === bind)?.label ?? bind
}

export function offersPlaced(manifest: TemplateManifest | undefined): string {
  const labels = [
    ...new Set(
      (manifest?.steps ?? []).flatMap((step) => step.slots.filter((slot) => slot.type === 'offer').map((slot) => offerLabel(slot.bind))),
    ),
  ]
  return labels.length ? labels.join(', ') : 'None'
}

function openStudio() {
  const editor = { id: newTabId('editor'), kind: 'editor' as const }
  const preview = { id: newTabId('preview'), kind: 'preview' as const }
  const plan = { id: newTabId('plan'), kind: 'plan' as const }
  useOrchestration.getState().backToCanvas()
  useWorkspaceUi.getState().setPaneHidden(false)
  useWorkspaceUi.getState().setTabs({ open: [editor, preview, plan], active: plan.id })
  useGrowthShell.getState().go(CANCEL_ROUTE)
}

export function MvpPages() {
  const file = useJourney((s) => s.file)
  const uploaded = file.source === 'uploaded' && !!file.manifest
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [zip, setZip] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issues, setIssues] = useState<string[]>([])
  const input = useRef<HTMLInputElement>(null)

  const close = () => {
    if (busy) return
    setOpen(false)
    setName('')
    setZip(null)
    setError(null)
    setIssues([])
  }

  const takeFile = (file: File | undefined) => {
    if (!file) return
    const zipFile = /\.zip$/i.test(file.name) || file.type === 'application/zip'
    if (!zipFile) {
      setZip(null)
      setError('Upload a .zip file.')
      return
    }
    setZip(file)
    setError(null)
    setIssues([])
  }

  const publish = async () => {
    if (!zip || !name.trim() || busy) return
    setBusy(true)
    setError(null)
    setIssues([])
    try {
      const prev = useJourney.getState().file.artifact
      const artifact = bumpArtifactVersion(prev, await filesToArtifact([zip]))
      const manifest = scanArtifact(artifact)
      const problems = contractErrors(manifest)
      if (problems.length > 0) {
        setIssues(problems.map(formatContractIssue))
        return
      }
      const pageName = name.trim()
      const saved = useMerchantLibrary.getState().saveFromUpload(artifact, manifest, pageName)
      const catalog = useMerchantLibrary.getState().components
      const components = saved.componentIds
        .map((id) => catalog.find((item) => item.id === id))
        .filter((item): item is MerchantComponent => item != null)
      const base = useJourney.getState().file
      const next = journeyFromUpload(base, artifact, saved.manifest, components)
      useJourney.getState().replaceFile({ ...next, name: saved.name || pageName })
      setBusy(false)
      close()
      openStudio()
      return
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <header className="flex flex-none items-start justify-between gap-[16px] border-b border-slate-200 px-[24px] py-[16px]">
        <div>
          <h1 className="text-[20px] font-semibold text-slate-900">Pages</h1>
          <p className="mt-[2px] text-[13px] text-slate-500">Manage traffic routing on Targeting.</p>
        </div>
        <div className="flex flex-none items-center gap-[8px]">
          <SButton size="small" variant="primary" className="w-auto">
            New test page
          </SButton>
          <SButton size="small" variant="neutral-outline" className="w-auto" onClick={() => setOpen(true)}>
            Upload custom page
          </SButton>
          <SButton size="small" variant="neutral-outline" className="w-auto">
            Manage branding
          </SButton>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-[24px] py-[20px]">
        <section className="mb-[20px] flex items-start gap-[14px] rounded-lg border border-slate-200 px-[16px] py-[14px]">
          <span className="flex h-[40px] w-[40px] flex-none items-center justify-center rounded-md bg-slate-100 text-slate-500">
            <SIcon name="layout-template" size={18} />
          </span>
          <div>
            <p className="text-[13.5px] font-semibold text-slate-900">
              Control page <span className="ml-[6px] text-[11px] font-medium text-slate-500">Control</span>
              <span className="ml-[6px] text-[11px] font-medium text-slate-500">Default</span>
              <span className="ml-[6px] text-[11px] font-medium text-amber-700">Draft</span>
            </p>
            <p className="mt-[2px] text-[13px] text-slate-500">
              A no-offer Chargebee Growth cancel page that is used to maintain a baseline to track changes in your deflect rate over time.
            </p>
          </div>
        </section>

        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-slate-200 text-[12px] font-medium text-slate-500">
              <th className="py-[8px] pr-[12px] font-medium">Test pages</th>
              <th className="py-[8px] pr-[12px] font-medium">Status</th>
              <th className="py-[8px] pr-[12px] font-medium">Languages</th>
              <th className="py-[8px] pr-[12px] font-medium">Placements</th>
              <th className="py-[8px] pr-[12px] font-medium">Offer(s) placed</th>
              <th className="py-[8px] font-medium">Last modified</th>
            </tr>
          </thead>
          <tbody>
            {uploaded && (
              <tr className="border-b border-slate-100">
                <td className="py-[10px] pr-[12px]">
                  <button type="button" onClick={openStudio} className="font-medium text-[#1a56db] hover:underline">
                    {file.name}
                  </button>
                  <span className="ml-[8px] text-[11px] font-medium text-amber-700">Draft</span>
                </td>
                <td className="py-[10px] pr-[12px] text-slate-600">No traffic</td>
                <td className="py-[10px] pr-[12px] text-slate-600">EN</td>
                <td className="py-[10px] pr-[12px] text-slate-600">None</td>
                <td className="py-[10px] pr-[12px] text-slate-700">{offersPlaced(file.manifest)}</td>
                <td className="py-[10px] text-slate-600">Today</td>
              </tr>
            )}
            {SEED.map((row) => (
              <tr key={row.name} className="border-b border-slate-100">
                <td className="py-[10px] pr-[12px] font-medium text-[#1a56db]">
                  {row.name}
                  {row.draft && <span className="ml-[8px] text-[11px] font-medium text-amber-700">Draft</span>}
                </td>
                <td className="py-[10px] pr-[12px] text-slate-600">No traffic</td>
                <td className="py-[10px] pr-[12px] text-slate-600">{row.languages}</td>
                <td className="py-[10px] pr-[12px] text-slate-600">{row.placements}</td>
                <td className="py-[10px] pr-[12px] text-slate-600">{row.offers}</td>
                <td className="py-[10px] text-slate-600">{row.modified}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-[24px]" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-page-title"
            className="w-full max-w-[480px] bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-[12px] px-[20px] pt-[18px]">
              <h2 id="upload-page-title" className="text-[16px] font-semibold text-slate-900">
                Upload a custom page
              </h2>
              <button type="button" aria-label="Close" onClick={close} className="flex h-[28px] w-[28px] items-center justify-center text-slate-500 hover:text-slate-900">
                <SIcon name="x" size={16} />
              </button>
            </header>
            <div className="px-[20px] py-[12px]">
              <p className="text-[13px] leading-[1.5] text-slate-600">
                Upload your built cancel page as a zip. It needs a manifest.json and its entry document at the top level, with relative asset URLs.
              </p>
              <label className="mt-[14px] block text-[12.5px] font-medium text-slate-700" htmlFor="upload-page-name">
                Page name
              </label>
              <input
                id="upload-page-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Custom cancel page"
                className="mt-[6px] h-[36px] w-full border border-slate-300 px-[10px] text-[13px] outline-none focus:border-slate-500"
              />
              <button
                type="button"
                onClick={() => input.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  takeFile(event.dataTransfer.files[0])
                }}
                className="mt-[14px] flex w-full flex-col items-center justify-center border border-dashed border-slate-300 bg-slate-50 px-[16px] py-[28px] text-center"
              >
                <SIcon name="cloud-upload" size={22} className="text-slate-400" />
                <p className="mt-[8px] text-[13px] text-slate-600">
                  {zip ? zip.name : 'Drag and drop your build zip here or browse file'}
                </p>
                <p className="mt-[4px] text-[12px] text-slate-400">Supported file type: ZIP</p>
              </button>
              <input
                ref={input}
                type="file"
                accept=".zip,application/zip"
                className="hidden"
                onChange={(event) => {
                  takeFile(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
              {error && <p className="mt-[10px] text-[12.5px] text-rose-600">{error}</p>}
              {issues.length > 0 && (
                <ul className="mt-[10px] space-y-[4px] text-[12.5px] text-rose-600">
                  {issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              )}
            </div>
            <footer className="flex justify-end gap-[8px] px-[20px] pb-[16px]">
              <SButton size="small" variant="neutral-outline" className="w-auto" onClick={close}>
                Cancel
              </SButton>
              <SButton size="small" variant="primary" className="w-auto" disabled={busy || !zip || !name.trim()} onClick={() => void publish()}>
                {busy ? 'Uploading…' : 'Upload and publish'}
              </SButton>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
