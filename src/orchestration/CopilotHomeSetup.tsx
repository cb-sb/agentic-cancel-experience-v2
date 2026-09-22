export function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-bold uppercase leading-normal text-[#4b5563]">{children}</p>
  )
}

export function OptionBtn({
  label,
  hint,
  onClick,
}: {
  label: string
  hint?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[16px] border border-[#e5e7eb] bg-white px-[16px] py-[12px] text-left transition-colors hover:bg-[#fbfcfd]"
    >
      <div className="text-[14px] font-medium text-[#19191f]">{label}</div>
      {hint && <div className="mt-[2px] text-[12.5px] text-[#677488]">{hint}</div>}
    </button>
  )
}

/** First Copilot screen — the three start paths, as chat rows. */
export function StartPaths({
  onTemplate,
  onUpload,
  onGuide,
}: {
  onTemplate: () => void
  onUpload: () => void
  onGuide: () => void
}) {
  return (
    <div className="space-y-2">
      <p className="px-1 text-[15px] font-semibold leading-snug text-[#19191f]">Start a cancel experience</p>
      <p className="px-1 pb-1 text-[13px] leading-[1.5] text-[#677488]">
        Pick a path. You’ll get a subscriber journey you can walk before anything goes live.
      </p>
      <OptionBtn
        label="Start with a template"
        hint="Pick a Chargebee posture, or reopen chrome you already scanned."
        onClick={onTemplate}
      />
      <OptionBtn
        label="Upload a template"
        hint="Download the Growth kit, compose an experience with your LLM, then drop the marked HTML."
        onClick={onUpload}
      />
      <OptionBtn
        label="Help me start"
        hint="Don’t make me think. Copilot asks the job, then recommends a path."
        onClick={onGuide}
      />
    </div>
  )
}
