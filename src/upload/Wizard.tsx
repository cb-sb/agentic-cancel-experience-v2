import { SIcon } from '@chargebee/sting-react'

export function WizardStepper({ steps, active }: { steps: string[]; active: number }) {
  return (
    <ol className="flex items-center gap-[12px]">
      {steps.map((label, i) => {
        const done = active > i
        const current = active === i
        return (
          <li key={label} className={`flex items-center gap-[12px] ${i < steps.length - 1 ? 'flex-1' : ''}`}>
            <span
              aria-current={current ? 'step' : undefined}
              className={`flex flex-none items-center gap-[8px] text-[13px] font-semibold ${
                current ? 'text-slate-900' : done ? 'text-slate-700' : 'text-slate-400'
              }`}
            >
              <span
                className={`flex h-[24px] w-[24px] flex-none items-center justify-center rounded-full text-[12px] tabular-nums ${
                  current
                    ? 'bg-indigo-600 text-white shadow-[0_0_0_4px_rgba(79,70,229,0.12)]'
                    : done
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-400'
                }`}
              >
                {done ? <SIcon name="check" size={13} /> : i + 1}
              </span>
              {label}
            </span>
            {i < steps.length - 1 && (
              <span aria-hidden className={`h-[2px] min-w-[16px] flex-1 rounded-full ${done ? 'bg-indigo-600' : 'bg-slate-200'}`} />
            )}
          </li>
        )
      })}
    </ol>
  )
}

export function WizardBody({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[28px] py-[24px]">
      <h2 className="text-[18px] font-bold tracking-tight text-[#19191f]">{title}</h2>
      <p className="mt-[4px] text-[13px] leading-[1.55] text-[#677488]">{description}</p>
      <div className="mt-[20px]">{children}</div>
    </div>
  )
}

export function WizardFooter({ left, right }: { left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex flex-none flex-wrap items-center justify-between gap-[12px] border-t border-slate-100 bg-slate-50/70 px-[28px] py-[14px]">
      <div className="flex min-w-0 items-center gap-[8px]">{left}</div>
      <div className="ml-auto flex min-w-0 items-center gap-[8px]">{right}</div>
    </div>
  )
}
