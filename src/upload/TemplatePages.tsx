import { SButton, SIcon } from '@chargebee/sting-react'
import { useJourney } from '../store/useJourney'
import { CANCEL_ROUTE } from '../shell/nav'
import { useGrowthShell } from '../shell/useGrowthShell'
import { useUpload } from './useUpload'
import { canPublishUploaded } from './validate'

export function TemplatePages() {
  const file = useJourney((s) => s.file)
  const go = useGrowthShell((s) => s.go)
  const open = useUpload((s) => s.open)
  const openRemap = useUpload((s) => s.openRemap)
  const uploaded = file.source === 'uploaded' && !!file.artifact
  const publishable = canPublishUploaded(file.manifest)

  const start = (remap = false) => {
    go(CANCEL_ROUTE)
    if (remap) openRemap()
    else open()
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <header className="flex flex-none items-center justify-between border-b border-slate-100 px-6 py-4">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-slate-900">Pages</h1>
          <p className="mt-0.5 text-[13px] text-slate-500">
            Host a cancel UI the merchant designed. Growth still owns targeting, offers, and reporting.
          </p>
        </div>
        <SButton size="small" variant="primary" onClick={() => start(false)}>
          Upload template
        </SButton>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
        {uploaded ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 p-5">
            <div className="flex items-start gap-3">
              <SIcon name="file-text" size={22} className="text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-slate-900">{file.name}</p>
                <p className="mt-1 font-mono text-[11px] text-slate-400">
                  v{file.artifact?.version} · {file.artifact?.checksum} · {file.artifact?.files.length}{' '}
                  {(file.artifact?.files.length ?? 0) === 1 ? 'file' : 'files'}
                </p>
                <p className="mt-2 text-[13px] text-slate-600">
                  {file.manifest?.steps.length ?? 0} steps mapped
                  {publishable ? ' · ready to publish' : ' · bind the catalog before publish'}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <SButton size="small" variant="primary" onClick={() => start(false)}>
                    Replace file
                  </SButton>
                  <SButton size="small" variant="neutral-outline" onClick={() => start(true)}>
                    Rebind catalog
                  </SButton>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-md flex-col items-center text-center">
            <SIcon name="file-text" size={28} className="text-slate-300" />
            <p className="mt-3 text-[15px] font-semibold text-slate-800">No hosted template yet</p>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
              Upload HTML or a zip of static pages. We scan steps and slots; you confirm what binds to
              offers, the survey, and subscriber fields. Then Chargebee hosts it.
            </p>
            <SButton size="small" variant="primary" className="mt-4" onClick={() => start(false)}>
              Upload my own template
            </SButton>
          </div>
        )}
      </div>
    </div>
  )
}
