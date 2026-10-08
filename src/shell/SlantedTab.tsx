import type { ButtonHTMLAttributes } from 'react'

const TAB_CLIP = 'polygon(14px 0, calc(100% - 14px) 0, 100% 100%, 0 100%)'

/** Tilting the backing layer keeps its rounded corners and border on the slanted sides. */
const ROUNDED_SHAPE = { transform: 'perspective(20px) rotateX(5deg)', transformOrigin: 'bottom' }

/** A fixed destination tab attached to the content beneath it. */
export function SlantedTab({
  label,
  active,
  first,
  rounded,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  active: boolean
  first?: boolean
  rounded?: boolean
}) {
  if (rounded) {
    return (
      <button
        type="button"
        {...props}
        className={`group relative flex h-[36px] flex-none items-center justify-center px-[32px] text-[13px] font-semibold uppercase tracking-[0.03em] ${first ? '' : '-ml-[8px]'} ${
          active ? 'z-10 text-white' : 'text-slate-800'
        } ${className}`}
      >
        <span
          aria-hidden
          className={`absolute inset-0 rounded-t-[7px] border border-b-0 ${
            active ? 'border-[#1b1a2e] bg-[#1b1a2e]' : 'border-[#1b1a2e] bg-[#f3f2f7] group-hover:bg-[#e9e8f0]'
          }`}
          style={ROUNDED_SHAPE}
        />
        <span className="relative translate-y-[3px]">{label}</span>
      </button>
    )
  }
  return (
    <button
      type="button"
      {...props}
      className={`relative h-9 flex-none px-7 text-[12px] font-medium uppercase tracking-[0.06em] ${first ? '' : '-ml-2'} ${
        active ? 'z-10 bg-[#1a1c2e] text-white' : 'bg-white text-slate-800 shadow-[inset_0_0_0_1px_#e5e7eb] hover:bg-[#f3f3f3]'
      } ${className}`}
      style={{ ...props.style, clipPath: TAB_CLIP }}
    >
      {label}
    </button>
  )
}
