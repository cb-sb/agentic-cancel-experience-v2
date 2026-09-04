import { createElement, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useRenderCtx } from './RenderContext'
import { brandBtnBorderStyle } from './brand'

/** Strip HTML tags — for places that need the plain string (checkout title, etc.). */
export function stripHtml(html: string): string {
  const el = document.createElement('div')
  el.innerHTML = html
  return el.textContent ?? ''
}

/** Count words in plain text (whitespace-separated tokens). */
function countWords(text: string): number {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

interface RichToolbarProps {
  x: number
  y: number
}

function exec(cmd: string, value?: string) {
  document.execCommand(cmd, false, value)
}

/**
 * Apply one of the locked S/M/L sizes to the selection. We use execCommand
 * fontSize (2/4/6) and map those to a fixed em scale in CSS so merchants can
 * never enter arbitrary pixel values (Scope 3 guardrail).
 */
function setSize(size: 'S' | 'M' | 'L') {
  exec('fontSize', size === 'S' ? '2' : size === 'L' ? '6' : '4')
}

const ToolButton = ({
  label,
  title,
  onRun,
  active,
  style,
}: {
  label: React.ReactNode
  title: string
  onRun: () => void
  active?: boolean
  style?: CSSProperties
}) => (
  <button
    type="button"
    title={title}
    className={active ? 'is-active' : undefined}
    // preventDefault keeps the text selection alive while we run the command.
    onMouseDown={(e) => {
      e.preventDefault()
      onRun()
    }}
    style={style}
  >
    {label}
  </button>
)

/** True when the current selection has the given inline command applied. */
function isActive(cmd: string) {
  try {
    return document.queryCommandState(cmd)
  } catch {
    return false
  }
}

/** Turn the current selection into (or out of) a link, restoring the range that
 * the browser drops while the prompt is open. */
function applyLink() {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
  const range = sel.getRangeAt(0).cloneRange()
  const startEl =
    range.startContainer.nodeType === 1
      ? (range.startContainer as HTMLElement)
      : range.startContainer.parentElement
  const host = startEl?.closest('[contenteditable="true"]') as HTMLElement | null
  const existingHref =
    (sel.anchorNode?.parentElement?.closest('a') as HTMLAnchorElement | null)?.getAttribute('href') ?? ''

  const input = window.prompt('Link URL', existingHref || 'https://')
  if (input === null) return

  // Restore focus + selection the prompt tore down, then run the command.
  host?.focus()
  sel.removeAllRanges()
  sel.addRange(range)
  const url = input.trim()
  if (url === '') exec('unlink')
  else exec('createLink', url)
}

/**
 * Scope-3 inline formatting only (per guidelines): bold, italic, underline, an
 * accessible link, and a locked S/M/L size scale. Lists, strikethrough, code,
 * colour and arbitrary sizes are intentionally excluded. Styled to match the
 * builder chrome (light surface, slate borders, blue active state).
 */
function RichToolbar({ x, y }: RichToolbarProps) {
  return createPortal(
    <div
      className="rt-toolbar"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <ToolButton active={isActive('bold')} label={<b>B</b>} title="Bold" onRun={() => exec('bold')} />
      <ToolButton
        active={isActive('italic')}
        label={<span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>i</span>}
        title="Italic"
        onRun={() => exec('italic')}
      />
      <ToolButton
        active={isActive('underline')}
        label={<span style={{ textDecoration: 'underline' }}>U</span>}
        title="Underline"
        onRun={() => exec('underline')}
      />
      <span className="rt-sep" />
      <ToolButton
        title="Link"
        onRun={applyLink}
        label={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        }
      />
      <span className="rt-sep" />
      <ToolButton label={<span style={{ fontSize: 11, fontWeight: 600 }}>S</span>} title="Small" onRun={() => setSize('S')} />
      <ToolButton label={<span style={{ fontSize: 13, fontWeight: 600 }}>M</span>} title="Medium" onRun={() => setSize('M')} />
      <ToolButton label={<span style={{ fontSize: 15, fontWeight: 700 }}>L</span>} title="Large" onRun={() => setSize('L')} />
    </div>,
    document.body,
  )
}

type Tag = 'span' | 'p' | 'h2' | 'h3' | 'h4' | 'div' | 'label'

interface EditableTextProps {
  value: string
  onCommit: (html: string) => void
  as?: Tag
  className?: string
  style?: CSSProperties
  placeholder?: string
  /** Single-line: block Enter from inserting newlines. */
  singleLine?: boolean
  /** Guardrail: cap the plain-text length (blocks typing/paste past the limit). */
  maxChars?: number
  /** Guardrail: cap the plain-text word count (blocks typing/paste past the limit). */
  maxWords?: number
}

/**
 * Inline-editable text. In Play mode it renders static HTML; in Compose mode it
 * becomes a contentEditable with the dark-blue "editable" affordance and a
 * Notion-style floating rich-text toolbar on selection.
 */
export function EditableText({
  value,
  onCommit,
  as = 'span',
  className,
  style,
  placeholder,
  singleLine,
  maxChars,
  maxWords,
}: EditableTextProps) {
  const { mode } = useRenderCtx()
  const ref = useRef<HTMLElement>(null)
  const [toolbar, setToolbar] = useState<{ x: number; y: number } | null>(null)
  const [focused, setFocused] = useState(false)
  const [charCount, setCharCount] = useState(() => stripHtml(value ?? '').length)

  /** Length that a pending insertion would leave the field at, given selection. */
  const roomFor = () => {
    const el = ref.current
    if (!el || maxChars == null) return Infinity
    const sel = window.getSelection()
    const selLen = sel && !sel.isCollapsed && el.contains(sel.anchorNode) ? sel.toString().length : 0
    return maxChars - ((el.textContent ?? '').length - selLen)
  }

  /** Whether incoming text would exceed the word cap. */
  const wouldExceedWords = (incoming: string) => {
    const el = ref.current
    if (!el || maxWords == null) return false
    const sel = window.getSelection()
    const selText = sel && !sel.isCollapsed && el.contains(sel.anchorNode) ? sel.toString() : ''
    const base = (el.textContent ?? '').slice(0, (el.textContent ?? '').length - selText.length)
    const next = `${base}${incoming}`.replace(/\s+/g, ' ').trim()
    return countWords(next) > maxWords
  }

  const refreshCharCount = () => {
    const len = (ref.current?.textContent ?? '').length
    setCharCount(len)
  }

  const showCounter =
    maxChars != null && (focused || charCount >= Math.floor(maxChars * 0.8))

  // Keep the DOM in sync with the store without clobbering the caret while focused.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (document.activeElement !== el && el.innerHTML !== (value ?? '')) {
      el.innerHTML = value ?? ''
    }
    setCharCount(stripHtml(value ?? '').length)
  }, [value, mode])

  if (mode !== 'compose') {
    return createElement(as, {
      className: `rich-html ${className ?? ''}`,
      style,
      dangerouslySetInnerHTML: { __html: value ?? '' },
    })
  }

  const refreshToolbar = () => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !ref.current || !ref.current.contains(sel.anchorNode)) {
      setToolbar(null)
      return
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) {
      setToolbar(null)
      return
    }
    setToolbar({ x: rect.left + rect.width / 2, y: rect.top })
  }

  const commit = () => {
    const html = ref.current?.innerHTML ?? ''
    if (html !== value) onCommit(html)
  }

  const isInline = as === 'span' || as === 'label'
  const Wrapper = isInline ? 'span' : 'div'
  const wrapClass = isInline ? 'editable-wrap relative inline max-w-full align-top' : 'editable-wrap relative block w-full'

  return (
    <Wrapper className={wrapClass}>
      {createElement(as, {
        ref,
        className: `editable ${className ?? ''}`,
        style,
        contentEditable: true,
        suppressContentEditableWarning: true,
        'data-placeholder': placeholder,
        spellCheck: false,
        onMouseUp: refreshToolbar,
        onKeyUp: () => {
          refreshToolbar()
          refreshCharCount()
        },
        onFocus: () => setFocused(true),
        onBeforeInput:
          maxChars == null && maxWords == null
            ? undefined
            : (e: React.FormEvent) => {
                const native = e.nativeEvent as InputEvent
                if (!native.inputType || !native.inputType.startsWith('insert')) return
                const incoming = native.data ?? ''
                if (maxChars != null) {
                  const incomingLen = incoming ? incoming.length : 1
                  if (incomingLen > roomFor()) e.preventDefault()
                }
                if (maxWords != null && wouldExceedWords(incoming || ' ')) e.preventDefault()
              },
        onPaste:
          maxChars == null && maxWords == null
            ? undefined
            : (e: React.ClipboardEvent) => {
                e.preventDefault()
                let text = e.clipboardData.getData('text/plain')
                if (maxChars != null) {
                  const room = roomFor()
                  if (room <= 0) return
                  text = text.slice(0, room)
                }
                if (maxWords != null) {
                  const el = ref.current
                  const sel = window.getSelection()
                  const selText =
                    sel && !sel.isCollapsed && el?.contains(sel.anchorNode) ? sel.toString() : ''
                  const base = ((el?.textContent ?? '') as string).slice(
                    0,
                    (el?.textContent ?? '').length - selText.length,
                  )
                  let candidate = `${base}${text}`.replace(/\s+/g, ' ').trim()
                  while (candidate && countWords(candidate) > maxWords) {
                    text = text.slice(0, -1)
                    candidate = `${base}${text}`.replace(/\s+/g, ' ').trim()
                  }
                  if (!text) return
                }
                exec('insertText', text)
                refreshCharCount()
              },
        onKeyDown: (e: React.KeyboardEvent) => {
          if (singleLine && e.key === 'Enter') {
            e.preventDefault()
            ;(e.target as HTMLElement).blur()
          }
        },
        onBlur: () => {
          setFocused(false)
          commit()
          refreshCharCount()
          // Delay so a toolbar click can run before we tear it down.
          setTimeout(() => setToolbar(null), 150)
        },
        onInput: refreshCharCount,
      })}
      {showCounter && (
        <span
          className="editable-counter pointer-events-none absolute -bottom-5 right-0 z-10 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
          aria-hidden
        >
          {charCount}/{maxChars}
        </span>
      )}
      {toolbar && <RichToolbar x={toolbar.x} y={toolbar.y} />}
    </Wrapper>
  )
}

interface EditableCTAProps {
  label: string
  onCommit: (html: string) => void
  onClick?: () => void
  style: CSSProperties
  className?: string
  maxChars?: number
  disabled?: boolean
}

/**
 * A CTA button that is inline-editable in Compose mode and clickable in Play
 * mode. Width always hugs its text (no unnecessary full-width buttons).
 */
export function EditableCTA({ label, onCommit, onClick, style, className, maxChars, disabled }: EditableCTAProps) {
  const { mode } = useRenderCtx()
  const base: CSSProperties = { display: 'inline-flex', alignItems: 'center', ...brandBtnBorderStyle(), ...style }

  if (mode === 'compose') {
    return (
      <span style={base} className={className}>
        <EditableText value={label} onCommit={onCommit} singleLine maxChars={maxChars} />
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ ...base, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1 }}
      className={className}
      dangerouslySetInnerHTML={{ __html: label }}
    />
  )
}

/** Small helper to bind editable fields to a single component in the store. */
export function useComponentEdit(componentId: string) {
  const { edit } = useRenderCtx()
  return (patch: Record<string, unknown>) => edit?.updateComponent(componentId, patch as never)
}

/** Trash affordance for removing an inline item — Compose mode only. */
export function InlineDeleteButton({
  onRemove,
  disabled,
  title = 'Remove',
  className,
}: {
  onRemove: () => void
  disabled?: boolean
  title?: string
  /** Extra classes — e.g. hover-reveal on a parent `.group` row. */
  className?: string
}) {
  const { mode } = useRenderCtx()
  if (mode !== 'compose') return null
  return (
    <button
      type="button"
      title={disabled ? 'Minimum reached' : title}
      disabled={disabled}
      onClick={onRemove}
      className={`flex-none rounded-md p-1 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-300 ${className ?? ''}`}
      aria-label={title}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        <path d="M10 11v6M14 11v6" />
      </svg>
    </button>
  )
}

/** Compact "+" icon for adding an item inline at the end of a row — Compose only. */
export function InlineAddIconButton({
  onAdd,
  disabled,
  title = 'Add',
  className,
}: {
  onAdd: () => void
  disabled?: boolean
  title?: string
  className?: string
}) {
  const { mode } = useRenderCtx()
  if (mode !== 'compose') return null
  return (
    <button
      type="button"
      title={disabled ? 'Maximum reached' : title}
      disabled={disabled}
      onClick={onAdd}
      className={`flex-none rounded-md p-1 text-slate-300 transition-colors hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-300 ${className ?? ''}`}
      aria-label={title}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  )
}

/** "+ Add" affordance for adding an inline item — Compose mode only. */
export function InlineAddButton({
  onAdd,
  disabled,
  label,
}: {
  onAdd: () => void
  disabled?: boolean
  label: string
}) {
  const { mode } = useRenderCtx()
  if (mode !== 'compose') return null
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-1.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      style={{ borderColor: '#c7d2fe', color: '#1e40af' }}
      title={disabled ? 'Maximum reached' : label}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
      {label}
    </button>
  )
}
