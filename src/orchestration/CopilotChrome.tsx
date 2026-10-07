import { useEffect, useRef, type ReactNode } from 'react'
import { SIcon, type SIconName } from '@chargebee/sting-react'

/** v9 Copilot chrome, after the Chargebee Assistant panel: a plain header, a boxed composer, blue suggestion chips. */

export const SUGGESTION_CHIP =
  'inline-flex max-w-full items-center gap-[6px] bg-[var(--slg-blue-50)] px-[8px] py-[4px] text-left text-[13px] leading-[20px] text-[var(--slg-blue-700)] transition-colors hover:bg-[color-mix(in_oklch,var(--slg-blue-700)_14%,var(--slg-color-bg-surface))] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--slg-color-focus-ring)]'

export function CopilotHeaderButton({ label, icon, onClick, pressed }: { label: string; icon: SIconName | ReactNode; onClick: () => void; pressed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      className={`flex h-[28px] w-[28px] flex-none items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-[var(--slg-color-focus-ring)] ${
        pressed ? 'bg-[var(--slg-blue-50)] text-[var(--slg-blue-700)]' : 'text-[var(--slg-neutral-700)] hover:bg-[var(--slg-neutral-100)] hover:text-[var(--slg-neutral-900)]'
      }`}
    >
      {typeof icon === 'string' ? <SIcon name={icon as SIconName} size={16} /> : icon}
    </button>
  )
}

export function CopilotHeader({ title = 'Growth Copilot', children }: { title?: string; children?: ReactNode }) {
  return (
    <div className="flex h-[52px] flex-none items-center gap-[8px] bg-[var(--slg-color-bg-surface)] pl-[16px] pr-[12px]">
      <SIcon name="list-collapse" size={16} className="flex-none text-[var(--slg-neutral-900)]" />
      <h2 className="min-w-0 flex-1 truncate text-[14px] font-semibold leading-[20px] text-[var(--slg-neutral-900)]">{title}</h2>
      <div className="flex flex-none items-center gap-[4px]">{children}</div>
    </div>
  )
}

/** Shown while a conversation has nothing in it yet. */
export function CopilotEmpty({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-[8px] py-[24px] text-center">
      <SIcon name="sparkles" size={24} className="text-[var(--slg-blue-200,#bcd4fb)]" />
      <p className="mt-[12px] text-[14px] font-semibold leading-[20px] text-[var(--slg-neutral-900)]">{title}</p>
      <p className="mt-[4px] max-w-[300px] text-[13px] leading-[20px] text-[var(--slg-color-text-secondary)]">{text}</p>
      {children && <div className="mt-[16px] flex flex-col items-center gap-[8px]">{children}</div>}
    </div>
  )
}

export function CopilotComposer({
  value,
  onChange,
  onSend,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  placeholder: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [value])
  return (
    <div className="border border-[var(--slg-neutral-900)] bg-[var(--slg-color-bg-surface)] transition-shadow focus-within:shadow-[0_0_0_1px_var(--slg-neutral-900)]">
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onSend()
          }
        }}
        placeholder={placeholder}
        aria-label="Message Growth Copilot"
        className="block max-h-[140px] min-h-[40px] w-full resize-none bg-transparent px-[12px] pt-[12px] text-[13px] leading-[20px] text-[var(--slg-color-text-primary)] outline-none placeholder:text-[var(--slg-color-text-muted)]"
      />
      <div className="flex items-center justify-between px-[8px] pb-[8px] pt-[4px]">
        <span aria-hidden className="flex h-[28px] w-[28px] items-center justify-center text-[var(--slg-neutral-700)]">
          <SIcon name="paperclip" size={16} />
        </span>
        <button
          type="button"
          onClick={onSend}
          disabled={!value.trim()}
          title="Send"
          aria-label="Send"
          className="flex h-[28px] w-[32px] items-center justify-center bg-[var(--slg-blue-50)] text-[var(--slg-blue-700)] transition-colors hover:bg-[color-mix(in_oklch,var(--slg-blue-700)_14%,var(--slg-color-bg-surface))] disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-[var(--slg-color-focus-ring)]"
        >
          <SIcon name="send" size={15} />
        </button>
      </div>
    </div>
  )
}

export function CopilotDisclaimer() {
  return (
    <p className="mt-[10px] text-[12px] leading-[18px] text-[var(--slg-color-text-muted)]">
      By using Growth Copilot, you accept our <span className="text-[var(--slg-blue-700)]">third-party AI terms</span>.
    </p>
  )
}
