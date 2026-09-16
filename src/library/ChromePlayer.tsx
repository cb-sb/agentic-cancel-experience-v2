import { ArtifactPlayer } from '../upload/ArtifactPlayer'
import type { JourneyFile } from '../journey/types'
import { packFromChrome } from './extract'

/** Renders saved merchant chrome for one authored step. */
export function ChromeStepPlayer({
  file,
  stepId,
  interactive = false,
  className,
}: {
  file: JourneyFile
  stepId: string
  interactive?: boolean
  className?: string
}) {
  const step = file.steps.find((s) => s.id === stepId)
  if (!step?.chrome) return null
  const pack = packFromChrome(step)
  if (!pack) return null
  return (
    <ArtifactPlayer
      artifact={pack.artifact}
      manifest={pack.manifest}
      stepId={stepId}
      interactive={interactive}
      className={className}
    />
  )
}

export function stepChrome(file: JourneyFile, stepId: string) {
  return file.steps.find((s) => s.id === stepId)?.chrome
}
