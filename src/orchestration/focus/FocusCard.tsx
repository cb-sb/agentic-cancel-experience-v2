import { DEVICE_WIDTHS } from '../../render/DeviceFrame'
import { useExperience } from '../../store/useExperience'
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
  const { experience, step, position } = session

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
        <div data-focus-card={DEVICE_WIDTHS[device]}>
          <CanvasStep
            step={step}
            index={position.index}
            total={position.total}
            width={DEVICE_WIDTHS[device]}
            experienceId={experience.id}
          />
        </div>
      </div>
    </div>
  )
}
