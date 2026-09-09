import type { PointerEvent } from 'react'
import { compactStepLabel } from '../../lib/stepLabels'
import { DEVICE_WIDTHS } from '../../render/DeviceFrame'
import { useExperience } from '../../store/useExperience'
import { useOrchestration } from '../../store/useOrchestration'
import { AnnotationComposer } from '../AnnotationComposer'
import { CanvasStep } from '../CanvasStep'
import type { FocusSession } from './useFocusSession'

/**
 * The focused card and the room it scrolls in.
 *
 * Shared by both presentations so the thing being compared is genuinely the
 * same thing. The card is authored at the device width and never scaled, which
 * is what keeps its text editable in place rather than drawn through a
 * transform — `scripts/focus-audit.ts` asserts exactly that.
 */
export function FocusCard({ session, padX = 80 }: { session: FocusSession; padX?: number }) {
  const device = useExperience((s) => s.device)
  const annotateMode = useOrchestration((s) => s.annotateMode)
  const openAnnotation = useOrchestration((s) => s.openAnnotation)
  const annotationTarget = useOrchestration((s) => s.annotationTarget)
  const { experience, step, position } = session

  const target = {
    id: `focus:${experience.id}:${step.id}`,
    kind: 'step' as const,
    label: compactStepLabel(step),
    experienceId: experience.id,
    stepId: step.id,
  }
  const annotating = annotationTarget?.id === target.id

  const onAnnotateDown = (e: PointerEvent) => {
    if (!annotateMode) return
    const el = e.target as HTMLElement
    if (el.closest('[contenteditable="true"], input, textarea, [data-annotation-composer]')) return
    e.stopPropagation()
    e.preventDefault()
    openAnnotation(target)
  }

  return (
    // The card is the only thing that scrolls: adding components makes it
    // longer, and that is the one movement focus mode allows.
    <div data-focus-shell className="nowheel h-full overflow-y-auto">
      {/* min-h-full is what makes centring safe: a card taller than the pane
          grows this wrapper instead of overflowing it, so the top of the card
          never ends up above the scroll origin. */}
      <div
        className="flex min-h-full items-center justify-center py-10"
        style={{ paddingLeft: padX, paddingRight: padX }}
      >
        <div
          data-focus-card={DEVICE_WIDTHS[device]}
          className={`relative rounded-[28px] ${
            annotateMode
              ? annotating
                ? 'ring-2 ring-sky-500 ring-offset-2 ring-offset-slate-100'
                : 'cursor-crosshair hover:ring-2 hover:ring-sky-400/80'
              : ''
          }`}
          onPointerDownCapture={onAnnotateDown}
        >
          <CanvasStep
            step={step}
            index={position.index}
            total={position.total}
            width={DEVICE_WIDTHS[device]}
            experienceId={experience.id}
          />
          {annotating && annotationTarget && (
            <div className="absolute right-3 top-3 z-20" data-annotation-composer>
              <AnnotationComposer target={annotationTarget} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
