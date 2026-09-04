import { useState } from 'react'
import { STabs } from '@chargebee/sting-react'
import { useExperience } from '../store/useExperience'
import { StepEditor } from './StepEditor'
import { BrandingPanel } from './BrandingPanel'

export function ComposerInspector() {
  const [tab, setTab] = useState('step')
  const steps = useExperience((s) => s.experience.steps)
  const activeStepId = useExperience((s) => s.activeStepId)
  const step = steps.find((s) => s.id === activeStepId) ?? steps[0]

  return (
    <div className="flex h-full flex-col border-l border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 pt-3">
        <STabs value={tab} onValueChange={setTab}>
          <STabs.List>
            <STabs.Trigger value="step">Setup</STabs.Trigger>
            <STabs.Trigger value="brand">Brand</STabs.Trigger>
          </STabs.List>
        </STabs>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'step' ? <StepEditor step={step} /> : <BrandingPanel />}
      </div>
    </div>
  )
}
