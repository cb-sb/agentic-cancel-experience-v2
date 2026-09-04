# Cancel Experience — Modal + Full-Page Prototype Spec

A complete functional and technical specification of the cancel-experience prototype
(`cancel-experience-prototype-V1`, branch `full-page-experience`), written so the
experience can be rebuilt from scratch — including on the Brightback server.

This document is implementation-oriented but framework-agnostic. Where it matters, the
reference implementation (React + TypeScript + Vite + Tailwind v4 + Zustand) is noted, but
the domain model, rules, layouts, and interaction flows are what must be reproduced.

---

## 1. What this is

A cancel-experience builder + player with two halves:

- **Composer** (merchant-facing): a 3-pane builder to assemble a cancel flow from a
  **blueprint**, edit every piece of copy **inline**, theme it to the merchant brand, and
  preview it on desktop / tablet / mobile.
- **Runtime / Player** (subscriber-facing): plays the assembled flow as the end subscriber
  would see it, in one of three **shells** (modal dialog, full page, full-page vertical
  slide deck), with real navigation, gating, offer acceptance, a dummy checkout, and an
  outcome screen.

Both halves render the **exact same component tree** — the only differences are driven by a
render context (`mode: compose | play`). This "single renderer, two modes" design is the
most important architectural idea and must be preserved: it guarantees the merchant edits
exactly what the subscriber sees.

### Guiding domain rules (FTC "click-to-cancel" + save-flow guidelines)

- An experience is an **ordered list of at most 6 steps** (FTC cap).
- Every experience **must end** with a confirmation step; confirmation is **always last**
  and **always standalone**.
- Each step is `[Step frame] + [Stage content]`, where stage content is **one or two**
  complementary components.

---

## 2. Reference stack

| Concern | Choice |
|---|---|
| UI | React 18 + TypeScript |
| Build | Vite 6 |
| Styling | Tailwind CSS v4 (`@import "tailwindcss"`) + CSS custom properties |
| State | Zustand (single store) |
| Merchant UI kit | `@chargebee/sting-react` (used only in composer chrome: `SButton`, `STabs`) |
| Class merge | `tailwind-merge` |

No backend — everything is in-memory in the store. On Brightback, the `Experience` object
below is the persisted config; the renderer is a stateless function of `(Experience,
Session, mode, device)`.

---

## 3. Domain model (authoritative types)

Reproduce these types exactly. This is the serialized shape of a saved experience.

```ts
// ---- Blueprints & stages ----
type BlueprintId =
  | 'click_to_cancel'  // 1 step  — confirmation only
  | 'clean_exit_1'     // 2 steps — value reinforcement -> confirmation
  | 'clean_exit_2'     // 3 steps — value reinforcement -> survey -> confirmation
  | 'balanced'         // 4 steps — LA -> survey -> offer -> confirmation
  | 'save_aggressive'  // 5 steps — LA -> entry offer -> survey -> offer -> confirmation
  | 'custom_6'         // 6 steps — extended (FTC max)

type StageId =
  | 'value_reinforcement' | 'entry_offer' | 'route_detection'
  | 'save_mechanic' | 'confirmation'

interface BlueprintMeta {
  id: BlueprintId
  name: string
  stepCount: number
  posture: 'clean_exit' | 'balanced' | 'save_aggressive'
  description: string
}

// ---- Components ----
type ComponentKind = 'loss_aversion' | 'survey' | 'offer' | 'pricing_table' | 'confirmation'

interface MediaAsset { type: 'image' | 'video'; url?: string }

// Loss Aversion
type LACardType = 'account_activity' | 'feature_list' | 'message'
interface LAListItem { id: string; label: string; detail?: string }
interface LAStat { id: string; value: string; label: string }
interface LossAversionComponent {
  id: string
  kind: 'loss_aversion'
  cardType: LACardType
  media?: MediaAsset | null      // media presence forces standalone-with-LA rules
  keepTitle?: string; keepItems?: LAListItem[]   // feature_list
  loseTitle?: string; loseItems?: LAListItem[]   // feature_list
  statsTitle?: string; stats?: LAStat[]          // account_activity
  message?: string                                // message
}

// Survey (route detection)
type SurveyPresentation = 'radio' | 'dropdown' | 'free_text'
interface SurveyFollowUp { enabled: boolean; prompt: string; placeholder?: string; optional: boolean }
interface SurveyReasonOption {
  id: string; label: string
  code: string                 // canonical ReasonForLeaving code for analytics
  isOther?: boolean
  followUp?: SurveyFollowUp | null
  linkedOfferId?: string | null
}
interface SurveyComponent {
  id: string; kind: 'survey'
  presentation: SurveyPresentation
  randomize: boolean
  options: SurveyReasonOption[]
  freeTextPrompt?: string
}

// Offer
type OfferCategory =
  | 'discount' | 'plan_change' | 'addon' | 'one_time_charge' | 'skip'
  | 'extension' | 'pause' | 'support_train' | 'product_feedback' | 'multi_action'
type FulfillmentType = 'billing' | 'checkout' | 'url' | 'webhook' | 'email'
interface OfferComponent {
  id: string; kind: 'offer'
  category: OfferCategory
  eyebrow?: string; title: string; description: string
  media?: MediaAsset | null
  primaryCta: string; secondaryCta?: string; downgradeLink?: string
  socialProof?: string
  fulfillment: FulfillmentType
  reasonLinked: boolean         // if true, must appear AFTER the survey step
  billingEntity?: { couponId?: string; planId?: string; addonId?: string }
}

// Pricing table
interface PricingPlan {
  id: string; name: string; price: string; cadence: string
  features: string[]; highlighted?: boolean; ctaLabel: string
}
interface PricingTableComponent {
  id: string; kind: 'pricing_table'
  plans: PricingPlan[]
  fulfillment: 'checkout' | 'url'
}

// Confirmation -> Outcome
type ConfirmationVariant = 'simple' | 'consent' | 'type_confirm'
type OutcomeVariant = 'success' | 'reactivation' | 'feedback'
interface ImpactItem { id: string; label: string; detail?: string; severity: 'amber' | 'red' }
interface OutcomeConfig {
  variant: OutcomeVariant
  headline: string; body?: string
  undoEnabled: boolean; undoCta?: string     // 30-day undo
  feedbackEnabled: boolean; feedbackPrompt?: string
}
interface ConfirmationComponent {
  id: string; kind: 'confirmation'
  variant: ConfirmationVariant
  title: string; subtitle: string
  consentText?: string          // 'consent' variant
  confirmKeyword?: string        // 'type_confirm' variant (e.g. "CANCEL")
  impact: ImpactItem[]           // shown only on 'simple' variant
  endDateLabel?: string
  keepCta: string; cancelCta: string
  outcome: OutcomeConfig
}

type ExperienceComponent =
  | LossAversionComponent | SurveyComponent | OfferComponent
  | PricingTableComponent | ConfirmationComponent

// ---- Steps & experience ----
type StepLayout = 'single' | 'two_column'
interface Step {
  id: string
  stage: StageId
  title: string
  description: string
  layout: StepLayout
  components: ExperienceComponent[]
  navContinueLabel?: string      // overrides the computed primary-CTA label
  splitRatio?: number            // two-column: left column's share of width (0.3..0.7)
}

// ---- Branding / theming ----
type TonePreset = 'Formal' | 'Friendly-professional' | 'Playful' | 'Direct'
type FillType = 'solid' | 'gradient'
type TextAlign = 'left' | 'center' | 'right'
interface Branding {
  merchantName: string; logoUrl?: string
  siteColor: string              // page background behind the modal
  cardColor: string              // card fill (solid)
  cardFillType: FillType; cardGradientFrom: string; cardGradientTo: string; cardGradientAngle: number
  cardBorderColor: string; cardBorderType: FillType
  cardBorderGradientFrom: string; cardBorderGradientTo: string; cardBorderGradientAngle: number
  cardBorderWidth: number
  primaryColor: string; secondaryColor: string; accentColor: string
  titleColor: string; textColor: string; mutedColor: string
  fontFamily: string
  fontSizeBase: number; fontLineHeight: number; fontWeight: number
  letterSpacing: number          // % of font size
  textAlign: TextAlign
  cornerRadius: number
  tone: TonePreset
}

interface FrameVisibility {      // nav bar is always on; these toggle the rest
  logo: boolean; exitX: boolean; progress: boolean; title: boolean; description: boolean
}

type ShellLayout = 'modal' | 'fullpage' | 'fullpage_scroll'

interface Experience {
  blueprint: BlueprintId
  shell: ShellLayout
  branding: Branding
  frame: FrameVisibility
  steps: Step[]
}
```

### Constants

```ts
MAX_STEPS = 6
COMPONENT_CAPS = { loss_aversion: 2, offer: 2, survey: 1 }   // per experience
SURVEY_MIN_OPTIONS = 3
SURVEY_MAX_OPTIONS = 5
LA_MAX_ITEMS = 3                 // per keep/lose section
REASON_CODES = ['price','not_using','missing_features','switching_competitor',
                'technical_issues','too_complex','other']
```

---

## 4. Guardrails (composition rules)

Two layers: **hard rules** enforced at add-time (`canAddToStep` / `hasCapRoom`), and a
**validation sweep** (`validateExperience`) that returns `error`/`warning` issues for a
status panel.

### Per-step add rules (`canAddToStep(step, kind)`)

- Confirmation is standalone: nothing can be added to a confirmation step, and confirmation
  cannot be added to a step that already has components.
- A **loss-aversion card with media** may only sit beside **another loss-aversion card** —
  never survey / offer / pricing table.
- **Pricing table and offer cannot share a step** (either order).
- **Survey may only be paired with a loss-aversion card**; a survey step accepts only an
  extra loss-aversion card.
- **At most 2 components per step.**

### Experience-wide caps (`hasCapRoom`)

- `loss_aversion ≤ 2`, `offer ≤ 2`, `survey ≤ 1` across all steps.

### Loss-aversion variant rule

- A single step **cannot repeat the same LA variant** (see §7.1). When adding a second LA
  card, seed it with the first still-available complementary variant.

### Validation sweep (`validateExperience`) → issues

- **error**: > 6 steps; any cap exceeded; no confirmation step; confirmation not last;
  reason-linked offer on/before the survey step; survey option count outside 3–5;
  media-LA paired with a non-LA component; two LA cards of the same variant; feature list
  with > 3 items in a section.
- **warning**: `"Other"` not last when `randomize` is on; follow-up free text enabled on
  > 2 reasons; on Balanced/Save-Aggressive postures, outcome is not `reactivation`
  (one-click undo recommended).

---

## 5. Blueprints & default seed content

Selecting a blueprint reseeds the steps (preserving the currently chosen shell). Defaults
below are the seed copy; everything is inline-editable afterward.

### Blueprint catalog

| id | name | steps | posture | sequence |
|---|---|---|---|---|
| `click_to_cancel` | One-Step Flow | 1 | clean_exit | confirmation |
| `clean_exit_1` | Two-Step Flow | 2 | clean_exit | value → confirmation |
| `clean_exit_2` | Three-Step Flow | 3 | clean_exit | value → survey → confirmation |
| `balanced` | Four-Step Flow | 4 | balanced | value → survey → offer(reasonLinked) → confirmation |
| `save_aggressive` | Five-Step Flow | 5 | save_aggressive | value → entry offer → survey → offer(reasonLinked) → confirmation |
| `custom_6` | Six-Step Flow | 6 | save_aggressive | value → entry offer → survey → offer(reasonLinked) → pricing table → confirmation |

Default experience on first load: `save_aggressive`, shell `modal`.

### Default step copy (per stage)

- **value_reinforcement** — title _"Wait — you'll lose access to everything you've built"_,
  desc _"Before you go, here's what your Pro plan includes and what disappears when you
  cancel."_, one `feature_list` LA card.
- **entry_offer** — title _"Before you go, a little something"_, an `extension` offer
  ("1 month on us"), `reasonLinked: false`.
- **route_detection (survey)** — title _"Help us improve — why are you cancelling?"_,
  radio survey with 5 default reasons.
- **save_mechanic (offer)** — title _"Before you go —"_, a `discount` offer, `reasonLinked:
  true`.
- **save_mechanic (pricing_table)** — title _"Or pick a plan that fits better"_.
- **confirmation** — title _"Are you sure you want to cancel?"_, `simple` confirmation.

### Default component content

- **LossAversion (feature_list)**: `keepTitle "What you'll keep"` + 3 items (Unlimited
  projects & team seats / Advanced analytics & reporting / Priority support (avg. 2hr
  response)); `loseTitle "What you'll lose"` + 3 items (All saved dashboards and reports /
  Team collaboration history / Custom automation workflows); `statsTitle "What you've
  accomplished"` + 3 stats (128 projects shipped / 3,400 credits used / 92 hrs saved this
  year); `message` = a brand-voice note. `media: null`.
- **Survey**: `radio`, `randomize:false`, options: _It's too expensive_ (`price`) /
  _Too complicated or hard to use_ (`too_complex`) / _Missing features or integrations_
  (`missing_features`) / _I'm not using it enough…_ (`not_using`) / _Switching to a
  competitor_ (`switching_competitor`); `freeTextPrompt "Tell us what led to this
  decision"`.
- **Offer**: `discount`, eyebrow "EXCLUSIVE DISCOUNT", title "50% off for 3 months",
  primary CTA "Claim 50% discount", secondary "No thanks, continue cancelling",
  downgradeLink, socialProof, `fulfillment: 'billing'`, `billingEntity.couponId "HALFOFF3"`.
- **PricingTable**: Starter ($12/mo) and Growth ($29/mo, highlighted), `fulfillment:
  'checkout'`.
- **Confirmation**: variant `simple`, keyword "CANCEL", endDateLabel "March 15, 2026",
  3 impact items (2 amber, 1 red), keep CTA "Keep my subscription", cancel CTA "Yes, cancel
  my subscription", outcome `success` with undo + feedback enabled.

### Default branding

```
merchantName 'chargebee' · siteColor #ffffff · cardColor #ffffff (solid)
primary #2563eb · secondary #dc2626 · accent #ea580c
title #0f172a · text #334155 · muted #64748b
font "'Inter', system-ui, sans-serif" · size 16 · line-height 1.5 · weight 400
letterSpacing 0 · align left · cornerRadius 12 · tone 'Friendly-professional'
cardBorderWidth 1 · cardBorderColor #e2e8f0
```

Default frame: all five toggles on (`logo, exitX, progress, title, description`).

---

## 6. Architecture: one renderer, two modes

### Render context

A React-context value threads presentation + interactivity down to every component:

```ts
interface RenderCtxValue {
  mode: 'compose' | 'play'
  interactive: boolean          // true only in play — runtime interactions live
  shell: ShellLayout
  device: 'desktop' | 'tablet' | 'mobile'
  branding: Branding
  session: PlaySession
  actions: RenderActions        // selectReason/acceptOffer/... (no-ops in compose)
  edit: RenderEdit | null       // inline-edit callbacks; non-null only in compose
}
```

- **Compose**: `interactive:false`, `edit` present, `actions` are no-ops. Text renders via
  editable widgets; runtime inputs are `readOnly`.
- **Play**: `interactive:true`, `edit:null`, `actions` wired to the store.

Rule of thumb: a component reads `mode`/`interactive` to decide between an inline-editable
field and static (rich-)HTML, but its **layout is identical** in both modes.

### Store (Zustand) shape

State: `experience`, `mode` (`compose|play`), `device`, `activeStepId` (compose selection),
`session` (runtime). Key actions:

- meta: `setMode` (entering play forks a fresh session), `setDevice`, `selectBlueprint`
  (reseed, keep shell), `setActiveStep`.
- experience edits: `setShell`, `updateBranding`, `updateFrame`, `reorderSteps` (confirmation
  is pinned last), `updateStep`, `updateComponent`, `addComponent` (guardrail-checked),
  `removeComponent`, `swapStepComponents`.
- runtime: `startPlay`, `goNext`, `goBack`, `goToIndex`, `selectReason`, `setReasonText`,
  `acceptOffer`, `declineOffer`, `completeCheckout`, `cancelCheckout`, `confirmCancel`,
  `keepSubscription`, `setConfirmInput`, `setConsent`, `setFeedback`, `undoCancel`,
  `resetSession`.

### Session (runtime state machine data)

```ts
interface PlaySession {
  index: number                          // current step
  selectedReasonId: string | null
  reasonText: Record<string, string>     // keyed by option id, plus 'free'
  acceptedOfferId: string | null
  checkout: { open: boolean; offerId: string | null }
  result: 'cancelled' | 'saved' | 'kept' | null
  undone: boolean
  confirmInput: string
  consentChecked: boolean
  feedback: string
}
```

---

## 7. Subscriber components

All live under a `.brand-surface` wrapper that applies brand CSS variables (§10). Each
component takes its typed component object; in compose, text fields become inline editors.

### 7.1 Loss Aversion — 4 canonical variants

Media is **baked into the template** (not a toggle). Switching variant swaps the whole card.

| variant | cardType | media | renders |
|---|---|---|---|
| `feature_media` | feature_list | image | media + keep/lose lists, 2-col on ≥md |
| `feature` | feature_list | null | keep/lose lists only |
| `activity` | account_activity | null | statsTitle + 3-up stat grid |
| `message_media` | message | image | media + left-accent-bordered italic message |

- **feature_list**: two `FeatureList` sections ("keep" with green checks, "lose" with red
  crosses). Each section holds **≤ 3 items**, each item can have an optional `detail`
  sub-line. Benefit lines are `whitespace-nowrap` — their intrinsic width sets the column's
  minimum so text never wraps; the paired column yields space instead (see §8 width rules).
  Inline add/delete affordances hug the end of the line on hover (add hidden at the 3-item
  cap; delete disabled at 1 item).
- **account_activity**: `statsTitle` (uppercase caption) + a `grid-cols-3` of value/label
  pairs (collapses to 1 col in `dense` mode).
- **message**: a single italic paragraph with a left accent border (`var(--brand-accent)`),
  line-height 1.4.
- **Media block**: dashed placeholder (16:10) that shows "Upload a photo/video" with size
  hints; in compose the merchant can switch type (Photo/Video before upload), Upload,
  Replace, Remove. Real asset renders `object-cover`; video autoplays muted/loop in play.
  Reads files as data URLs.
- `dense` prop compacts the card when it's the secondary column of a mixed pairing.

Helpers for variant management: `laVariantOf(component)`, `laVariantPatch(component,
variant)`, `complementaryVariant(usedSet)` (benefits pairs with messaging/activity, and
vice-versa), `usedLAVariants(components)`.

### 7.2 Survey — 3 presentations

- **radio** (default): list of bordered option rows with a custom radio dot; selecting one
  sets `selectedReasonId` and, if the option is `isOther` or has `followUp.enabled`, reveals
  an inline follow-up `textarea` (always labeled "optional"). In compose the rows are
  editable with inline add/delete (min 3, max 5; `"Other"` can't be deleted).
- **dropdown**: native `<select>` in play (labels stripped of HTML); compose shows the same
  editable list as radio.
- **free_text**: editable prompt label + a 4-row `textarea` stored under `reasonText['free']`.
- **Gating**: a survey step's Continue is disabled until the survey is "ready" — a reason is
  selected (radio/dropdown) or the free-text has non-empty trimmed content.

### 7.3 Offer

Card on a faint accent-tinted background: optional eyebrow (uppercase, accent color), a
bold headline, description, a **text-hugging** primary CTA (never full-width, accent
background), an optional underlined `downgradeLink`, and optional social proof (avatar
cluster + text). Primary CTA and downgrade link both call `acceptOffer(id)` in play.

### 7.4 Pricing Table

A row of plan cards (name, price + cadence, feature list, CTA). The `highlighted` plan is
emphasized. Each plan CTA behaves like accepting an offer (routes to checkout).

### 7.5 Confirmation — 3 variants

Centered content: amber warning badge, editable title + subtitle, then variant-specific
body:

- **simple**: bulleted **impact list** (amber/red severity dots), inline add/delete of items.
- **consent**: a checkbox + editable consent statement; the cancel CTA is **disabled until
  checked**.
- **type_confirm**: a "Type `<keyword>` to confirm" label centered over an input; cancel CTA
  **disabled until the trimmed input equals the keyword**.

Footer actions (rendered by the frame, not the card): **Keep** (outline) + **Cancel**
(secondary/dark). Keep → `result:'kept'`; Cancel → `result:'cancelled'`.

### 7.6 Outcome (post-confirmation surface)

Rendered by the player when `session.result` is set. Success/keep badge (green) vs cancelled
(indigo). Headline/body depend on result:

- `kept` → "You're all set — nothing has changed".
- `saved` → "Great — your plan is staying active".
- `cancelled` → uses `outcome.headline/body`, and by variant:
  - **reactivation**: a prominent Undo button (accent) + "restore anytime in the next 30
    days"; clicking sets `session.undone` and swaps copy to "Welcome back — your plan is
    restored".
  - **feedback**: a feedback prompt + textarea (`session.feedback`).
  - **success**: headline/body only.

Footer offers a single "Close" (ghost) which calls `resetSession`.

---

## 8. Step layout & responsive rules (`StepRenderer`)

- **1 component**: rendered full-width; in compose an **"+ Add component" slot** sits beside
  it (stacks below on mobile). The add slot offers only kinds allowed by the guardrails.
- **2 components**: `TwoColumnStep`.
  - **Desktop / tablet**: side-by-side using flex with `flex: ratio` / `flex: 1-ratio`
    where `ratio = clamp(step.splitRatio ?? 0.6, 0.3, 0.7)`.
    - In compose, a **draggable vertical divider** sits between them (a full-height guide
      line + grip) with a round **"Swap sides"** icon-button centered above it. Dragging
      updates `splitRatio`.
    - **Width guard**: the feature-list ("benefits") card is width-protected — its lines
      never wrap. After a drag, if the nearest scrollable ancestor now overflows
      (step taller than the surface), the ratio **snaps back** to the last value that fit.
    - In play, no divider; two offers show a centered **"OR"** between them.
  - **Mobile**: the two components **stack vertically** with a gap; compose shows a compact
    "Swap order" button between them (play shows "OR" for two offers).
  - The secondary/aside column is rendered `dense` only for a classic supporting pairing
    (e.g. survey + LA); two LA cards or two offers both render full.

---

## 9. Step frame (shared chrome) — `StepFrame`

`StepFrame` picks `ModalFrame` when `shell === 'modal'`, else `FullPageFrame`. Both share:

- **Header**: brand logo (left) if `frame.logo`; right side shows `STEP n OF total` if
  `frame.progress` and an exit ✕ if `frame.exitX`.
- **Title block**: editable step `title` (h2) + `description` (p), shown per
  `frame.title`/`frame.description`. Larger + left-aligned on full page
  (`text-[30px]` extrabold) vs modal (`text-[22px]` bold). Hidden on confirmation
  (`hideTitleBlock`) since the confirmation card centers its own title.
- **Footer nav**: a **Back** link (when `showBack`) on the left and the primary
  action(s) on the right. `centerActions` centers the actions (used on a single-step
  confirmation).

### Modal frame specifics

- Floating card: `border-radius var(--brand-radius)`, two-layer background so **fill and
  border both support gradients** while corners stay crisp (see §10), soft drop shadow.
- **Height is pinned** to the current step's measured height and **eased between steps**
  (`transition: height 280ms cubic-bezier(0.4,0,0.2,1)`), so switching steps gently
  grows/shrinks instead of snapping. Fallback `min-height: 520px` before measurement.
- Body padding `px-8 py-7`; header `px-8 py-5`; footer `px-8 py-4` with hairline borders.

### Full-page frame specifics

- Fills the device screen on `var(--brand-site)`. Fixed **header bar** + **footer nav bar**
  (subtle tint) with the content scrolling between. Content is a **wide, left-aligned band**
  with generous gutters: `maxWidth` = desktop **1120**, tablet **720**, mobile none;
  padding `px-12` (desktop/tablet) / `px-6` (mobile). Content is **top-aligned** (never
  vertically centered) so the title stays anchored.

---

## 10. Theming (brand tokens)

Branding → CSS custom properties on any `.brand-surface` wrapper (`brandStyle(branding)`).
Everything inside inherits them, so the card carries the **merchant** brand.

Variables emitted:

```
--brand-primary, --brand-primary-hover (= primary shaded -12%)
--brand-secondary, --brand-accent, --brand-site
--brand-card         (fill, ALWAYS emitted as a background-IMAGE)
--brand-card-border  (border paint, ALWAYS a background-image)
--brand-card-border-width
--brand-title, --brand-text, --brand-muted
--brand-font-heading, --brand-font-body
--brand-font-size, --brand-line-height, --brand-font-weight
--brand-letter-spacing (letterSpacing/100 em), --brand-text-align
--brand-radius
```

Key theming techniques to replicate:

- **Card fill + border as background-images.** The card paints two background layers
  (`--brand-card` fill in the padding box, `--brand-card-border` in the border box, with
  `background-origin/clip: padding-box, border-box`). Solids are wrapped as
  `linear-gradient(color, color)` via `toImage()` so a solid in a non-final background layer
  stays a valid CSS declaration — this lets both fill and border be solid **or** gradient
  without special-casing.
- **Slate → brand text mapping.** Components use neutral Tailwind `text-slate-*` utilities;
  scoped CSS under `.brand-surface` remaps `900/800→title`, `700/600→text`, `500/400→muted`.
  Semantic colors (red/green/primary) are untouched. This themes all copy without editing
  each component.
- **Locked font-size scale** for rich text: `execCommand fontSize 2/4/6` → `.85em / 1em /
  1.22em`, each line-height 1.4 (S/M/L).
- Helpers: `shade(hex, %)`, `tint(hex, alpha)`.

---

## 11. Runtime flow (player state machine)

`PlayerShell` renders, in priority order:

1. **Outcome** — if `session.result` is set and a confirmation exists → `OutcomeCard` in a
   frame with a Close action.
2. **Dummy checkout** — if `session.checkout.open` → a mock "Complete your change" screen
   with Back (`cancelCheckout`) and "Confirm & apply" (`completeCheckout` → `result:'saved'`).
3. **Full-page vertical scroll shell** — if `shell === 'fullpage_scroll'` → `FullPageScroll`.
4. **Regular step** — `StepFrame` + `StepRenderer` for the current step.

Footer per step:

- **Confirmation step** → Keep + Cancel (with variant gating from §7.5).
- **Other steps** → single Continue button. Label = `step.navContinueLabel` else
  `"No thanks, continue cancelling →"` when the step has an offer, else `"Continue"`
  (labels may contain HTML). Continue is **disabled until the step's survey (if any) is
  ready**.

Offer acceptance (`acceptOffer`): if the offer/plan **alters billing** (pricing table, or
offer with `fulfillment:'checkout'`, or category in
`discount|plan_change|addon|one_time_charge`) → open the dummy **checkout**; otherwise set
`result:'saved'` directly. `declineOffer` = advance to next step.

Navigation: `goNext/goBack/goToIndex` clamp to `[0, total-1]`.

### Three shells — the differentiator

- **`modal`** — floating dialog over a dimmed, blurred "page behind" mock (see §12). One
  step at a time; height animates between steps.
- **`fullpage`** — the experience fills the browser viewport as a hosted page; header/footer
  fixed, content scrolls; one step at a time (nav via footer).
- **`fullpage_scroll`** — a **locked vertical slide deck** (`FullPageScroll`): every step is
  a full-viewport section absolutely stacked; the active slide sits at `translateY(0)`,
  earlier slides parked above (`-100%`), later below (`+100%`), transitioning
  `transform 520ms cubic-bezier(0.4,0,0.2,1)`. The deck is **NOT freely scrollable** — only
  the visible slide is interactive (`pointer-events`), slides > 1 away are `visibility:
  hidden`, and the user can only advance via nav actions (with the same survey gating).
  Confirmation keeps Keep/Cancel resolving to the outcome surface.

---

## 12. Device preview chrome (`DeviceChrome` + `FittedDevice`)

Preview renders inside a realistic, fixed-size device whose screen keeps a true aspect
ratio, then is **scaled down** (never up) via CSS transform to fit the available height so
the page never scrolls.

- **Screen dimensions** (device-independent px): desktop monitor **1040×650** (16:10,
  content max 520), tablet **540×720** (3:4, max 520), mobile **360×780** (19.5:9, max 360).
- **Chrome**: desktop = monitor bezel + browser toolbar (traffic dots + a URL like
  `merchant.com/account/subscription/cancel`) + stand; tablet = rounded bezel + camera;
  mobile = rounded bezel + dynamic island + side buttons.
- **Modal shell**: the screen shows a faint **"page behind"** account-page mock + a
  `bg-slate-900/25 backdrop-blur` scrim; the card floats centered and the screen scrolls
  internally if the card is taller.
- **Full-page shells**: `fullBleed` — the experience fills the screen, no page-mock/scrim.
- `FittedDevice` measures native size vs stage and sets `scale = min(1, stageH/natH,
  stageW/natW)`, top-aligned.
- **Composer modal preview** uses narrower fixed **card widths** (desktop **680**, tablet
  **560**, mobile **380**) with a 44px page pad, and an off-screen measurer that renders
  every step to find the tallest so the visible card can pin height without jumping.
- Composer full-page preview uses `DeviceChrome ... fullBleed bare` (aspect-correct screen,
  no hardware bezel).

---

## 13. Composer (merchant builder)

3-pane grid: `[280px | 1fr | 360px]`.

- **Left — Blueprint sidebar**: the blueprint picker (a stack of pills; the selected one is
  a raised pill, others fade/blur with distance and snap to focus on hover) + step
  navigation. Also where shell (modal / full page / full-page scroll) is chosen.
- **Center — Preview**: device toggle + **StepTabs** (drag-to-reorder step tabs;
  confirmation locked last) + the live preview (modal or full-page). This is the WYSIWYG
  canvas — all copy is edited **inline here**, not in forms.
- **Right — Inspector** (`STabs`: **Setup** | **Brand**):
  - **Setup** (`StepEditor`): lists the current step's components; each has a Remove control
    (except confirmation / when it's the only one) and a per-kind editor exposing the
    structured, non-inline settings — e.g. **LA variant** dropdown, **survey presentation /
    randomize**, **offer category / fulfillment / reasonLinked**, **confirmation variant** +
    **outcome variant**, pricing plans. Copy itself is edited inline in the preview.
  - **Brand** (`BrandingPanel`): merchant name/logo, colors (site/card/border, solid or
    gradient), typography (family, size, line-height, weight, letter-spacing, align),
    corner radius, tone.

### Inline editing & rich text

- `EditableText` / `EditableCTA` render a `contentEditable` field in compose (with a
  dark-blue hover/focus highlight — the `.editable` affordance) and static (rich-)HTML in
  play. Support single-line and multi-line, placeholders, and commit-on-blur.
- A **floating rich-text toolbar** (`.rt-toolbar`, light card matched to the builder, arrow
  pointer) appears on text selection: bold / italic / underline, a **locked S/M/L font size
  scale** (`execCommand fontSize 2/4/6`), and a **link** action. (Bulleted/numbered lists
  exist in CSS but are not offered in the toolbar on this branch.)
- Inline structural affordances: `InlineAddButton` / `InlineAddIconButton` /
  `InlineDeleteButton` for list items, survey reasons, impact/benefit rows — appearing on
  hover at the end of the edited line, respecting min/max caps.

### Top bar & mode toggle

App shell: a top bar (product name + current blueprint/step count) with a **Compose /
Preview** toggle. Preview mounts `PlayView` (device toggle + Restart + `DeviceChrome` around
`PlayerShell`).

---

## 14. File map (reference implementation)

```
src/
  types/experience.ts        # the domain model (§3) + constants
  store/useExperience.ts     # Zustand store: state + all actions (§6)
  lib/
    blueprints.ts            # BLUEPRINTS, DEFAULT_BRANDING/FRAME, seedSteps/seedExperience (§5)
    factories.ts             # make{LossAversion,Survey,Offer,PricingTable,Confirmation} defaults
    guardrails.ts            # canAddToStep, hasCapRoom, validateExperience (§4)
    laVariants.ts            # 4 LA variants + variant helpers (§7.1)
    id.ts                    # uid()
  render/
    RenderContext.tsx        # ctx type + provider + defaults (§6)
    brand.ts                 # brandStyle() + gradient/solid paint helpers (§10)
    StepFrame.tsx            # Modal vs FullPage chrome (§9)
    StepRenderer.tsx         # 1- vs 2-column layout, width divider/guard (§8)
    DeviceChrome.tsx         # device bezels, FittedDevice, PageBehind, ScreenSurface (§12)
    DeviceFrame.tsx          # DEVICE_WIDTHS (composer modal card widths)
    DeviceToggle.tsx         # desktop/tablet/mobile switch
    Editable.tsx             # inline editors, rich-text toolbar, inline add/delete
    BrandUI.tsx              # BrandButton, BrandLogo
    components/
      LossAversionCard.tsx SurveyReasons.tsx OfferCard.tsx
      PricingTable.tsx ConfirmationCard.tsx OutcomeCard.tsx
  runtime/
    PlayerShell.tsx          # runtime state machine + shells routing (§11)
    FullPageScroll.tsx       # locked vertical slide deck (§11)
    DummyCheckout.tsx        # mock checkout for billing-altering offers
  composer/
    Composer.tsx ComposerPreview.tsx ComposerInspector.tsx
    BlueprintSidebar.tsx StepTabs.tsx StepEditor.tsx BrandingPanel.tsx
    AddComponentSlot.tsx editors.tsx fields.tsx
  App.tsx main.tsx index.css
```

---

## 15. Rebuild checklist (recommended order)

1. **Domain model + constants** (§3) — the serialized `Experience`. On Brightback this is
   the persisted campaign/flow config; keep field names stable for storage/analytics
   (`code`/`ReasonForLeaving`, offer `category`/`fulfillment`, `billingEntity`).
2. **Factories + blueprints** (§5) — deterministic seed content per blueprint.
3. **Guardrails** (§4) — add-time rules + validation sweep (surface issues in the builder).
4. **Render context + brand tokens** (§6, §10) — the compose/play switch and CSS-variable
   theming (fill/border as background-images; slate→brand remap).
5. **StepFrame** (§9) — modal + full-page chrome, header/title/footer, modal height easing.
6. **Components** (§7) — LA (4 variants), Survey (3 presentations + gating), Offer,
   PricingTable, Confirmation (3 variants), Outcome (3 variants).
7. **StepRenderer** (§8) — 1/2-column layout, split ratio + width guard, responsive stack.
8. **Runtime** (§11) — session state machine, three shells (esp. the locked slide deck),
   offer→checkout routing, outcome + undo.
9. **Device preview** (§12) — fit-to-viewport scaling, device bezels, page-behind + scrim.
10. **Composer** (§13) — 3-pane builder, inline editing + rich-text toolbar, inspector
    (variant/structured settings), blueprint picker, step reordering, brand panel.

### Notes for the Brightback context

- The renderer must stay a **pure function of config + session + mode + device** so the same
  code powers the merchant preview and the live subscriber experience.
- Anything billing-related (`fulfillment`, `billingEntity`, checkout) is **mocked** in the
  prototype (`DummyCheckout`, in-memory `result`). On the server these map to real
  offer-fulfillment / billing integrations and to persisted `ReasonForLeaving` analytics.
- Media is stored as data URLs in the prototype; production should use uploaded asset URLs.
- Keep the FTC guardrails (≤ 6 steps, mandatory + last confirmation, click-to-cancel parity)
  as server-validated invariants, not just UI hints.
```

_Reference branch: `full-page-experience` of `cancel-experience-prototype-V1`. This branch
does not include the config-persistence work (presets/share links) or the responsive
modal type-scale refinements — those live on `feat/config-persistence`._
