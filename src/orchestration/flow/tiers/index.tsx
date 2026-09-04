import type { Experience, Step } from '../../../types/experience'
import type { ScreenSize } from '../screen'
import { StepDetail } from './StepDetail'
import { StepOutline } from './StepOutline'
import { StepPill } from './StepPill'

/**
 * Picks a card's fidelity from the room it has on screen.
 *
 * The four tiers are separate components rather than branches inside one, so a
 * tier can only render what it declares — the way a card used to drift was a
 * shared component quietly keeping a piece of chrome it no longer had room for.
 */
export function StepBody({
  step,
  experience,
  size,
  selected,
}: {
  step: Step
  experience: Experience
  size: ScreenSize
  selected: boolean
}) {
  switch (size.tier) {
    case 't0':
      return <StepPill step={step} w={size.w} selected={selected} />
    case 't1':
      return <StepOutline step={step} w={size.w} h={size.h} selected={selected} />
    case 't2':
      return (
        <StepDetail step={step} experience={experience} k={size.k} rich={false} selected={selected} />
      )
    case 't3':
      return (
        <StepDetail step={step} experience={experience} k={size.k} rich selected={selected} />
      )
  }
}
