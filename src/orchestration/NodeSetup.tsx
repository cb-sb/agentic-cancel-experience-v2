import type { ReactNode } from 'react'
import { SelectField, SwitchField, TextField } from '../composer/fields'
import { experienceBadge } from '../lib/experienceUtils'
import { uid } from '../lib/id'
import { useExperience } from '../store/useExperience'
import { useOrchestration } from '../store/useOrchestration'
import { isExperienceTarget } from './ExperienceEnclosure'
import {
  AUDIENCE_LIBRARY,
  RULE_OPERATOR_LABELS,
  SUBSCRIBER_PROPERTIES,
  TARGET_LABELS,
  TRIGGER_TYPES,
  branchName,
  conditionExpression,
  triggerLabel,
  type AudienceCondition,
  type FlowNode,
  type MatchJoin,
  type RoutingBranch,
  type RuleOperator,
  type SplitMode,
  type SplitNode,
  type TargetType,
  type TriggerMoment,
  type TriggerType,
} from '../types/orchestration'

export const TRIGGER_NODE_ID = 'node_trigger'
export const AUDIENCE_NODE_ID = 'node_audience'

const BRANCH_TARGET_OPTIONS: { value: TargetType; label: string }[] = [
  { value: 'CANCEL_PAGE', label: 'Cancel experience' },
  { value: 'OFFER', label: 'Offer' },
  { value: 'PRICING_PAGE', label: 'Pricing table' },
]

export function NodeSetup({ nodeId }: { nodeId: string }) {
  if (nodeId === TRIGGER_NODE_ID) return <TriggerSetup />
  if (nodeId === AUDIENCE_NODE_ID) return <AudienceSetup />
  return <RoutingSetup nodeId={nodeId} />
}

const TRIGGER_ICONS: Record<TriggerType, ReactNode> = {
  page_load: <TriggerBoltIcon />,
  usage_threshold: <TriggerHashIcon />,
  button_click: <TriggerCursorIcon />,
  subscription_renewal: <TriggerRefreshIcon />,
  custom_event: <TriggerCodeIcon />,
}

/**
 * Trigger configurator — mirrors the product's step: pick a trigger type (only
 * Page load is available today; the rest preview as "coming soon"), then choose
 * the trigger moment (any page vs a specific page URL).
 */
export function TriggerSetup() {
  const trigger = useOrchestration((s) => s.play.trigger)
  const updateTrigger = useOrchestration((s) => s.updateTrigger)

  const setMoment = (moment: TriggerMoment) =>
    updateTrigger({ moment, label: triggerLabel({ moment, expression: trigger.expression }) })

  return (
    <div className="space-y-3">
      <SetupHeader kicker="Trigger" title="Select trigger" />
      <p className="text-[12px] leading-relaxed text-slate-500">
        Define when this play should be triggered for your audience.
      </p>

      {trigger.type === 'page_load' && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Choose a trigger moment
          </div>
          <div className="space-y-1.5">
            <RadioRow
              label="Any page load"
              checked={trigger.moment === 'any_page'}
              onSelect={() => setMoment('any_page')}
            />
            <RadioRow
              label="Custom page load"
              checked={trigger.moment === 'custom_page'}
              onSelect={() => setMoment('custom_page')}
            />
          </div>
          {trigger.moment === 'custom_page' && (
            <div className="mt-2">
              <TextField
                label="Page URL"
                value={trigger.expression ?? ''}
                placeholder="/account/cancel"
                onChange={(expression) => updateTrigger({ expression })}
                hint="Mock — the live product evaluates a BrightbackExpression."
              />
            </div>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        {TRIGGER_TYPES.filter((t) => t.available).map((t) => {
          const selected = trigger.type === t.type
          return (
            <button
              key={t.type}
              type="button"
              onClick={() => updateTrigger({ type: t.type })}
              className={`flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors ${
                selected
                  ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-md ${
                  selected ? 'bg-indigo-600 text-white' : 'bg-slate-200/70 text-slate-500'
                }`}
              >
                {TRIGGER_ICONS[t.type]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-[12.5px] font-semibold text-slate-800">{t.label}</span>
                  {selected && (
                    <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                      Selected
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                  {t.description}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function RadioRow({
  label,
  checked,
  onSelect,
}: {
  label: string
  checked: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-white"
    >
      <span
        className={`flex h-4 w-4 flex-none items-center justify-center rounded-full border ${
          checked ? 'border-indigo-600' : 'border-slate-300'
        }`}
      >
        {checked && <span className="h-2 w-2 rounded-full bg-indigo-600" />}
      </span>
      <span className={`text-[12.5px] ${checked ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
        {label}
      </span>
    </button>
  )
}

function TriggerBoltIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />
    </svg>
  )
}
function TriggerHashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
    </svg>
  )
}
function TriggerCursorIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m4 4 7 16 2-6 6-2z" />
    </svg>
  )
}
function TriggerRefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
    </svg>
  )
}
function TriggerCodeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m8 6-6 6 6 6M16 6l6 6-6 6" />
    </svg>
  )
}

const PROPERTY_OPTIONS = SUBSCRIBER_PROPERTIES.map((p) => ({ value: p, label: p }))
const OPERATOR_OPTIONS = (Object.keys(RULE_OPERATOR_LABELS) as RuleOperator[]).map((v) => ({
  value: v,
  label: RULE_OPERATOR_LABELS[v],
}))

function newCondition(): AudienceCondition {
  return { id: uid('cond'), property: SUBSCRIBER_PROPERTIES[0], operator: 'is', value: '' }
}

/**
 * The rule builder: one rule per line, sub-rules indented under the rule they
 * qualify.
 *
 * A rule used to be a small card of stacked fields, which made two claims that
 * were not true — that a rule is a heavyweight object, and that reading down a
 * list of them tells you the audience. A rule is one sentence, so it gets one
 * line, and the lines stack into something readable top to bottom.
 *
 * The joins are the hierarchy. The first rule of a level says WHEN; the second
 * carries the AND/OR that binds the whole level, so there is exactly one place
 * to change it; the rest repeat it as plain text. Sub-rules sit behind a rail,
 * with their own join, and bracket with their parent.
 */
function RuleBuilder({
  conditions,
  match,
  onChange,
}: {
  conditions: AudienceCondition[]
  match: MatchJoin
  onChange: (next: AudienceCondition[], match?: MatchJoin) => void
}) {
  const patch = (id: string, next: Partial<AudienceCondition>) =>
    onChange(conditions.map((c) => (c.id === id ? { ...c, ...next } : c)))

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      {conditions.length === 0 ? (
        <p className="px-0.5 py-1 text-[12px] text-slate-400">
          No rules yet — everyone in the play is eligible.
        </p>
      ) : (
        <div className="space-y-1.5">
          {conditions.map((c, i) => (
            <RuleGroup
              key={c.id}
              condition={c}
              index={i}
              match={match}
              onMatch={(m) => onChange(conditions, m)}
              onChange={(next) => patch(c.id, next)}
              onRemove={() => onChange(conditions.filter((x) => x.id !== c.id))}
            />
          ))}
        </div>
      )}

      <AddRuleButton
        className="mt-2"
        onClick={() => onChange([...conditions, newCondition()])}
        label="Add condition"
      />
    </div>
  )
}

/** One top-level rule, plus the sub-rules bracketed with it. */
function RuleGroup({
  condition,
  index,
  match,
  onMatch,
  onChange,
  onRemove,
}: {
  condition: AudienceCondition
  index: number
  match: MatchJoin
  onMatch: (m: MatchJoin) => void
  onChange: (next: Partial<AudienceCondition>) => void
  onRemove: () => void
}) {
  const children = condition.children ?? []
  const join = condition.join ?? 'AND'

  const setChildren = (next: AudienceCondition[]) =>
    onChange({ children: next.length ? next : undefined })

  return (
    // No card around the group: the rail and the joins already say what belongs
    // to what, and boxing each rule as well turns a four-line list into four
    // objects to parse before reading any of them.
    <div className="group/rule">
      <RuleRow
        lead={<JoinLead index={index} join={match} onChange={onMatch} />}
        condition={condition}
        onChange={onChange}
        onRemove={onRemove}
        // Before a rule has sub-rules, the way to add one is a glyph on the row
        // itself. A full-width button under every rule would double the height
        // of the list to advertise something most rules never use, and reserving
        // the space silently is worse — the gaps stop meaning anything.
        onAddSub={children.length ? undefined : () => setChildren([newCondition()])}
      />

      {/* The rail is what says "these belong to the rule above". It runs past
          the add button so the next sub-rule visibly lands inside the group. */}
      {children.length > 0 && (
        <div className="ml-[26px] mt-1.5 border-l-2 border-slate-200 pl-2.5">
          {children.map((k, j) => (
            <div key={k.id} className={j ? 'mt-1.5' : undefined}>
              <RuleRow
                lead={<JoinLead index={j + 1} join={join} onChange={(m) => onChange({ join: m })} />}
                condition={k}
                onChange={(next) =>
                  setChildren(children.map((x) => (x.id === k.id ? { ...x, ...next } : x)))
                }
                onRemove={() => setChildren(children.filter((x) => x.id !== k.id))}
              />
            </div>
          ))}
          <AddRuleButton
            className="mt-1.5"
            onClick={() => setChildren([...children, newCondition()])}
            label="Add sub-condition"
          />
        </div>
      )}
    </div>
  )
}

/** property · operator · value, on one line, with its join and its bin. */
function RuleRow({
  lead,
  condition,
  onChange,
  onRemove,
  onAddSub,
}: {
  lead: ReactNode
  condition: AudienceCondition
  onChange: (next: Partial<AudienceCondition>) => void
  onRemove: () => void
  onAddSub?: () => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      {lead}
      {/* min-w-0 on each: a select's trigger will happily push the row wider
          than the drawer rather than truncate its own label. */}
      <div className="min-w-0 flex-[1.25]">
        <SelectField
          value={condition.property}
          options={PROPERTY_OPTIONS}
          onChange={(property) => onChange({ property })}
        />
      </div>
      <div className="min-w-0 flex-1">
        <SelectField<RuleOperator>
          value={condition.operator}
          options={OPERATOR_OPTIONS}
          onChange={(operator) => onChange({ operator })}
        />
      </div>
      <div className="min-w-0 flex-1">
        <TextField
          value={condition.value}
          placeholder="Value…"
          onChange={(value) => onChange({ value })}
        />
      </div>
      {/* Reserved even when unused, so the fields of every row line up whether
          or not that row can take a sub-rule. */}
      {!onAddSub ? (
        <span className="h-7 w-7 flex-none" aria-hidden />
      ) : (
        <button
          type="button"
          onClick={onAddSub}
          title="Add sub-condition"
          aria-label="Add sub-condition"
          className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-slate-300 opacity-0 transition-all hover:bg-indigo-50 hover:text-indigo-600 focus:opacity-100 group-hover/rule:opacity-100 group-focus-within/rule:opacity-100"
        >
          <BranchIcon />
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        title="Remove rule"
        className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
      >
        <TrashIcon />
      </button>
    </div>
  )
}

/** A line branching down and away — the shape the rail makes when it is used. */
function BranchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4v9a4 4 0 0 0 4 4h6M14 13l3 4-3 4" />
    </svg>
  )
}

/**
 * The word at the start of a rule. The first is WHEN and fixed; the second is
 * the one control for the level's join; the rest state it without repeating
 * the affordance, because three buttons that all change the same value read as
 * three separate settings.
 */
function JoinLead({
  index,
  join,
  onChange,
}: {
  index: number
  join: MatchJoin
  onChange: (m: MatchJoin) => void
}) {
  const base = 'w-[46px] flex-none text-center text-[10px] font-bold uppercase tracking-wider'

  if (index === 0) return <span className={`${base} text-slate-400`}>When</span>
  if (index > 1) return <span className={`${base} text-slate-400`}>{join}</span>

  return (
    <button
      type="button"
      onClick={() => onChange(join === 'AND' ? 'OR' : 'AND')}
      title={`Match ${join === 'AND' ? 'all' : 'any'} of these rules — click to switch`}
      className={`${base} rounded-md py-1 text-slate-600 ring-1 ring-inset ring-slate-200 transition-colors hover:bg-slate-100 hover:text-slate-900`}
    >
      {join}
    </button>
  )
}

function AddRuleButton({
  onClick,
  label,
  className = '',
}: {
  onClick: () => void
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-semibold text-indigo-600 transition-colors hover:bg-indigo-50 ${className}`}
    >
      <PlusIcon />
      {label}
    </button>
  )
}

/**
 * Audience configurator — mirrors the product's step: target everyone, pick an
 * existing saved audience, or author a new one with a property/operator/value
 * rule builder. This is where an agent-proposed audience can be reviewed and
 * overridden on the canvas.
 */
export function AudienceSetup() {
  const audience = useOrchestration((s) => s.play.audience)
  const updateAudience = useOrchestration((s) => s.updateAudience)

  const targetAll = !!audience.targetAll
  const savedId = audience.savedAudienceId ?? ''
  const match: MatchJoin = audience.match ?? 'AND'
  const conditions = audience.conditions ?? []

  const setConditions = (next: AudienceCondition[], nextMatch: MatchJoin = match) => {
    updateAudience({
      conditions: next,
      match: nextMatch,
      // Any hand edit turns a saved audience into a custom one.
      savedAudienceId: null,
      expression: conditionExpression(next, nextMatch),
    })
  }

  const chooseSaved = (id: string) => {
    if (id === '') {
      // "Create new audience" — start from a single blank rule.
      const seed = [newCondition()]
      updateAudience({
        name: 'New audience',
        savedAudienceId: null,
        match: 'AND',
        conditions: seed,
        expression: '',
      })
      return
    }
    const lib = AUDIENCE_LIBRARY.find((a) => a.id === id)
    if (!lib) return
    const cloned = lib.conditions.map((c) => ({ ...c, id: uid('cond') }))
    updateAudience({
      name: lib.name,
      ruleType: 'TARGETING',
      savedAudienceId: lib.id,
      match: lib.match,
      conditions: cloned,
      expression: conditionExpression(cloned, lib.match),
    })
  }

  return (
    <div className="space-y-3">
      <SetupHeader kicker="Audience" title="Who is eligible?" />
      <p className="text-[12px] leading-relaxed text-slate-500">
        Select an existing audience or create a new one to target with this play.
      </p>

      <SwitchField
        label="Target all subscribers"
        description="Everyone who reaches the cancel button is eligible."
        checked={targetAll}
        onChange={(v) =>
          updateAudience(
            v
              ? { targetAll: true, name: 'All subscribers', ruleType: 'ALL_AUDIENCE' }
              : { targetAll: false, ruleType: 'TARGETING' },
          )
        }
      />

      {!targetAll && (
        <>
          <SelectField
            label="Audience"
            value={savedId}
            options={[
              { value: '', label: savedId ? 'Custom rules' : 'Create new audience…' },
              ...AUDIENCE_LIBRARY.map((a) => ({ value: a.id, label: a.name })),
            ]}
            onChange={chooseSaved}
          />

          {!savedId && (
            <TextField
              label="Audience name"
              value={audience.name}
              onChange={(name) => updateAudience({ name })}
            />
          )}

          <div>
            <div className="mb-1.5 text-[12px] font-semibold text-slate-600">
              Conditions
              <span className="ml-1.5 font-normal text-slate-400">
                Who this play applies to. Sub-conditions qualify the rule above them.
              </span>
            </div>
            <RuleBuilder
              conditions={conditions}
              match={match}
              onChange={(next, m) => setConditions(next, m ?? match)}
            />
          </div>

          {conditions.length > 0 && (
            <div className="rounded-md bg-slate-900/90 px-2.5 py-1.5 font-mono text-[10.5px] leading-relaxed text-slate-100">
              {conditionExpression(conditions, match)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  )
}

const SPLIT_MODES: { value: SplitMode; label: string }[] = [
  { value: 'single', label: 'Cancel page' },
  { value: 'percent', label: 'A/B test' },
  { value: 'audience', label: 'Sub-audiences' },
]

function ModeSeg({ mode, onChange }: { mode: SplitMode; onChange: (m: SplitMode) => void }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-slate-100 p-0.5">
      {SPLIT_MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          onClick={() => onChange(m.value)}
          className={`flex-1 rounded-md px-2 py-1.5 text-[11.5px] font-semibold transition-colors ${
            mode === m.value
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}

/** Targeting & experimentation: single experience, A/B percent test, or sub-audiences. */
export function SplitSetup({ split }: { split: SplitNode }) {
  const setSplitMode = useOrchestration((s) => s.setSplitMode)
  const setSplitPercents = useOrchestration((s) => s.setSplitPercents)
  const evenSplit = useOrchestration((s) => s.evenSplit)
  const addVariant = useOrchestration((s) => s.addVariant)
  const addSubAudience = useOrchestration((s) => s.addSubAudience)
  const removeBranch = useOrchestration((s) => s.removeBranch)
  const toggleHoldout = useOrchestration((s) => s.toggleHoldout)

  const mode = split.mode
  const hasHoldout = split.branches.some((b) => b.node.kind === 'holdout')
  const total = split.branches.reduce((sum, b) => sum + b.percent, 0)
  const flowBranches = split.branches.filter((b) => b.node.kind === 'flow')

  // Set one branch to `value` and rebalance the rest proportionally so the
  // percents keep summing to 100.
  const setPercent = (id: string, value: number) => {
    const others = split.branches.filter((b) => b.id !== id)
    const rest = Math.max(0, 100 - value)
    const sumOthers = others.reduce((s, b) => s + b.percent, 0)
    const percents: Record<string, number> = { [id]: value }
    let acc = 0
    others.forEach((b, i) => {
      const isLast = i === others.length - 1
      const share = isLast
        ? rest - acc
        : sumOthers > 0
        ? Math.round(rest * (b.percent / sumOthers))
        : Math.round(rest / others.length)
      percents[b.id] = Math.max(0, share)
      acc += percents[b.id]
    })
    setSplitPercents(split.id, percents)
  }

  return (
    <div className="space-y-3">
      <SetupHeader kicker="Targeting & experimentation" title="Route the cancel page" />
      <ModeSeg mode={mode} onChange={(m) => setSplitMode(split.id, m)} />

      {mode === 'single' && (
        <div className="space-y-2.5">
          <p className="text-[12px] leading-relaxed text-slate-500">
            One cancel experience is shown to everyone in the audience. Turn on an experiment to
            compare variants, or split by sub-audience to route segments to different experiences.
          </p>
          <div className="flex flex-col gap-2">
            <ActionButton onClick={() => addVariant(split.id)} tone="indigo">
              Start an A/B test
            </ActionButton>
            <ActionButton onClick={() => addSubAudience(split.id)}>
              Split by sub-audience
            </ActionButton>
          </div>
        </div>
      )}

      {mode === 'percent' && (
        <div className="space-y-3">
          <p className="text-[12px] leading-relaxed text-slate-500">
            One control plus any number of variants. Traffic is divided by the percentages below.
          </p>
          <div className="space-y-2.5">
            {split.branches.map((b) => {
              const isHoldout = b.node.kind === 'holdout'
              const removable = !isHoldout && b.role !== 'control' && flowBranches.length > 1
              return (
                <div key={b.id}>
                  <div className="mb-1 flex items-center justify-between text-[12px] font-semibold text-slate-600">
                    <span className="truncate">
                      {isHoldout ? 'Control (holdout)' : branchName(b)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="tabular-nums text-slate-500">{Math.round(b.percent)}%</span>
                      {removable && (
                        <button
                          type="button"
                          onClick={() => removeBranch(split.id, b.id)}
                          title="Remove variant"
                          className="flex h-5 w-5 items-center justify-center rounded text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                        >
                          <TrashIcon />
                        </button>
                      )}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={b.percent}
                    onChange={(e) => setPercent(b.id, Number(e.target.value))}
                    className="w-full accent-slate-900"
                  />
                </div>
              )
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={() => addVariant(split.id)} tone="indigo">
              <PlusIcon />
              Add variant
            </ActionButton>
            <ActionButton onClick={() => evenSplit(split.id)}>Even split</ActionButton>
            <ActionButton onClick={() => toggleHoldout(split.id)}>
              {hasHoldout ? 'Remove holdout' : 'Add holdout'}
            </ActionButton>
          </div>
          <div
            className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium ${
              total === 100 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}
          >
            {total === 100 ? 'Branches sum to 100%.' : `Branches sum to ${total}% — must be 100%.`}
          </div>
        </div>
      )}

      {mode === 'audience' && (
        <div className="space-y-3">
          <p className="text-[12px] leading-relaxed text-slate-500">
            Route rule-based segments to their own cancel experience. Subscribers who match no segment
            fall through to the fallback experience.
          </p>
          {split.branches
            .filter((b) => b.role === 'segment')
            .map((b, i) => (
              <SegmentEditor
                key={b.id}
                splitId={split.id}
                branch={b}
                index={i}
                canRemove={split.branches.filter((x) => x.role === 'segment').length > 1}
                onRemove={() => removeBranch(split.id, b.id)}
              />
            ))}
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-2.5 py-2 text-[12px] text-slate-500">
            <span className="flex h-5 w-5 flex-none items-center justify-center rounded bg-slate-200 text-slate-500">
              <ShieldIcon />
            </span>
            <span>
              <span className="font-semibold text-slate-600">Fallback</span> — shown to subscribers who
              match none of the segments above.
            </span>
          </div>
          <ActionButton onClick={() => addSubAudience(split.id)} tone="indigo">
            <PlusIcon />
            Add sub-audience
          </ActionButton>
        </div>
      )}
    </div>
  )
}

/** Rule editor for a single sub-audience segment branch. */
function SegmentEditor({
  splitId,
  branch,
  index,
  canRemove,
  onRemove,
}: {
  splitId: string
  branch: RoutingBranch
  index: number
  canRemove: boolean
  onRemove: () => void
}) {
  const updateBranchAudience = useOrchestration((s) => s.updateBranchAudience)
  const renameNode = useOrchestration((s) => s.renameNode)

  const audience = branch.audience
  const match: MatchJoin = audience?.match ?? 'AND'
  const conditions = audience?.conditions ?? []

  const setConditions = (next: AudienceCondition[], nextMatch: MatchJoin = match) => {
    updateBranchAudience(splitId, branch.id, {
      conditions: next,
      match: nextMatch,
      savedAudienceId: null,
      expression: conditionExpression(next, nextMatch),
    })
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 flex-none items-center justify-center rounded bg-indigo-100 text-[10px] font-bold text-indigo-600">
            {index + 1}
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Sub-audience
          </span>
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            title="Remove sub-audience"
            className="flex h-5 w-5 items-center justify-center rounded text-slate-300 hover:bg-rose-50 hover:text-rose-500"
          >
            <TrashIcon />
          </button>
        )}
      </div>

      <TextField
        value={branch.node.name}
        placeholder="Segment name"
        onChange={(name) => renameNode(branch.node.id, name)}
      />

      <div className="mt-2">
        <RuleBuilder
          conditions={conditions}
          match={match}
          onChange={(next, m) => setConditions(next, m ?? match)}
        />
      </div>
    </div>
  )
}

function ActionButton({
  onClick,
  tone,
  children,
}: {
  onClick: () => void
  tone?: 'indigo'
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-semibold transition-colors ${
        tone === 'indigo'
          ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}

function ShieldIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </svg>
  )
}

function RoutingSetup({ nodeId }: { nodeId: string }) {
  const play = useOrchestration((s) => s.play)

  const root = play.targeting
  const split = root.kind === 'split' ? (root as SplitNode) : null

  if (split && split.id === nodeId) return <SplitSetup split={split} />

  const branch = split?.branches.find((b) => b.node.id === nodeId)
  const node = branch?.node
  if (!node) return null

  if (node.kind === 'holdout') {
    return (
      <div className="space-y-3">
        <SetupHeader kicker="Holdout" title="Control group" />
        <p className="text-[13px] leading-relaxed text-slate-500">
          Subscribers in this branch see no treatment. Their outcomes form the baseline the treatment
          is measured against in the lift report.
        </p>
        <div className="rounded-md bg-slate-50 px-3 py-2 text-[12px] text-slate-500">
          Branch name <span className="font-mono text-slate-700">control</span> · target{' '}
          <span className="font-mono text-slate-700">NONE</span>
        </div>
      </div>
    )
  }

  if (node.kind !== 'flow') return null
  return <FlowSetup flow={node} splitId={split?.id} />
}

function FlowSetup({ flow, splitId }: { flow: FlowNode; splitId?: string }) {
  const renameNode = useOrchestration((s) => s.renameNode)
  const setFlowTarget = useOrchestration((s) => s.setFlowTarget)
  const setFlowExperience = useOrchestration((s) => s.setFlowExperience)
  const addTreatmentBranch = useOrchestration((s) => s.addTreatmentBranch)
  const experiences = useExperience((s) => s.experiences)
  const activeExperienceId = useExperience((s) => s.activeExperienceId)
  const setActiveExperience = useExperience((s) => s.setActiveExperience)
  const renameExperience = useExperience((s) => s.renameExperience)
  const duplicateExperience = useExperience((s) => s.duplicateExperience)

  const exp = experiences[flow.experienceId]
  const expList = Object.values(experiences)
  const showExperienceControls = isExperienceTarget(flow.target)

  const onDuplicateForAb = () => {
    if (!splitId || !exp) return
    const newId = duplicateExperience(flow.experienceId)
    addTreatmentBranch(splitId, newId)
  }

  return (
    <div className="space-y-3">
      <SetupHeader kicker="Treatment branch" title="Branch target" />
      <TextField label="Flow name" value={flow.name} onChange={(name) => renameNode(flow.id, name)} />
      <SelectField<TargetType>
        label="Target type"
        value={flow.target}
        options={BRANCH_TARGET_OPTIONS}
        onChange={(target) => setFlowTarget(flow.id, target)}
      />
      <p className="text-[12px] leading-relaxed text-slate-500">
        Current target: <span className="font-medium text-slate-700">{TARGET_LABELS[flow.target]}</span>
      </p>

      {showExperienceControls && exp && (
        <>
          <div className="border-t border-slate-100 pt-3">
            <SetupHeader kicker="Experience" title={exp.name} />
          </div>
          <TextField
            label="Experience name"
            value={exp.name}
            onChange={(name) => renameExperience(exp.id, name)}
          />
          <div className="rounded-md bg-slate-50 px-2.5 py-2 font-mono text-[11px] text-slate-600">
            id: {experienceBadge(exp.id)}
          </div>
          <SelectField
            label="Reuse experience"
            value={flow.experienceId}
            options={expList.map((e) => ({
              value: e.id,
              label: `${e.name} (${experienceBadge(e.id)})`,
            }))}
            onChange={(experienceId) => {
              setFlowExperience(flow.id, experienceId)
              setActiveExperience(experienceId)
            }}
          />
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                const newId = duplicateExperience(flow.experienceId)
                setFlowExperience(flow.id, newId)
                setActiveExperience(newId)
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Duplicate experience
            </button>
            {splitId && (
              <button
                type="button"
                onClick={onDuplicateForAb}
                className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[12px] font-semibold text-indigo-700 hover:bg-indigo-100"
              >
                Duplicate &amp; wire to A/B branch
              </button>
            )}
          </div>
          {activeExperienceId === exp.id ? (
            <p className="text-[11px] text-emerald-600">This experience is active for inline editing.</p>
          ) : (
            <p className="text-[11px] text-slate-400">Select this branch to edit its experience inline.</p>
          )}
        </>
      )}

      {!showExperienceControls && (
        <p className="text-[13px] leading-relaxed text-slate-500">
          This branch shows a compact {flow.target === 'OFFER' ? 'save offer' : 'pricing table'} preview
          on the canvas instead of a full cancel experience.
        </p>
      )}
    </div>
  )
}

function SetupHeader({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{kicker}</div>
      <div className="text-[15px] font-bold text-slate-900">{title}</div>
    </div>
  )
}
