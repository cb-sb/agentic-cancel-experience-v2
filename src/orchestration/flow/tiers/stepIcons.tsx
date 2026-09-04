import type { ExperienceComponent, Step } from '../../../types/experience'
import { leadComponent } from './stepFacts'

/**
 * One glyph per kind of step, drawn as bare paths on a 24 grid.
 *
 * By kind, not by offer variant: an 11px glyph cannot tell a discount from a
 * pause, and it does not need to — the name sitting next to it already says
 * which one it is. What the icon carries is the thing a name cannot at a glance,
 * which is what *sort* of screen this is.
 *
 * Kept to two or three strokes each. Anything more detailed turns to mush at the
 * size these are actually drawn at, which is the only size that matters here.
 */
const GLYPHS: Record<ExperienceComponent['kind'], string[]> = {
  // A list of reasons, longest first.
  survey: ['M4 6.5h16', 'M4 12h11', 'M4 17.5h13'],
  // A tag: something being offered.
  offer: ['M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8Z', 'M7 7h.01'],
  // A shield: what they stand to lose.
  loss_aversion: ['M12 3l8 3v6c0 5.2-4 8.3-8 9-4-.7-8-3.8-8-9V6z'],
  // Plans side by side.
  pricing_table: ['M4 4h16v16H4z', 'M4 9.5h16', 'M12 9.5V20'],
  checkout: ['M3 7h18v12H3z', 'M3 11h18', 'M7 15h4'],
  // The decision itself.
  confirmation: ['M20 6.5 9.5 17 4 11.5'],
  // Where they came out.
  outcome: ['M5 21V4', 'M5 4.5h12l-2.2 4L17 12.5H5z'],
}

export function StepIcon({ step, size = 12 }: { step: Step; size?: number }) {
  return <KindIcon kind={leadComponent(step)?.kind ?? 'survey'} size={size} />
}

/** The same glyph, for a card that lists its components one by one. */
export function KindIcon({
  kind,
  size = 12,
}: {
  kind: ExperienceComponent['kind']
  size?: number
}) {
  const paths = GLYPHS[kind]

  return (
    <svg
      className="flex-none"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
