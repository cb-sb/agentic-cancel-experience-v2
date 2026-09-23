import { useExperience } from '../store/useExperience'
import { useJourney } from '../store/useJourney'
import { useOrchestration } from '../store/useOrchestration'
import { stepNeedsWork } from '../lib/stepNeedsWork'
import { PRIMARY_EXPERIENCE_ID } from '../lib/orchestrationSeed'
import { useCopilotThread } from './copilotThread'
import type { SetupItemId } from './setupTracker'
import { beatPrompt, type PlanBeat } from './JourneyPlan'
import { spotlightForBeat } from './spotlight'
import type { Step } from '../types/experience'

/** Open the surface that already owns this setup item. */
export function jumpSetupItem(id: SetupItemId) {
  const orch = useOrchestration.getState()
  const file = useJourney.getState().file
  const experience = useExperience.getState().experiences[PRIMARY_EXPERIENCE_ID]
  orch.setAssistantOpen(true)

  const focus = (predicate: (s: Step) => boolean) => {
    if (!experience) return
    const step = experience.steps.find(predicate) ?? experience.steps[0]
    if (step) orch.focusStep({ experienceId: experience.id, stepId: step.id })
  }

  switch (id) {
    case 'connect': {
      const thread = useCopilotThread.getState()
      const already =
        thread.turn === 'plan' &&
        thread.lines.some((l) => l.from === 'bot' && l.text.includes('connected to Billing'))
      if (!already) {
        thread.setTurn('plan')
        thread.say(
          'bot',
          'Before this can go live, Growth has to be connected to Billing and the cancel snippet has to be on your site — cancelPage() / attachCancelHandler() where your Cancel link lives. This prototype marks it done so you can keep building.',
        )
      }
      orch.setInstallConnected(true)
      return
    }
    case 'audience':
      jumpCopilot('audience')
      return
    case 'experiment':
      jumpCopilot('experiment')
      return
    case 'cancelHandling':
      jumpCopilot('cancel')
      return
    case 'holdout':
      jumpCopilot('holdout')
      return
    case 'offers': {
      focus((s) => s.components.some((c) => c.kind === 'offer'))
      jumpCopilot('offers')
      return
    }
    case 'content':
      focus((s) => s.components.some((c) => c.kind === 'loss_aversion'))
      return
    case 'survey':
      focus((s) => s.components.some((c) => c.kind === 'survey'))
      return
    case 'confirmation':
      focus((s) => s.stage === 'confirmation' || s.stage === 'outcome')
      return
    case 'stepConfig': {
      focus((s) => stepNeedsWork(s, file))
      return
    }
    case 'brand':
      jumpCopilot('brand')
      return
    case 'walk':
      useExperience.getState().setMode('play')
      orch.confirmSetupItem('walk')
      orch.setWalkedOrSkipped(true)
      orch.setSpotlight('walk')
      return
    case 'chain': {
      orch.setAssistantOpen(true)
      const thread = useCopilotThread.getState()
      const hasSteps = thread.lines.some((l) => l.widget === 'steps')
      if (hasSteps) {
        orch.setSpotlight('journey')
      } else {
        orch.markStepStripShown()
        thread.say('bot', 'This is the chain a subscriber walks. Drag if the order is wrong.', {
          widget: 'steps',
        })
      }
      return
    }
    case 'publish': {
      const thread = useCopilotThread.getState()
      const already = thread.turn === 'plan' && thread.beat === 'publish'
      thread.setTurn('plan')
      thread.setBeat('publish')
      if (!already) thread.say('bot', beatPrompt('publish', file))
      return
    }
    case 'reporting': {
      orch.setAssistantOpen(true)
      const thread = useCopilotThread.getState()
      const already =
        thread.turn === 'plan' && thread.lines.some((l) => l.from === 'bot' && l.text.includes('Reports → Cancels'))
      if (!already) {
        thread.setTurn('plan')
        thread.say(
          'bot',
          'After this is live, Reports → Cancels and Offer Performance are where lift shows up. The control slice is what makes that comparison honest.',
        )
      }
      orch.confirmSetupItem('reporting')
      return
    }
  }
}

function jumpCopilot(beat: PlanBeat) {
  const thread = useCopilotThread.getState()
  const file = useJourney.getState().file
  const already = thread.turn === 'plan' && thread.beat === beat
  thread.setTurn('plan')
  thread.setBeat(beat)
  const look = spotlightForBeat(beat)
  if (look) useOrchestration.getState().setSpotlight(look)
  if (!already) thread.say('bot', beatPrompt(beat, file), look ? { look } : undefined)
}
