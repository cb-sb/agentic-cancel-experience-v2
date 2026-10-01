import { useEffect, useState, type ReactNode } from 'react'
import { SButton, SIcon, type SIconName } from '@chargebee/sting-react'
import { LIBRARY } from '../journey/templates'
import { TemplatePreviewStrip } from '../orchestration/TemplatePreviewStrip'
import { labelOf, type NavLeafId } from '../shell/nav'
import { useGrowthShell } from '../shell/useGrowthShell'
import { useJourney } from '../store/useJourney'
import { useOrchestration } from '../store/useOrchestration'
import { ConfirmManifest } from '../upload/ConfirmManifest'
import { copyKitForLlm, downloadKit, UploadDrop } from '../upload/UploadTemplate'
import { useUpload } from '../upload/useUpload'
import { openTab } from '../workspace/paneTabs'
import {
  CATALOG_PLANS,
  CATEGORY_LABEL,
  PROCESSING_LABEL,
  WIDGET_LABEL,
  type ExperienceType,
  type OfferCategory,
  type OfferProcessing,
  type OfferWidget,
} from '../concierge/model'
import { updateGrowthExperience, useGrowthExperiences } from '../concierge/useGrowthExperiences'
import { useGrowthLibrary } from '../concierge/useGrowthLibrary'
import { answerTool } from './chats'
import { detailFor, ownerOf, parseOwner } from './context'
import {
  applyArchiveOffer,
  applyControl,
  applyCreateOffer,
  applyCreatePricingTable,
  applyPublish,
  applySplit,
  applyUpdateOffer,
  archiveBlockers,
  landTemplate,
  publishGaps,
} from './tools'

type Input = Record<string, unknown>

export interface CardProps {
  chatId: string
  tool: string
  toolCallId: string
  input: Input
  output: unknown
  answered: boolean
}

function CardShell({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <div
      className={`rounded-[14px] border p-[14px] ${
        muted ? 'border-slate-200 bg-slate-50/70' : 'border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]'
      }`}
    >
      {children}
    </div>
  )
}

function Done({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-[6px] text-[12.5px] text-slate-500">
      <SIcon name="check" size={13} className="text-emerald-600" />
      <span>{children}</span>
    </div>
  )
}

function answer(p: CardProps, output: unknown) {
  answerTool(p.chatId, p.tool, p.toolCallId, output)
}

// ---------- ask_choice ----------

export function ChoiceCard(p: CardProps) {
  const question = String(p.input.question ?? '')
  const options = (p.input.options as string[] | undefined) ?? []
  const picked = (p.output as { answer?: string } | undefined)?.answer
  return (
    <div className="flex flex-col gap-[8px]">
      <p className="text-[13.5px] leading-[1.55] text-slate-800">{question}</p>
      <div className="flex flex-wrap gap-[6px]">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            disabled={p.answered}
            onClick={() => answer(p, { answer: o })}
            className={`rounded-full border px-[12px] py-[5px] text-[12.5px] transition-colors ${
              picked === o
                ? 'border-slate-900 bg-slate-900 text-white'
                : p.answered
                  ? 'border-slate-200 text-slate-400'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
      {p.answered && picked && !options.includes(picked) && <Done>You said: {picked}</Done>}
    </div>
  )
}

// ---------- show_doors ----------

interface Door {
  id: 'template' | 'upload' | 'copilot' | 'library'
  title: string
  body: string
  icon: SIconName
}

export function doorsFor(type: ExperienceType): Door[] {
  const copilot: Door = {
    id: 'copilot',
    title: 'Start with Copilot',
    body: 'Tell me what you want it to do and I’ll put it together.',
    icon: 'sparkles',
  }
  if (type === 'cancel_page') {
    return [
      { id: 'template', title: 'Start with a template', body: 'Pick a proven cancel page and change what you need.', icon: 'layout-template' },
      { id: 'upload', title: 'Upload your own design', body: 'Build your pages with your LLM and the Growth kit, then drop them here.', icon: 'cloud-upload' },
      copilot,
    ]
  }
  return [
    {
      id: 'library',
      title: type === 'pricing_table' ? 'Pick a pricing table from your library' : 'Pick an offer from your library',
      body: type === 'pricing_table' ? 'Use a table you already set up.' : 'Use an offer you already set up.',
      icon: type === 'pricing_table' ? 'table' : 'gift',
    },
    copilot,
  ]
}

const DOOR_NEXT: Record<Door['id'], string> = {
  template: 'The template is on the page and the editor is open. In one line, say what it does. Then offer two or three next changes with ask_choice. Do not recap earlier steps.',
  upload: 'Their pages are saved and the editor is open. In one line, name the screens. Then offer two or three next changes with ask_choice. Do not recap earlier steps.',
  copilot: 'Ask what they want this experience to do, in one short question.',
  library: 'The merchant picked from the library.',
}

export function DoorsCard(p: CardProps) {
  const type = (p.input.type as ExperienceType) ?? 'cancel_page'
  const [path, setPath] = useState<Door['id'] | null>(null)
  const picked = (p.output as { picked?: string } | undefined)?.picked
  const doors = doorsFor(type)

  if (p.answered) {
    const door = doors.find((d) => d.id === picked)
    return <Done>{door ? door.title : 'Picked a way to start'}</Done>
  }
  const back = () => setPath(null)
  if (path === 'library') return <LibraryPicker {...p} type={type} onBack={back} />
  if (path === 'template') return <TemplateList {...p} onBack={back} onPick={(id) => answer(p, { picked: 'template', template: id, applied: true, experience: detailFor(ownerOf(p.chatId)), next: DOOR_NEXT.template })} />
  if (path === 'upload') return <UploadSteps {...p} onBack={back} />

  return (
    <div className="flex flex-col gap-[8px]">
      {doors.map((d) => (
        <button
          key={d.id}
          type="button"
          onClick={() => (d.id === 'copilot' ? answer(p, { picked: d.id, next: DOOR_NEXT[d.id] }) : setPath(d.id))}
          className="flex items-start gap-[12px] rounded-[12px] border border-slate-200 bg-white p-[12px] text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
        >
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] bg-[#eef2ff] text-[#4f46e5]">
            <SIcon name={d.icon} size={16} />
          </span>
          <span className="min-w-0">
            <span className="block text-[13.5px] font-semibold text-slate-900">{d.title}</span>
            <span className="mt-[2px] block text-[12.5px] leading-[1.5] text-slate-500">{d.body}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

function LibraryPicker(p: CardProps & { type: ExperienceType; onBack: () => void }) {
  const offers = useGrowthLibrary((s) => s.offers)
  const tables = useGrowthLibrary((s) => s.pricingTables)
  const owner = parseOwner(ownerOf(p.chatId))
  const exp = useGrowthExperiences((s) => s.items.find((x) => owner.kind === 'growth' && x.id === owner.id))
  const objective = exp?.objective
  const rows =
    p.type === 'pricing_table'
      ? tables.filter((t) => t.status !== 'archived').map((t) => ({ id: t.id, name: t.name, meta: t.plans.map((x) => x.name).join(' · '), objective: t.objective }))
      : offers.filter((o) => o.status !== 'archived').map((o) => ({ id: o.id, name: o.name, meta: `${WIDGET_LABEL[o.widget]} · ${o.value}`, objective: o.objective }))
  const sorted = [...rows].sort((a, b) => Number(b.objective === objective) - Number(a.objective === objective))

  const pick = (id: string, name: string) => {
    if (exp) updateGrowthExperience(exp.id, { refId: id })
    answer(p, { picked: 'library', refId: id, name, applied: Boolean(exp) })
  }

  return (
    <CardShell>
      <div className="mb-[8px] flex items-center justify-between">
        <p className="text-[13px] font-semibold text-slate-900">{p.type === 'pricing_table' ? 'Your pricing tables' : 'Your offers'}</p>
        <button type="button" onClick={p.onBack} className="text-[12px] text-slate-500 hover:text-slate-800">
          Back
        </button>
      </div>
      <div className="flex max-h-[280px] flex-col overflow-y-auto">
        {sorted.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => pick(r.id, r.name)}
            className="flex items-center justify-between gap-[10px] border-t border-slate-100 px-[4px] py-[9px] text-left first:border-t-0 hover:bg-slate-50"
          >
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-slate-800">{r.name}</span>
              <span className="block truncate text-[12px] text-slate-500">{r.meta}</span>
            </span>
            {r.objective === objective && (
              <span className="flex-none rounded-full bg-slate-100 px-[8px] py-[2px] text-[11px] text-slate-600">Fits</span>
            )}
          </button>
        ))}
      </div>
    </CardShell>
  )
}

// ---------- show_templates ----------

export function TemplatesCard(p: CardProps) {
  const picked = (p.output as { picked?: string } | undefined)?.picked
  if (p.answered) {
    const entry = LIBRARY.find((e) => e.id === picked)
    return <Done>{entry ? `Using “${entry.title}”` : 'Picked a template'}</Done>
  }
  return <TemplateList {...p} onPick={(id) => answer(p, { picked: id, applied: true, experience: detailFor(ownerOf(p.chatId)), next: DOOR_NEXT.template })} />
}

function BackRow({ label, onBack }: { label: string; onBack?: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-[13px] font-semibold text-slate-900">{label}</p>
      {onBack && (
        <button type="button" onClick={onBack} className="text-[12px] text-slate-500 hover:text-slate-800">
          Back
        </button>
      )}
    </div>
  )
}

function TemplateList(p: CardProps & { onPick: (id: (typeof LIBRARY)[number]['id']) => void; onBack?: () => void }) {
  const brand = useJourney((s) => s.file.brand)
  const ids = (p.input.ids as string[] | null | undefined) ?? null
  const entries = LIBRARY.filter((e) => e.kind === 'cancel' && (!ids?.length || ids.includes(e.id)))
  return (
    <div className="flex flex-col gap-[10px]">
      <BackRow label="Pick a template" onBack={p.onBack} />
      {entries.map((e) => (
        <CardShell key={e.id}>
          <div className="flex items-start justify-between gap-[12px]">
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-slate-900">{e.title}</p>
              <p className="mt-[2px] text-[12.5px] leading-[1.5] text-slate-600">{e.does}</p>
              <p className="mt-[2px] text-[12px] leading-[1.5] text-slate-500">Pick it when: {e.pickWhen}</p>
            </div>
            <SButton
              size="small"
              variant="neutral-outline"
              className="w-auto flex-none"
              onClick={() => {
                landTemplate(e.id)
                p.onPick(e.id)
              }}
            >
              Use
            </SButton>
          </div>
          <div className="mt-[10px] overflow-hidden rounded-[10px]">
            <TemplatePreviewStrip entry={e} brand={brand} compact />
          </div>
        </CardShell>
      ))}
      <button
        type="button"
        onClick={() => useOrchestration.getState().openTemplates('ours')}
        className="self-start text-[12.5px] font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
      >
        Open all templates
      </button>
    </div>
  )
}

// ---------- upload: kit, drop, review ----------

export function KitCard(p: CardProps) {
  if (p.answered) {
    const out = p.output as { saved?: boolean; name?: string } | undefined
    return <Done>{out?.saved ? `Saved “${out.name ?? 'your pages'}” and opened the editor` : 'Upload not finished'}</Done>
  }
  return <UploadSteps {...p} />
}

function KitBody({ onDone }: { onDone: (status: 'downloaded' | 'already_built') => void }) {
  const [downloaded, setDownloaded] = useState(false)
  const [copied, setCopied] = useState(false)
  const row = (n: number, title: string, body: string, action: ReactNode) => (
    <div className="flex items-start gap-[12px] border-t border-slate-100 py-[10px] first:border-t-0 first:pt-0">
      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-slate-100 text-[12px] font-semibold text-slate-600">{n}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-slate-900">{title}</p>
        <p className="text-[12.5px] leading-[1.5] text-slate-500">{body}</p>
      </div>
      {action}
    </div>
  )
  return (
    <CardShell>
      {row(
        1,
        'Download the Growth kit',
        'The screens, fields and rules your pages need.',
        <SButton
          size="small"
          variant={downloaded ? 'neutral-outline' : 'primary'}
          className="w-auto flex-none"
          onClick={() => {
            downloadKit()
            setDownloaded(true)
          }}
        >
          {downloaded ? 'Downloaded' : 'Download'}
        </SButton>,
      )}
      {row(
        2,
        'Give it to your LLM',
        'Paste the prompt with the kit and describe your brand.',
        <SButton
          size="small"
          variant="neutral-outline"
          className="w-auto flex-none"
          onClick={() => void copyKitForLlm().then(setCopied)}
        >
          {copied ? 'Copied' : 'Copy prompt'}
        </SButton>,
      )}
      {row(3, 'Upload the pages it builds', 'An HTML file or a zip. I’ll check every screen before anything saves.', null)}
      <div className="mt-[10px] flex flex-wrap items-center justify-end gap-[8px] border-t border-slate-100 pt-[12px]">
        {!downloaded && (
          <SButton size="small" variant="neutral-outline" className="w-auto" onClick={() => onDone('already_built')}>
            I’ve already built my cancel experience with the Growth kit
          </SButton>
        )}
        {downloaded && (
          <SButton size="small" variant="primary" className="w-auto" onClick={() => onDone('downloaded')}>
            Continue
          </SButton>
        )}
      </div>
    </CardShell>
  )
}

export function UploadCard(p: CardProps) {
  const phase = useUpload((s) => s.phase)
  const manifest = useUpload((s) => s.manifest)

  useEffect(() => {
    if (!p.answered && useUpload.getState().phase === 'closed') useUpload.getState().open()
  }, [p.answered])

  useEffect(() => {
    if (p.answered || phase !== 'confirm' || !manifest) return
    answer(p, { ok: true, screens: manifest.steps.map((s) => s.kind), next: 'Call review_upload.' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, manifest, p.answered])

  if (p.answered) {
    const screens = (p.output as { screens?: string[] } | undefined)?.screens ?? []
    return <Done>File checked. {screens.length} screens found.</Done>
  }
  return (
    <CardShell>
      <UploadDrop bare />
    </CardShell>
  )
}

export function ReviewCard(p: CardProps) {
  const phase = useUpload((s) => s.phase)
  if (p.answered) {
    const out = p.output as { saved?: boolean; name?: string } | undefined
    return <Done>{out?.saved ? `Saved “${out.name ?? 'your pages'}” and opened the editor` : 'Not saved'}</Done>
  }
  if (phase !== 'confirm') {
    return (
      <CardShell muted>
        <p className="text-[13px] text-slate-600">There is no checked file to review yet.</p>
        <div className="mt-[10px] flex justify-end">
          <SButton size="small" variant="neutral-outline" className="w-auto" onClick={() => answer(p, { saved: false, reason: 'No file uploaded yet. Call show_upload.' })}>
            OK
          </SButton>
        </div>
      </CardShell>
    )
  }
  return <ReviewBody onSaved={(out) => answer(p, out)} />
}

function ReviewBody({ onSaved }: { onSaved: (out: Record<string, unknown>) => void }) {
  return (
    <CardShell>
      <div className="max-h-[420px] overflow-y-auto">
        <ConfirmManifest
          onConfirmed={() => {
            useOrchestration.setState({ setupDoor: 'upload', setupDoorConsumed: true })
            useOrchestration.getState().enterWorkEditor()
            openTab('editor')
            const file = useJourney.getState().file
            onSaved({ saved: true, name: file.name, screens: file.steps.map((s) => ({ id: s.id, kind: s.kind })) })
          }}
        />
      </div>
    </CardShell>
  )
}

/** The upload door: kit, drop, then check, all inside one card. */
function UploadSteps(p: CardProps & { onBack?: () => void }) {
  const [step, setStep] = useState<'kit' | 'drop' | 'review'>('kit')
  const phase = useUpload((s) => s.phase)
  const manifest = useUpload((s) => s.manifest)

  useEffect(() => {
    if (step === 'drop' && phase === 'closed') useUpload.getState().open()
    if (step === 'drop' && phase === 'confirm' && manifest) setStep('review')
  }, [step, phase, manifest])

  const label = step === 'kit' ? 'Step 1 of 3 · Get the kit' : step === 'drop' ? 'Step 2 of 3 · Upload your pages' : 'Step 3 of 3 · Check and save'
  const sub = { ...p, answered: false, output: undefined }
  return (
    <div className="flex flex-col gap-[10px]">
      <BackRow
        label={label}
        onBack={
          step === 'kit' && !p.onBack
            ? undefined
            : () => {
                if (step === 'kit') return p.onBack?.()
                if (step === 'review') useUpload.getState().backToPick()
                setStep(step === 'review' ? 'drop' : 'kit')
              }
        }
      />
      {step === 'kit' && <KitBody onDone={() => setStep('drop')} />}
      {step === 'drop' && (
        <CardShell>
          <UploadDrop bare />
        </CardShell>
      )}
      {step === 'review' && (
        <ReviewBody
          onSaved={(out) => answer(sub, { picked: 'upload', ...out, next: DOOR_NEXT.upload })}
        />
      )}
    </div>
  )
}

// ---------- approvals ----------

function ApprovalShell({
  p,
  title,
  children,
  approveLabel = 'Approve',
  onApprove,
  blocked,
}: {
  p: CardProps
  title: string
  children?: ReactNode
  approveLabel?: string
  onApprove: () => unknown
  blocked?: string
}) {
  if (p.answered) {
    const out = p.output as { approved?: boolean; error?: string } | undefined
    return out?.approved ? <Done>{title}: approved</Done> : <Done>{title}: {out?.error ?? 'not now'}</Done>
  }
  return (
    <CardShell>
      <div className="flex items-center gap-[6px] text-[11px] font-bold uppercase tracking-wide text-amber-700">
        <SIcon name="shield-check" size={12} />
        Needs your approval
      </div>
      <p className="mt-[6px] text-[14px] font-semibold text-slate-900">{title}</p>
      {children && <div className="mt-[8px] text-[12.5px] leading-[1.55] text-slate-600">{children}</div>}
      {blocked && <p className="mt-[8px] rounded-[8px] bg-amber-50 px-[10px] py-[6px] text-[12.5px] text-amber-900">{blocked}</p>}
      <div className="mt-[12px] flex justify-end gap-[8px]">
        <SButton size="small" variant="neutral-outline" className="w-auto" onClick={() => answer(p, { approved: false, reason: 'Merchant said not now' })}>
          {blocked ? 'OK' : 'Not now'}
        </SButton>
        {!blocked && (
          <SButton size="small" variant="primary" className="w-auto" onClick={() => answer(p, onApprove())}>
            {approveLabel}
          </SButton>
        )}
      </div>
    </CardShell>
  )
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[110px_1fr] gap-x-[10px] gap-y-[4px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-slate-500">{k}</dt>
          <dd className="text-slate-800">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function refName(refId?: string | null): string {
  if (!refId) return ''
  const lib = useGrowthLibrary.getState()
  return lib.offers.find((o) => o.id === refId)?.name ?? lib.pricingTables.find((t) => t.id === refId)?.name ?? refId
}

export function ApprovalCard(p: CardProps) {
  const i = p.input
  const growth = parseOwner(ownerOf(p.chatId)).kind === 'growth' || (typeof i.id === 'string' && i.id.startsWith('gx_'))

  switch (p.tool) {
    case 'set_control':
      return (
        <ApprovalShell p={p} title={`Hold out ${i.percent}% as a control group`} onApprove={() => applyControl(p.chatId, i)}>
          <p>{String(i.reason ?? '')}</p>
          <p className="mt-[4px] text-slate-500">
            {growth
              ? 'They see nothing, so you can measure what this experience adds.'
              : 'This is Global control. It applies to every cancel page on your account.'}
          </p>
        </ApprovalShell>
      )
    case 'set_split': {
      const variants = (i.variants as { label: string; refId?: string | null; percent: number }[]) ?? []
      return (
        <ApprovalShell p={p} title="Run a test" approveLabel="Start the test" onApprove={() => applySplit(p.chatId, i)}>
          <p>{String(i.reason ?? '')}</p>
          <ul className="mt-[6px] flex flex-col gap-[3px]">
            {variants.map((v) => (
              <li key={v.label} className="flex justify-between gap-[10px] rounded-[8px] bg-slate-50 px-[10px] py-[5px]">
                <span className="text-slate-800">
                  {v.label}
                  {v.refId ? <span className="text-slate-500"> · {refName(v.refId)}</span> : null}
                </span>
                <span className="font-medium text-slate-900">{v.percent}%</span>
              </li>
            ))}
          </ul>
        </ApprovalShell>
      )
    }
    case 'publish': {
      const gaps = publishGaps(p.chatId, i)
      const name = (detailFor(ownerOf(p.chatId))?.name as string | undefined) ?? 'this experience'
      return (
        <ApprovalShell p={p} title={`Publish “${name}”`} approveLabel={gaps.length ? 'Publish anyway' : 'Publish'} onApprove={() => applyPublish(p.chatId, i)}>
          {gaps.length ? (
            <>
              <p>Still open:</p>
              <ul className="mt-[4px] list-disc pl-[18px]">
                {gaps.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>Everything is set. Subscribers who match will start seeing it.</p>
          )}
        </ApprovalShell>
      )
    }
    case 'create_offer':
    case 'update_offer': {
      const existing = useGrowthLibrary.getState().offers.find((o) => o.id === i.id)
      const v = { ...existing, ...Object.fromEntries(Object.entries(i).filter(([, x]) => x != null)) } as Input
      const create = p.tool === 'create_offer'
      return (
        <ApprovalShell
          p={p}
          title={create ? `Add “${v.name}” to your offers` : `Change “${existing?.name ?? v.name}”`}
          approveLabel={create ? 'Add offer' : 'Save change'}
          onApprove={() => (create ? applyCreateOffer(i) : applyUpdateOffer(i))}
        >
          <div className="mb-[10px] rounded-[10px] border border-slate-200 bg-slate-50 p-[12px]">
            <p className="text-[14px] font-semibold text-slate-900">{String(v.title ?? '')}</p>
            <p className="mt-[2px] text-[12.5px] text-slate-600">{String(v.description ?? '')}</p>
            <span className="mt-[8px] inline-block rounded-[7px] bg-slate-900 px-[10px] py-[4px] text-[12px] font-medium text-white">{String(v.cta ?? 'Accept')}</span>
          </div>
          <Facts
            rows={[
              ['Value', String(v.value ?? '')],
              ['Shown as', WIDGET_LABEL[v.widget as OfferWidget] ?? String(v.widget ?? '')],
              ['Category', CATEGORY_LABEL[v.category as OfferCategory] ?? String(v.category ?? '')],
              ['On accept', PROCESSING_LABEL[v.processing as OfferProcessing] ?? String(v.processing ?? '')],
            ]}
          />
        </ApprovalShell>
      )
    }
    case 'archive_offer': {
      const blockers = archiveBlockers(i)
      const name = useGrowthLibrary.getState().offers.find((o) => o.id === i.id)?.name ?? 'this offer'
      return (
        <ApprovalShell
          p={p}
          title={`Archive “${name}”`}
          approveLabel="Archive"
          onApprove={() => applyArchiveOffer(i)}
          blocked={blockers.length ? `It is used in ${blockers.join(', ')}. Remove it there first.` : undefined}
        />
      )
    }
    case 'create_pricing_table': {
      const plans = CATALOG_PLANS.filter((x) => ((i.planIds as string[]) ?? []).includes(x.id))
      return (
        <ApprovalShell p={p} title={`Add “${i.name}” to your pricing tables`} approveLabel="Add table" onApprove={() => applyCreatePricingTable(i)}>
          <div className="flex flex-wrap gap-[6px]">
            {plans.map((x) => (
              <span key={x.id} className="rounded-[8px] border border-slate-200 bg-slate-50 px-[10px] py-[5px] text-[12.5px]">
                <span className="font-medium text-slate-900">{x.name}</span>
                <span className="text-slate-500"> · ${x.price}/{x.period}</span>
              </span>
            ))}
          </div>
          <p className="mt-[6px] text-slate-500">
            {i.cta === 'contact' ? 'Buttons ask them to contact you.' : 'Buttons go to hosted checkout.'}
            {i.hideCurrentPlan ? ' Their current plan is hidden.' : ''}
          </p>
        </ApprovalShell>
      )
    }
    default:
      return null
  }
}

// ---------- show_sample ----------

const SAMPLES: Record<string, { title: string; lines: string[]; route: NavLeafId }> = {
  people: {
    title: 'Audiences',
    lines: ['6 saved audiences.', 'Largest: Paying subscribers, 12,480 people.', 'High risk customers: 1,930, up 8% this month.'],
    route: 'people.audiences',
  },
  renewal: {
    title: 'Renewal Optimization',
    lines: ['214 annual renewals in the next 30 days.', '38 are flagged at risk.', 'Reminder emails go out 14 and 3 days before renewal.'],
    route: 'renewal',
  },
  reports: {
    title: 'Cancels, last 30 days',
    lines: ['1,284 people started to cancel. 412 stayed (32%).', '$18,240 in monthly revenue kept.', 'Top reason: It costs too much (41%).'],
    route: 'reports.cancels',
  },
  settings: {
    title: 'Settings',
    lines: ['Billing is connected and the snippet is installed.', 'Segment and Slack are connected.', 'Global control is set on the cancel page settings.'],
    route: 'settings',
  },
}

export function SampleCard(p: CardProps) {
  const s = SAMPLES[String(p.input.area)] ?? SAMPLES.reports
  return (
    <CardShell>
      <div className="flex items-center justify-between">
        <p className="text-[13.5px] font-semibold text-slate-900">{s.title}</p>
        <span className="rounded-full bg-amber-50 px-[8px] py-[2px] text-[11px] font-medium text-amber-800">Sample data</span>
      </div>
      <ul className="mt-[6px] flex flex-col gap-[3px] text-[12.5px] leading-[1.55] text-slate-600">
        {s.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => useGrowthShell.getState().go(s.route)}
        className="mt-[10px] inline-flex items-center gap-[4px] text-[12.5px] font-medium text-slate-700 hover:text-slate-900"
      >
        Open {labelOf(s.route)}
        <SIcon name="arrow-right" size={12} />
      </button>
    </CardShell>
  )
}
