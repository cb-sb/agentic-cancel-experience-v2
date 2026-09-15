import { useExperience } from '../store/useExperience'
import { useJourney } from '../store/useJourney'
import { useOrchestration } from '../store/useOrchestration'
import { stepNeedsWork } from '../lib/stepNeedsWork'
import { PRIMARY_EXPERIENCE_ID } from '../lib/orchestrationSeed'
import { useCopilotThread } from './copilotThread'
import type { SetupItemId } from './setupTracker'
import { beatPrompt, type PlanBeat } from './JourneyPlan'

/** Open the surface that already owns this setup item. */
export function jumpSetupItem(id: SetupItemId) {
  const orch = useOrchestration.getState()
  const file = useJourney.getState().file
  const experience = useExperience.getState().experiences[PRIMARY_EXPERIENCE_ID]
  orch.setAssistantOpen(true)

  switch (id) {
    case 'audience':
      orch.openConfig('audience')
      jumpCopilot('audience')
      return
    case 'targeting':
      orch.openConfig('targeting')
      return
    case 'holdout':
      jumpCopilot('holdout')
      return
    case 'offers': {
      const offer = experience?.steps.find((s) => s.components.some((c) => c.kind === 'offer'))
      if (offer && experience) orch.focusStep({ experienceId: experience.id, stepId: offer.id })
      jumpCopilot('offers')
      return
    }
    case 'stepConfig': {
      const needy = experience?.steps.find((s) => stepNeedsWork(s, file))
      const step = needy ?? experience?.steps[0]
      if (step && experience) orch.focusStep({ experienceId: experience.id, stepId: step.id })
      return
    }
    case 'brand':
      jumpCopilot('brand')
      return
    case 'walk':
      useExperience.getState().setMode('play')
      orch.confirmSetupItem('walk')
      orch.setWalkedOrSkipped(true)
      return
    case 'chain':
      orch.setAssistantOpen(true)
      return
  }
}

function jumpCopilot(beat: PlanBeat) {
  const thread = useCopilotThread.getState()
  const file = useJourney.getState().file
  const already = thread.turn === 'plan' && thread.beat === beat
  thread.setTurn(beat === 'brand' && !file.brand.matched ? 'match_site' : 'plan')
  if (beat !== 'brand' || file.brand.matched) thread.setBeat(beat)
  if (!already) thread.say('bot', beatPrompt(beat, file))
}
