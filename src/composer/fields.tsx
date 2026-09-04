import type { ReactNode } from 'react'
import { SIcon, SInput, SSelect, SSwitch, STextarea, type SIconName } from '@chargebee/sting-react'

export function Field({
  label,
  hint,
  children,
}: {
  label?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      {label && <div className="mb-1 text-[12px] font-semibold text-slate-600">{label}</div>}
      {children}
      {hint && <div className="mt-1 text-[11px] text-slate-400">{hint}</div>}
    </label>
  )
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  trailingIcon,
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
  /** Marks the field as editable copy rather than a fixed setting. */
  trailingIcon?: SIconName
}) {
  return (
    <Field label={label} hint={hint}>
      <SInput
        value={value}
        placeholder={placeholder}
        trailingIcon={trailingIcon}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  hint,
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  hint?: string
}) {
  return (
    <Field label={label} hint={hint}>
      <STextarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange((e.target as HTMLTextAreaElement).value)}
      />
    </Field>
  )
}

/**
 * Clear control for a select, replacing the one Sting draws.
 *
 * Its own is a bare ✕ at the same size and stroke as the chevron beside it, so
 * the two read as a single pair of glyphs and neither says what it does. A
 * smaller, enclosed mark is legible as its own control at a glance.
 */
function ClearButton({ onClear }: { onClear: () => void }) {
  return (
    <span
      role="button"
      aria-label="Clear"
      // The trigger is itself a button, so this cannot be one. The events have
      // to stop here too, or clearing would also open the list behind it.
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        onClear()
      }}
      className="flex cursor-pointer items-center text-slate-300 transition-colors hover:text-slate-500"
    >
      <SIcon name="circle-x" size={13} />
    </span>
  )
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
  placeholder,
  prefix,
  clearable,
}: {
  label?: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  hint?: string
  placeholder?: string
  /** Shown at the start of the trigger, to say what kind of thing this holds. */
  prefix?: ReactNode
  /** Only for settings that are genuinely optional — clearing must mean something. */
  clearable?: boolean
}) {
  return (
    <Field label={label} hint={hint}>
      <SSelect
        options={options}
        value={value}
        placeholder={placeholder}
        prefix={prefix}
        clearable={clearable}
        hideGlobalClear
        suffix={clearable && value ? <ClearButton onClear={() => onChange('' as T)} /> : undefined}
        onValueChange={(v) => onChange(v as T)}
      />
    </Field>
  )
}

export function SwitchField({
  label,
  checked,
  onChange,
  description,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  description?: string
}) {
  return (
    <SSwitch label={label} description={description} checked={checked} onCheckedChange={onChange} />
  )
}
