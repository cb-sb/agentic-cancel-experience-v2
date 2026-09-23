export function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-bold uppercase leading-normal text-[#4b5563]">{children}</p>
  )
}

export function OptionBtn({
  label,
  hint,
  onClick,
  pill,
}: {
  label: string
  hint?: string
  onClick: () => void
  pill?: boolean
}) {
  if (pill) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center rounded-[14px] border border-[#e5e7eb] bg-white px-[18px] py-[14px] text-left text-[14px] leading-snug text-[#19191f] transition-colors hover:bg-[#fbfcfd]"
      >
        {label}
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-full w-full flex-col rounded-[16px] border border-[#e5e7eb] bg-white px-[16px] py-[14px] text-left transition-colors hover:bg-[#fbfcfd]"
    >
      <div className="text-[14px] font-medium text-[#19191f]">{label}</div>
      {hint && <div className="mt-[4px] text-[12.5px] leading-[1.5] text-[#677488]">{hint}</div>}
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
      <div className="flex flex-col gap-[12px]">
        <OptionBtn pill label="Start me off with a Chargebee template" onClick={onTemplate} />
        <OptionBtn pill label="I’ll upload my own template to work from" onClick={onUpload} />
        <OptionBtn pill label="Help me pick the right path for this cancel" onClick={onGuide} />
      </div>
    </div>
  )
}
