import type { PointerEvent } from 'react'
import { useOrchestration, type AnnotationTarget } from '../store/useOrchestration'

/**
 * Click-to-localise: while annotate mode is on, a pointer down on this element
 * opens the inline composer instead of the canvas's usual select/focus.
 */
export function useAnnotatePick(target: AnnotationTarget | null) {
  const annotateMode = useOrchestration((s) => s.annotateMode)
  const openAnnotation = useOrchestration((s) => s.openAnnotation)
  const currentId = useOrchestration((s) => s.annotationTarget?.id)
  const active = Boolean(target && currentId === target.id)

  const onPointerDown = (e: PointerEvent) => {
    if (!annotateMode || !target) return
    e.stopPropagation()
    e.preventDefault()
    openAnnotation(target)
  }

  const ring = annotateMode
    ? active
      ? 'cursor-crosshair ring-2 ring-sky-500 ring-offset-2 ring-offset-transparent'
      : 'cursor-crosshair hover:ring-2 hover:ring-sky-400/80'
    : ''

  return {
    annotateMode,
    active,
    onPointerDown,
    /** Capture so nested buttons cannot swallow the pick. */
    hitProps: annotateMode && target ? { onPointerDownCapture: onPointerDown } : {},
    ring,
  }
}
