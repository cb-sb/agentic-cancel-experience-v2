import { useRef, useState, type ReactNode } from 'react'
import { SBadge, SButton, SCard, SDropdown, SIcon, SIndexPage, SInput, SModal, STable, type SIconName } from '@chargebee/sting-react'

/** SModal's published props omit the Radix open state this build actually accepts. */
const UploadModal = SModal as unknown as (props: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) => ReactNode
const UploadModalContent = SModal.Content as unknown as (props: { children: ReactNode }) => ReactNode
import { OFFER_VARIANTS } from '../lib/offerVariants'
import { useOrchestration } from '../store/useOrchestration'
import { useJourney } from '../store/useJourney'
import { useMerchantLibrary } from '../store/useMerchantLibrary'
import type { MerchantComponent } from '../library/types'
import { CANCEL_ROUTE } from '../shell/nav'
import { useGrowthShell } from '../shell/useGrowthShell'
import { newTabId, useWorkspaceUi } from '../workspace/useWorkspaceUi'
import { journeyFromUpload } from './apply'
import { composedDemoArtifact } from './kit'
import { demoSettings, reasonBinds } from './manifestSettings'
import { bumpArtifactVersion, filesToArtifact, scanArtifact } from './scan'
import type { TemplateManifest } from './types'
import { contractErrors, formatContractIssue } from './validate'

const SEED = [
  { name: 'jag exp 7', draft: true, languages: 'EN', placements: 'None', offers: 'None', modified: 'Yesterday at 12:32 PM', studio: true },
  { name: 'custom exp 13', draft: false, languages: 'EN', placements: 'None', offers: 'Multi-action', modified: 'Last Tuesday at 11:41 AM', studio: false },
  { name: 'custom exp 12', draft: false, languages: 'EN', placements: 'None', offers: 'Multi-action', modified: '10/01/2026', studio: false },
  { name: 'jag exp 1', draft: false, languages: 'EN', placements: 'None', offers: 'None', modified: 'Last Tuesday at 12:26 PM', studio: true },
]

type StudioTab = 'editor' | 'preview' | 'plan'

const ROW_ACTIONS: { label: string; icon: SIconName; tab?: StudioTab }[] = [
  { label: 'Edit', icon: 'pencil', tab: 'editor' },
  { label: 'Preview', icon: 'eye', tab: 'preview' },
  { label: 'Reasons', icon: 'list', tab: 'plan' },
  { label: 'Copy', icon: 'copy' },
  { label: 'Copy to brand', icon: 'copy' },
  { label: 'Share', icon: 'share' },
  { label: 'Generate sample session', icon: 'lightbulb' },
  { label: 'Archive', icon: 'archive' },
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

const DEMO_PAGE_NAME = 'Demo cancel page'

function publishScanned(artifact: ReturnType<typeof composedDemoArtifact>, manifest: TemplateManifest, pageName: string) {
  const saved = useMerchantLibrary.getState().saveFromUpload(artifact, manifest, pageName)
  const catalog = useMerchantLibrary.getState().components
  const components = saved.componentIds
    .map((id) => catalog.find((item) => item.id === id))
    .filter((item): item is MerchantComponent => item != null)
  const base = useJourney.getState().file
  const next = journeyFromUpload(base, artifact, { ...manifest, confirmed: false }, components)
  useJourney.getState().replaceFile({ ...next, name: saved.name || pageName })
}

function openStudio(active: StudioTab = 'plan') {
  const editor = { id: newTabId('editor'), kind: 'editor' as const }
  const preview = { id: newTabId('preview'), kind: 'preview' as const }
  const plan = { id: newTabId('plan'), kind: 'plan' as const }
  const chosen = active === 'editor' ? editor : active === 'preview' ? preview : plan
  useOrchestration.getState().backToCanvas()
  useWorkspaceUi.getState().setPaneHidden(false)
  useWorkspaceUi.getState().setTabs({ open: [editor, preview, plan], active: chosen.id })
  useGrowthShell.getState().go(CANCEL_ROUTE)
}

function PageActions({ onAction }: { onAction: (tab?: StudioTab) => void }) {
  return (
    <SDropdown>
      <SDropdown.Trigger asChild>
        <button
          type="button"
          aria-label="Page actions"
          className="flex h-8 w-8 items-center justify-center rounded-md text-[#62676d] hover:bg-[#f7f7f8] hover:text-[#1a1d21]"
        >
          <SIcon name="ellipsis-vertical" size={16} />
        </button>
      </SDropdown.Trigger>
      <SDropdown.Content position={{ side: 'bottom', align: 'end' }} width="medium">
        {ROW_ACTIONS.map((action) => (
          <SDropdown.Item key={action.label} onSelect={() => onAction(action.tab)}>
            <span className="flex items-center gap-[10px]">
              <SIcon name={action.icon} size={15} className="text-[#62676d]" />
              {action.label}
            </span>
          </SDropdown.Item>
        ))}
      </SDropdown.Content>
    </SDropdown>
  )
}

function PageName({ name, draft, onOpen }: { name: string; draft?: boolean; onOpen?: () => void }) {
  return (
    <span className="inline-flex items-center gap-[8px]">
      {onOpen ? (
        <button type="button" onClick={onOpen} className="font-medium text-[#0472e1] hover:underline">
          {name}
        </button>
      ) : (
        <span className="font-medium text-[#0472e1]">{name}</span>
      )}
      {draft && (
        <SBadge variant="warning" size="regular">
          Draft
        </SBadge>
      )}
    </span>
  )
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
      publishScanned(artifact, manifest, pageName)
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

  const runDemo = () => {
    if (busy) return
    setBusy(true)
    setError(null)
    setIssues([])
    try {
      const prev = useJourney.getState().file.artifact
      const artifact = bumpArtifactVersion(prev, composedDemoArtifact())
      const settings = demoSettings()
      const manifest = { ...scanArtifact(artifact), settings, surveyReasons: reasonBinds(settings) }
      const problems = contractErrors(manifest)
      if (problems.length > 0) {
        setIssues(problems.map(formatContractIssue))
        return
      }
      publishScanned(artifact, manifest, name.trim() || DEMO_PAGE_NAME)
      setBusy(false)
      close()
      openStudio()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not run the demo upload.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-white">
      <SIndexPage>
        <SIndexPage.Header
          variant="full"
          title="Pages"
          description="Manage traffic routing on Targeting."
          actions={
            <div className="flex items-center gap-[8px]">
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
          }
        />
        <SIndexPage.Body>
          <SIndexPage.Content>
            <div className="space-y-[16px]">
              <SCard>
                <SCard.Content>
                  <div className="flex items-start gap-[14px]">
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-[#f4f5f7] text-[#62676d]">
                      <SIcon name="layout-template" size={18} />
                    </span>
                    <div>
                      <p className="flex flex-wrap items-center gap-[8px] text-[14px] font-semibold text-[#1a1d21]">
                        Control page
                        <SBadge variant="neutral" size="regular">
                          Control
                        </SBadge>
                        <SBadge variant="neutral" size="regular">
                          Default
                        </SBadge>
                        <SBadge variant="warning" size="regular">
                          Draft
                        </SBadge>
                      </p>
                      <p className="mt-[4px] text-[13px] leading-5 text-[#62676d]">
                        A no-offer Chargebee Growth cancel page that is used to maintain a baseline to track changes in your deflect rate over time.
                      </p>
                    </div>
                  </div>
                </SCard.Content>
              </SCard>

              <STable border="horizontal">
                <STable.Head>
                  <STable.Row>
                    <STable.HeaderCell>Test pages</STable.HeaderCell>
                    <STable.HeaderCell>Status</STable.HeaderCell>
                    <STable.HeaderCell>Languages</STable.HeaderCell>
                    <STable.HeaderCell>Placements</STable.HeaderCell>
                    <STable.HeaderCell>Offer(s) placed</STable.HeaderCell>
                    <STable.HeaderCell>Last modified</STable.HeaderCell>
                    <STable.HeaderCell />
                  </STable.Row>
                </STable.Head>
                <STable.Body>
                  {uploaded && (
                    <STable.Row>
                      <STable.Cell>
                        <PageName name={file.name} draft onOpen={() => openStudio()} />
                      </STable.Cell>
                      <STable.Cell>No traffic</STable.Cell>
                      <STable.Cell>EN</STable.Cell>
                      <STable.Cell>None</STable.Cell>
                      <STable.Cell>{offersPlaced(file.manifest)}</STable.Cell>
                      <STable.Cell>Today</STable.Cell>
                      <STable.Cell>
                        <PageActions onAction={(tab) => openStudio(tab)} />
                      </STable.Cell>
                    </STable.Row>
                  )}
                  {SEED.map((row) => (
                    <STable.Row key={row.name}>
                      <STable.Cell>
                        <PageName name={row.name} draft={row.draft} onOpen={row.studio ? () => openStudio() : undefined} />
                      </STable.Cell>
                      <STable.Cell>No traffic</STable.Cell>
                      <STable.Cell>{row.languages}</STable.Cell>
                      <STable.Cell>{row.placements}</STable.Cell>
                      <STable.Cell>{row.offers}</STable.Cell>
                      <STable.Cell>{row.modified}</STable.Cell>
                      <STable.Cell>
                        <PageActions onAction={(tab) => tab && openStudio(tab)} />
                      </STable.Cell>
                    </STable.Row>
                  ))}
                </STable.Body>
              </STable>
            </div>
          </SIndexPage.Content>
        </SIndexPage.Body>
      </SIndexPage>

      <UploadModal open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <UploadModalContent>
          <SModal.Header>
            <SModal.Title>Upload a custom page</SModal.Title>
            <SModal.Description>
              Upload your built cancel page as a zip. It needs a manifest.json and its entry document at the top level, with relative asset URLs.
            </SModal.Description>
          </SModal.Header>
          <SModal.Body>
            <label className="block text-[13px] font-medium text-[#1a1d21]" htmlFor="upload-page-name">
              Page name
            </label>
            <SInput
              id="upload-page-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Custom cancel page"
              className="mt-[6px]"
            />
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                takeFile(event.dataTransfer.files[0])
              }}
              className="mt-[14px] flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-[#e1e2e6] bg-[#f7f7f8] px-[16px] py-[28px] text-center"
            >
              <SIcon name="cloud-upload" size={22} className="text-[#62676d]" />
              <p className="mt-[8px] text-[13px] text-[#3e4247]">{zip ? zip.name : 'Drag and drop your build zip here or browse file'}</p>
              <p className="mt-[4px] text-[12px] text-[#62676d]">Supported file type: ZIP</p>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={runDemo}
              className="mt-[12px] text-[13px] font-medium text-[#0472e1] hover:underline disabled:opacity-50"
            >
              Run a demo upload
            </button>
            <p className="mt-[2px] text-[12px] text-[#62676d]">Opens a summary to review. Approving it saves the summary.</p>
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
            {error && <p className="mt-[10px] text-[12.5px] text-[#de1827]">{error}</p>}
            {issues.length > 0 && (
              <ul className="mt-[10px] space-y-[4px] text-[12.5px] text-[#de1827]">
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            )}
          </SModal.Body>
          <SModal.Footer>
            <SButton size="small" variant="neutral-outline" className="w-auto" onClick={close}>
              Cancel
            </SButton>
            <SButton size="small" variant="primary" className="w-auto" disabled={busy || !zip || !name.trim()} onClick={() => void publish()}>
              {busy ? 'Uploading…' : 'Upload and publish'}
            </SButton>
          </SModal.Footer>
        </UploadModalContent>
      </UploadModal>
    </div>
  )
}
