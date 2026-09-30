import { tool } from 'ai'
import { z } from 'zod'

/**
 * Every tool the agent can call. None run on the server: the browser owns the
 * product state, so the client runs each call and sends the result back.
 * Tools in INTERACTIVE wait for the merchant to answer a card in the chat.
 */

const objective = z.enum(['acquisition', 'expansion', 'retention'])
const experienceType = z.enum(['cancel_page', 'in_app_offer', 'pricing_table'])
const optionalId = z.string().nullish().describe('Experience id. Leave out to use the experience this chat is about.')

export const ROUTES = [
  'home',
  'experiences.acquisition',
  'experiences.expansion',
  'experiences.retention',
  'library.offers',
  'library.pricing_tables',
  'library.templates',
  'library.components',
  'library.brand',
  'people.audiences',
  'people.engaged',
  'renewal',
  'reports.cancels',
  'reports.offer',
  'reports.experience',
  'reports.cohort',
  'reports.lift',
  'settings',
] as const

const offerFields = {
  name: z.string(),
  objective,
  widget: z.enum(['modal', 'popup', 'banner', 'la_card']),
  category: z.enum([
    'discount',
    'pause',
    'plan_change',
    'extension',
    'skip',
    'addon',
    'trial_conversion',
    'annual_upgrade',
    'support',
    'feedback',
    'credits',
    'multi',
  ]),
  title: z.string().describe('Headline the subscriber sees'),
  description: z.string(),
  cta: z.string().describe('Button label'),
  value: z.string().describe('What the subscriber gets, in words, e.g. "25% off for 3 months"'),
  processing: z.enum(['billing_update', 'checkout', 'url_redirect', 'webhook', 'email']),
  acceptStep: z.enum(['confirmation', 'link', 'feedback', 'dismiss']),
}

export const toolSpecs = {
  triage: tool({
    description:
      [
        'Classify what the merchant wants before doing anything else on Home. Call once per new request. Low confidence means ask one question with ask_choice next.',
        'Signals:',
        '"stop people cancelling", "save churn", "cancel flow" -> retention, experience, cancel_page, create',
        '"import my own pages", "upload my design" -> retention, experience, cancel_page, create',
        '"convert more trials", "trial ending" -> acquisition, experience, in_app_offer, create',
        '"set up a pricing page", "show my plans" -> acquisition, experience, pricing_table, create',
        '"upsell to annual", "sell an add-on", "upgrade" -> expansion, experience, in_app_offer, create',
        '"make a 20% off offer" -> offer, create. "why are people cancelling" -> retention, report, analyze',
        '"who sees this", "segment" -> audience. "change my colours" -> brand. A named experience -> improve with target.',
      ].join('\n'),
    inputSchema: z.object({
      objective: z.enum(['acquisition', 'expansion', 'retention', 'none']),
      object: z.enum([
        'experience',
        'offer',
        'pricing_table',
        'component',
        'brand',
        'audience',
        'report',
        'renewal',
        'settings',
        'general',
      ]),
      type: experienceType.nullish(),
      action: z.enum(['create', 'improve', 'analyze', 'explain', 'navigate']),
      target: z.string().nullish().describe('Id of an existing experience, offer or table the request is about'),
      confidence: z.number().min(0).max(1),
      summary: z.string().describe('One short line in the merchant’s words, e.g. "New cancel page for annual plans"'),
    }),
  }),

  ask_choice: tool({
    description: 'Ask the merchant one question with 2 to 5 short answers as chips. Use only when you cannot pick a sensible default.',
    inputSchema: z.object({
      question: z.string(),
      options: z.array(z.string()).min(2).max(5),
    }),
  }),

  navigate: tool({
    description: 'Open a page in Growth.',
    inputSchema: z.object({ to: z.enum(ROUTES) }),
  }),

  list_experiences: tool({
    description: 'List experiences, optionally for one objective.',
    inputSchema: z.object({ objective: objective.nullish() }),
  }),

  get_experience: tool({
    description:
      'Read one experience in full: steps and copy for cancel pages, offer or table for others, audience, trigger, split, control, priority, status and what is left before it can go live.',
    inputSchema: z.object({ id: optionalId }),
  }),

  open_experience: tool({
    description: 'Open an existing experience in its workspace. This chat moves with the merchant.',
    inputSchema: z.object({ id: z.string() }),
  }),

  create_experience: tool({
    description:
      'Create a new experience and open its workspace. This chat moves into it. Cancel pages are always retention. Only call once you know the objective and type.',
    inputSchema: z.object({
      objective,
      type: experienceType,
      name: z.string().describe('Short name, e.g. "Save annual subscribers"'),
      audienceId: z.string().nullish(),
      brief: z.string().nullish().describe('What the merchant wants this experience to do, in one or two lines'),
    }),
  }),

  show_doors: tool({
    description:
      'Show the ways to start an experience as cards in the chat. Cancel pages: template, upload your own design, or build with you. In-app offers and pricing tables: pick from the library, or build with you. Waits for the pick.',
    inputSchema: z.object({ type: experienceType }),
  }),

  show_templates: tool({
    description: 'Show cancel page templates as cards so the merchant can compare and pick one. Waits for the pick.',
    inputSchema: z.object({ ids: z.array(z.string()).nullish().describe('Template ids to show. Leave out for all.') }),
  }),

  start_from_template: tool({
    description: 'Put a cancel page template on the open cancel page. Replaces its screens, so only after the merchant asked for it.',
    inputSchema: z.object({
      template: z.string().describe('Template id from the catalog'),
      replace: z.boolean().nullish().describe('True once the merchant agreed to replace the screens already on the page'),
    }),
  }),

  update_step: tool({
    description: 'Change one screen of the open cancel page. Only pass the fields that change.',
    inputSchema: z.object({
      stepId: z.string(),
      headline: z.string().nullish(),
      body: z.string().nullish(),
      offer: z.enum(['discount', 'pause', 'plan_change', 'extension', 'skip', 'addon']).nullish(),
      keepItems: z.array(z.string()).nullish().describe('Loss aversion: what they keep or lose'),
      surveyReasons: z.array(z.string()).nullish(),
    }),
  }),

  add_step: tool({
    description:
      'Add a screen to the open cancel page before the confirmation screen. A save offer on a cancel page is a screen of kind offer.',
    inputSchema: z.object({
      kind: z.enum(['loss_aversion', 'survey', 'offer']),
      offer: z.enum(['discount', 'pause', 'plan_change', 'extension', 'skip', 'addon']).nullish(),
      headline: z.string().nullish(),
      body: z.string().nullish().describe('For an offer, say the value, e.g. "25% off for the next 3 months"'),
    }),
  }),

  remove_step: tool({
    description: 'Remove a screen from the open cancel page.',
    inputSchema: z.object({ stepId: z.string() }),
  }),

  open_tab: tool({
    description: 'Open a tab next to the chat in the cancel page workspace.',
    inputSchema: z.object({ tab: z.enum(['editor', 'preview', 'targeting', 'canvas', 'plan']) }),
  }),

  set_audience: tool({
    description: 'Choose who sees an experience. Use an audience id from the context.',
    inputSchema: z.object({ id: optionalId, audienceId: z.string() }),
  }),

  set_trigger: tool({
    description: 'Choose when an in-app offer or pricing table shows. Cancel pages always show when someone clicks Cancel.',
    inputSchema: z.object({
      id: optionalId,
      kind: z.enum(['any_page', 'url', 'event']),
      value: z.string().nullish().describe('URL fragment or event name'),
    }),
  }),

  use_in_experience: tool({
    description: 'Show a library offer or pricing table in an in-app offer or pricing table experience.',
    inputSchema: z.object({ id: optionalId, refId: z.string() }),
  }),

  set_priority: tool({
    description: 'Move an experience to a position in its list. 1 wins when two experiences match the same subscriber.',
    inputSchema: z.object({ id: optionalId, position: z.number().int().min(1) }),
  }),

  set_status: tool({
    description: 'Pause or archive an experience. To go live, use publish.',
    inputSchema: z.object({ id: optionalId, status: z.enum(['inactive', 'archived', 'draft']) }),
  }),

  set_control: tool({
    description:
      'Set the share of the audience who see nothing, so lift can be measured. Needs the merchant’s approval, shown as a card. For cancel pages this is the account-wide Global control.',
    inputSchema: z.object({ id: optionalId, percent: z.number().min(0).max(50), reason: z.string() }),
  }),

  set_split: tool({
    description:
      'Run a test: split the audience across two or more versions. Needs the merchant’s approval, shown as a card. For in-app offers and pricing tables pass the offer or table id for each version.',
    inputSchema: z.object({
      id: optionalId,
      variants: z
        .array(z.object({ label: z.string(), refId: z.string().nullish(), percent: z.number().min(1).max(100) }))
        .min(2)
        .max(4),
      reason: z.string(),
    }),
  }),

  publish: tool({
    description: 'Take an experience live. Needs the merchant’s approval, shown as a card with what is still open.',
    inputSchema: z.object({ id: optionalId }),
  }),

  match_brand: tool({
    description: 'Read colours, font and logo from the merchant’s website and apply them to the brand.',
    inputSchema: z.object({ url: z.string() }),
  }),

  list_library: tool({
    description: 'List what is in one part of the Library.',
    inputSchema: z.object({ section: z.enum(['offers', 'pricing_tables', 'templates', 'components']) }),
  }),

  create_offer: tool({
    description: 'Add an offer to the Library. Needs the merchant’s approval, shown as a card with the offer.',
    inputSchema: z.object(offerFields),
  }),

  update_offer: tool({
    description: 'Change an offer in the Library. Changes to value or processing need approval, shown as a card.',
    inputSchema: z.object({ id: z.string(), ...Object.fromEntries(Object.entries(offerFields).map(([k, v]) => [k, v.nullish()])) }),
  }),

  archive_offer: tool({
    description: 'Archive a Library offer. Blocked while a live experience uses it. Needs approval.',
    inputSchema: z.object({ id: z.string() }),
  }),

  create_pricing_table: tool({
    description: 'Add a pricing table to the Library from catalog plans. Needs approval, shown as a card.',
    inputSchema: z.object({
      name: z.string(),
      objective,
      planIds: z.array(z.string()).min(1).max(4).describe('Catalog plan ids'),
      frequency: z.enum(['monthly', 'yearly', 'both']),
      hideCurrentPlan: z.boolean(),
      cta: z.enum(['checkout', 'contact']),
    }),
  }),

  update_survey_reasons: tool({
    description: 'Replace the survey reasons in the Library. Each has a stable code for reporting.',
    inputSchema: z.object({ reasons: z.array(z.object({ code: z.string(), label: z.string() })).min(2).max(10) }),
  }),

  show_kit: tool({
    description: 'Cancel pages only. Show the upload card: get the Growth kit, upload the pages built with it, then check and save them. Waits until saved.',
    inputSchema: z.object({}),
  }),

  show_upload: tool({
    description: 'Upload, step 2: show the drop zone for the file their LLM built. Waits until the file is checked.',
    inputSchema: z.object({}),
  }),

  review_upload: tool({
    description: 'Upload, step 3: show the screens found in the file for the merchant to check and save. Waits.',
    inputSchema: z.object({}),
  }),

  show_sample: tool({
    description:
      'Answer a question about People, Renewal Optimization, Reports or Settings with a sample card and a link to the page. These areas are not built in this prototype.',
    inputSchema: z.object({
      area: z.enum(['people', 'renewal', 'reports', 'settings']),
      question: z.string(),
    }),
  }),

  remember: tool({
    description: 'Save a lasting fact about the merchant’s business or preferences for future chats.',
    inputSchema: z.object({ fact: z.string() }),
  }),

  update_brief: tool({
    description: 'Update the one or two line brief for the experience this chat is about.',
    inputSchema: z.object({ brief: z.string() }),
  }),

  undo: tool({
    description: 'Undo the last change on the open cancel page.',
    inputSchema: z.object({}),
  }),
}

export type ToolName = keyof typeof toolSpecs

/** Tools answered by the merchant in a card, not run straight away. */
export const INTERACTIVE: ReadonlySet<string> = new Set<ToolName>([
  'ask_choice',
  'show_doors',
  'show_templates',
  'show_kit',
  'show_upload',
  'review_upload',
  'set_control',
  'set_split',
  'publish',
  'create_offer',
  'archive_offer',
  'create_pricing_table',
])

/** Tools that work on the open experience, so Home has to create or open one first. */
export const NEEDS_OPEN: readonly ToolName[] = [
  'show_doors',
  'show_templates',
  'start_from_template',
  'update_step',
  'add_step',
  'remove_step',
  'open_tab',
  'show_kit',
  'show_upload',
  'review_upload',
]
