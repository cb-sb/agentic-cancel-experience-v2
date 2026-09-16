import type { JourneyTemplate } from '../journey/types'
import { MatchSiteCard } from '../brand/MatchSiteCard'
import radioOnUrl from './assets/copilot-radio-on.svg'
import gridUrl from './assets/copilot-grid.svg'
import chevronUrl from './assets/copilot-chevron.svg'
import uploadUrl from './assets/copilot-upload.svg'

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-bold uppercase leading-normal text-[#4b5563]">{children}</p>
  )
}

function FlowOption({
  selected,
  label,
  hint,
  badge,
  onClick,
}: {
  selected?: boolean
  label: string
  hint: string
  badge?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-[12px] bg-white p-4 text-left transition-colors ${
        selected
          ? 'border-[1.5px] border-[#6366f1] shadow-[0px_2px_4px_rgba(79,70,229,0.05)]'
          : 'border border-[#e5e7eb] hover:border-slate-300'
      }`}
    >
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center" aria-hidden>
        {selected ? (
          <img src={radioOnUrl} alt="" width={16} height={16} className="block size-4" />
        ) : (
          <span className="block size-4 rounded-full border-2 border-[#9ca3af]" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold leading-normal text-[#111827]">{label}</span>
        <span className="mt-1 block text-[12px] font-normal leading-[1.3] text-[#4b5563]">{hint}</span>
        {badge && (
          <span className="mt-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold leading-normal text-[#4f46e5] bg-[#eef2ff]">
            {badge}
          </span>
        )}
      </span>
    </button>
  )
}

function ResourceRow({
  icon,
  iconBox,
  label,
  hint,
  onClick,
}: {
  icon: string
  iconBox: string
  label: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50"
    >
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${iconBox}`}>
        <img src={icon} alt="" width={18} height={18} className="block size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold leading-normal text-[#111827]">{label}</span>
        <span className="mt-0.5 block text-[12px] leading-[1.3] text-[#4b5563]">{hint}</span>
      </span>
      <img src={chevronUrl} alt="" width={16} height={16} className="block size-4 shrink-0" />
    </button>
  )
}

export function CopilotHomeSetup({
  onGuide,
  onRecommend,
  onTemplates,
  onYours,
  onUpload,
  onAcquire,
}: {
  onGuide: () => void
  onRecommend: (template: JourneyTemplate, said: string) => void
  onTemplates: () => void
  onYours: () => void
  onUpload: () => void
  onAcquire: () => void
}) {
  return (
    <div className="flex w-full flex-col gap-6">
      <section className="flex flex-col gap-2">
        <SectionLabel>Match your site</SectionLabel>
        <MatchSiteCard setup />
      </section>

      <section className="flex flex-col gap-2">
        <SectionLabel>Start a Cancel Flow</SectionLabel>
        <div className="flex flex-col gap-2">
          <FlowOption
            selected
            label="Help me choose a cancel flow"
            hint="I'll ask the job, then recommend a path"
            badge="AI ASSISTED"
            onClick={onGuide}
          />
          <FlowOption
            label="Use the recommended 4-step default"
            hint="Value, survey, one save offer, confirm"
            onClick={() => onRecommend('cancel_4', 'Use the recommended 4-step default')}
          />
          <FlowOption
            label="Offer a cheaper plan before they leave"
            hint="Pricing table and checkout, then they can still cancel"
            onClick={() =>
              onRecommend('cancel_plan_change', 'Offer a cheaper plan before they leave')
            }
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <SectionLabel>Templates & Resources</SectionLabel>
        <div className="overflow-hidden rounded-[12px] border border-[#e5e7eb] bg-white">
          <ResourceRow
            icon={gridUrl}
            iconBox="bg-[#eef2ff]"
            label="Browse templates"
            hint="Chargebee postures — Copilot takes it from there"
            onClick={onTemplates}
          />
          <div className="border-t border-[#e5e7eb]">
            <ResourceRow
              icon={gridUrl}
              iconBox="bg-[#ecfdf3]"
              label="My existing templates"
              hint="Confirmed scans and saved components"
              onClick={onYours}
            />
          </div>
          <div className="border-t border-[#e5e7eb]">
            <ResourceRow
              icon={uploadUrl}
              iconBox="bg-[#f9fafb]"
              label="Upload a template"
              hint="Get the kit, then drop the designed HTML"
              onClick={onUpload}
            />
          </div>
        </div>
      </section>

      <p className="pt-2 text-center text-[12px] leading-[1.3] text-[#4b5563]">
        Acquiring a subscriber instead?
        <br />
        <button
          type="button"
          onClick={onAcquire}
          className="font-semibold text-[#4f46e5] underline decoration-solid underline-offset-2"
        >
          Pricing table → hosted checkout
        </button>
      </p>
    </div>
  )
}
