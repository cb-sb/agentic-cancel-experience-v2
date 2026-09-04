import { useCallback, useEffect, useMemo } from 'react'
import { buildStepColumns } from '../../lib/stepColumns'
import { useExperience } from '../../store/useExperience'
import { useOrchestration } from '../../store/useOrchestration'
import type { Experience, Step } from '../../types/experience'

export interface FocusSession {
  experience: Experience
  step: Step
  /** Where this card sits in the journey, as the subscriber would count it. */
  position: { index: number; total: number }
  /** Every card of the experience, in the order the switcher lists them. */
  order: string[]
  /** Index of the current card within `order`; -1 if it has gone. */
  at: number
  go: (delta: number) => void
  exit: () => void
}

/**
 * Everything a focus presentation needs that is not about how it looks.
 *
 * Both presentations walk the same cards, count positions the same way and
 * answer to the same keys; only the container differs. Keeping that here is
 * what makes the two genuinely comparable — a difference the merchant notices
 * is a difference in presentation, not in behaviour that drifted apart.
 */
export function useFocusSession(): FocusSession | null {
  const focusTarget = useOrchestration((s) => s.focusTarget)
  const focusStep = useOrchestration((s) => s.focusStep)
  const exitFocus = useOrchestration((s) => s.exitFocus)
  const experiences = useExperience((s) => s.experiences)

  const experience = focusTarget ? experiences[focusTarget.experienceId] ?? null : null
  const stepId = focusTarget?.stepId ?? null
  const step = experience?.steps.find((s) => s.id === stepId) ?? null

  /**
   * Disabled steps are not shown to anyone, and a column of interchangeable
   * offers is one moment in the journey however many variants sit in it.
   */
  const position = useMemo(() => {
    if (!experience || !stepId) return { index: 0, total: 1 }
    const cols = buildStepColumns(experience.steps.filter((s) => !s.disabled))
    const index = cols.findIndex((c) => c.steps.some(({ step: s }) => s.id === stepId))
    return { index: Math.max(0, index), total: Math.max(1, cols.length) }
  }, [experience, stepId])

  const order = useMemo(() => experience?.steps.map((s) => s.id) ?? [], [experience])
  const at = stepId ? order.indexOf(stepId) : -1

  const go = useCallback(
    (delta: number) => {
      const next = order[at + delta]
      if (next && experience) focusStep({ experienceId: experience.id, stepId: next })
    },
    [order, at, experience, focusStep],
  )

  useEffect(() => {
    if (!focusTarget) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        exitFocus()
        return
      }
      // Arrows belong to the caret whenever text is being edited.
      const el = document.activeElement as HTMLElement | null
      if (el?.isContentEditable || el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusTarget, exitFocus, go])

  if (!focusTarget || !experience || !step) return null
  return { experience, step, position, order, at, go, exit: exitFocus }
}
