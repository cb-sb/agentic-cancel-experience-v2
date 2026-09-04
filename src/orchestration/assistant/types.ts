import type { BlueprintId, ComponentKind, ShellLayout, StageId } from '../../types/experience'
export type { BlueprintId }
import type { AudienceCondition, MatchJoin, RuleType, TriggerMoment, TriggerType } from '../../types/orchestration'
import type { Gap, PlayIntent, Pushback } from './intent'
import type { DraftPlan } from './planner'
export type { Gap, PlayIntent, Pushback, DraftPlan }

export type PathwayId = 'guide_me' | 'from_template' | 'power_setup'

export type SetupPhase =
  | 'entry'
  | 'consult'
  | 'recommend'
  | 'blueprint'
  | 'trigger'
  | 'audience'
  | 'split'
  | 'review'
  | 'plan'
  | 'done'

/** Signals gathered during the consultative Q&A that drive the recommendation. */
export interface ConsultingSignals {
  goal?: 'clean_exit' | 'balanced' | 'max_save'
  industry?: 'b2b_saas' | 'consumer' | 'regulated' | 'marketplace'
  compliance?: 'high' | 'standard'
  survey?: 'none' | 'low' | 'high'
  saveAppetite?: 'none' | 'moderate' | 'high' | 'max'
  tone?: 'direct' | 'friendly' | 'formal'
}

/** A declarative side-effect. Resolved against the live stores at apply time so
 *  scripted flows never need to know node ids up front. */
export type ApplyOp =
  | { t: 'blueprint'; id: BlueprintId }
  | { t: 'shell'; shell: ShellLayout }
  | { t: 'trigger'; triggerType?: TriggerType; moment: TriggerMoment; label: string; expression?: string }
  | {
      t: 'audience'
      name: string
      ruleType: RuleType
      expression?: string
      targetAll?: boolean
      savedAudienceId?: string | null
      match?: MatchJoin
      conditions?: AudienceCondition[]
    }
  | { t: 'split'; treatment: number; holdout: number }
  | { t: 'focus'; node: 'trigger' | 'audience' | 'split' | 'flow' | 'holdout' }
  | { t: 'addComponent'; kind: ComponentKind; stage?: StageId }
  | { t: 'abTest'; holdout: number }
  | { t: 'preview' }
  | { t: 'openTemplates' }
  | { t: 'closeTemplates' }
  | { t: 'publish' }
  /** Install a drafted plan: composed steps, audience, trigger and split. */
  | { t: 'plan'; plan: DraftPlan }

export type OptionVariant = 'primary' | 'secondary' | 'ghost'

export interface AssistantOption {
  id: string
  label: string
  hint?: string
  recommended?: boolean
  variant?: OptionVariant
  /** Merge these into the consulting signals when picked. */
  setSignals?: Partial<ConsultingSignals>
  /** Merge these into the play intent when picked (conversational intake). */
  setIntent?: Partial<PlayIntent>
  /** Side-effects to run on the stores. */
  apply?: ApplyOp[]
  /** Where to go next (static). */
  next?: string
  /** Where to go next (computed from context — wins over `next`). */
  resolveNext?: (ctx: FlowContext) => string
  /** false = run apply but stay on the current turn. */
  advance?: boolean
  /** When true, applying is gated behind a confirm dialog if the active
   *  experience has been edited (prevents silently wiping steps). */
  confirmReplace?: boolean
  /** Sets the working recommendation (template chips carry the chosen blueprint). */
  pickBlueprint?: BlueprintId
  /** Nudges the working recommendation up/down a tier and re-renders the turn. */
  adjust?: 'up' | 'down'
}

export interface AssistantTurn {
  id: string
  phase: SetupPhase
  message: string | ((ctx: FlowContext) => string)
  options: AssistantOption[] | ((ctx: FlowContext) => AssistantOption[])
  /** Runs before the turn renders — used to compute the recommendation. */
  onEnter?: (ctx: FlowContext) => Partial<FlowContext>
}

export interface FlowContext {
  pathwayId: PathwayId | null
  phase: SetupPhase
  currentTurnId: string | null
  signals: ConsultingSignals
  recommendedBlueprintId: BlueprintId | null
  /** What the merchant has told the agent so far (conversational pathway). */
  intent: PlayIntent
  /** The gap the current question is about, so the turn can render it. */
  currentGap: Gap | null
  /** The drafted plan awaiting Build / Adjust. */
  plan: DraftPlan | null
  /** Why the agent declined the last ask, when it did. */
  pushback: Pushback | null
}

/** An actionable suggestion attached to an assistant message (the "Apply" chip). */
export interface MessageAction {
  label: string
  ops: ApplyOp[]
  applied?: boolean
}

export interface ChatMessage {
  id: number
  role: 'assistant' | 'user'
  text: string
  /** Element tag shown above the bubble when the message came from a canvas annotation. */
  ref?: { label: string }
  /** Optional confirm-before-change action rendered under an assistant reply. */
  action?: MessageAction
}

/** A pending confirm-before-apply gate. */
export interface PendingConfirm {
  title: string
  lines: string[]
  apply: ApplyOp[]
  next: string | null
}
