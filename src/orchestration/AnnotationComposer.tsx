import { useEffect, useRef, useState } from 'react'
import { useOrchestration, type AnnotationTarget } from '../store/useOrchestration'
import { useAssistant } from './assistant/useAssistant'

/**
 * A compact popover anchored next to a canvas element. It captures input right
 * beside the element, but the question and the assistant's reply are pushed to
 * the main chat window (via submitAnnotation).
 */
export function AnnotationComposer({ target }: { target: AnnotationTarget }) {
  const submitAnnotation = useAssistant((s) => s.submitAnnotation)
  const closeAnnotation = useOrchestration((s) => s.closeAnnotation)
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  const send = () => {
    const t = text.trim()
    if (!t) return
    submitAnnotation(target, t)
    closeAnnotation()
  }

  return (
    <div
      data-canvas-overlay="true"
      onPointerDown={(e) => e.stopPropagation()}
      className="w-[288px] cursor-default rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 ring-1 ring-inset ring-indigo-100">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
          </svg>
          {target.label}
        </span>
        <button
          type="button"
          onClick={closeAnnotation}
          title="Cancel"
          className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <textarea
        ref={ref}
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            send()
          }
          if (e.key === 'Escape') closeAnnotation()
        }}
        placeholder="Ask about this, or request a change…"
        className="max-h-[120px] w-full resize-none rounded-lg border border-slate-200 px-2.5 py-2 text-[12.5px] leading-relaxed text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10.5px] text-slate-400">Reply appears in chat</span>
        <button
          type="button"
          onClick={send}
          disabled={!text.trim()}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:bg-slate-800 disabled:opacity-40"
        >
          Ask
        </button>
      </div>
    </div>
  )
}
