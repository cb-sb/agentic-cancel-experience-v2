import { create } from 'zustand'
import { LAYOUT } from '../layout/layoutMode'
import { LIBRARY, startFromTemplate, withLive } from '../journey/templates'
import {
  DEFAULT_JOURNEY_BRAND,
  EMPTY_JOURNEY,
  type JourneyBrand,
  type JourneyFile,
  type JourneyTemplate,
} from '../journey/types'
import { planIntro, type PlanBeat } from '../orchestration/JourneyPlan'
import { useCopilotThread, type CopilotLine, type PromptTurn } from '../orchestration/copilotThread'
import { applyDraftPayload, captureDraft, setDraftSink, type Draft } from '../store/draft'
import { useExperience } from '../store/useExperience'
import { resetHistoryBaseline, useHistory } from '../store/useHistory'
import { restoreJourney, useJourney } from '../store/useJourney'
import { useOrchestration } from '../store/useOrchestration'
import { useUpload } from '../upload/useUpload'
import { startPaneSync, whilePaused } from './paneTabs'
import { NO_TABS, useWorkspaceUi, type ThreadTabs } from './useWorkspaceUi'

/** Separate from the V5 draft key, so the two never overwrite each other. */
const KEY = 'cancel-experience:workspace:v1'

export interface ThreadChat {
  lines: CopilotLine[]
  turn: PromptTurn
  beat: PlanBeat
}

/** The V5 draft, plus what makes it a thread: its chat, its open tabs, and which surface was up. */
export interface ThreadSnapshot extends Draft {
  dirty: boolean
  chat: ThreadChat
  tabs: ThreadTabs
  surface: 'editor' | 'canvas'
}

export interface ExperienceThread {
  id: string
  title: string
  updatedAt: number
  /** Seeded from a Chargebee template so the list isn't empty on first visit. */
  sample?: boolean
  /** Sample that hasn't been opened yet: built from this template on first open. */
  seed?: JourneyTemplate
  snapshot?: ThreadSnapshot
}

interface WorkspaceState {
  threads: ExperienceThread[]
  activeId: string
  /** Look new experiences start from. Follows the last brand set in any experience. */
  brand: JourneyBrand | null
  installConnected: boolean
}

export const useWorkspace = create<WorkspaceState>(() => ({
  threads: [],
  activeId: '',
  brand: null,
  installConnected: false,
}))

const SAMPLE_SEEDS: JourneyTemplate[] = ['cancel_4', 'cancel_plan_change', 'cancel_1']
const DAY = 24 * 60 * 60 * 1000

let n = 0
const newId = () => `t-${Date.now().toString(36)}-${n++}`

export function titleFor(file: JourneyFile): string {
  if (file.steps.length === 0) return 'New experience'
  if (file.source === 'uploaded') return file.name
  const entry = LIBRARY.find((e) => e.id === file.template)
  if (entry) return entry.title
  return file.name && file.name !== EMPTY_JOURNEY.name ? file.name : 'Cancel experience'
}

function isBlank(t: ExperienceThread): boolean {
  if (t.seed) return false
  if (!t.snapshot) return true
  return t.snapshot.journey.steps.length === 0 && t.snapshot.chat.lines.length === 0
}

function persist(): boolean {
  const { threads, activeId, brand, installConnected } = useWorkspace.getState()
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, threads, activeId, brand, installConnected }))
    return true
  } catch {
    return false
  }
}

function read(): WorkspaceState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as WorkspaceState & { v?: number }
    if (parsed.v !== 1 || !Array.isArray(parsed.threads) || parsed.threads.length === 0) return null
    const activeId = parsed.threads.some((t) => t.id === parsed.activeId) ? parsed.activeId : parsed.threads[0].id
    return {
      threads: parsed.threads,
      activeId,
      brand: parsed.brand ?? null,
      installConnected: Boolean(parsed.installConnected),
    }
  } catch {
    return null
  }
}

function seedWorkspace(): WorkspaceState {
  const now = Date.now()
  const samples: ExperienceThread[] = SAMPLE_SEEDS.map((seed, i) => ({
    id: newId(),
    title: LIBRARY.find((e) => e.id === seed)?.title ?? 'Sample',
    updatedAt: now - (i + 1) * DAY,
    sample: true,
    seed,
  }))
  const blank: ExperienceThread = { id: newId(), title: 'New experience', updatedAt: now }
  return { threads: [blank, ...samples], activeId: blank.id, brand: null, installConnected: false }
}

function captureSnapshot(draft?: Draft): ThreadSnapshot {
  const orch = useOrchestration.getState()
  const chat = useCopilotThread.getState()
  return {
    ...(draft ?? captureDraft(orch.savedAt ?? 0)),
    dirty: draft ? false : orch.dirty,
    chat: { lines: chat.lines, turn: chat.turn, beat: chat.beat },
    tabs: useWorkspaceUi.getState().tabs,
    surface: orch.workSurface,
  }
}

function patchThread(id: string, patch: Partial<ExperienceThread>) {
  useWorkspace.setState((s) => ({
    threads: s.threads.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  }))
}

/** Put the active experience's state into its thread. `draft` means the merchant pressed Save draft. */
function storeActive(draft?: Draft) {
  const { activeId, threads } = useWorkspace.getState()
  const thread = threads.find((t) => t.id === activeId)
  if (!thread) return
  const snapshot = captureSnapshot(draft)
  const touched = Boolean(draft) || useOrchestration.getState().dirty
  patchThread(activeId, {
    snapshot,
    seed: undefined,
    title: titleFor(snapshot.journey),
    ...(touched ? { updatedAt: Date.now(), sample: false } : {}),
  })
}

function prepStores() {
  useUpload.getState().close()
  useExperience.getState().setMode('compose')
  const orch = useOrchestration.getState()
  orch.closeTemplates()
  orch.resetSetup()
  useOrchestration.setState({ annotateMode: false, annotationTarget: null })
}

function blankBrand(): JourneyBrand {
  return { ...(useWorkspace.getState().brand ?? DEFAULT_JOURNEY_BRAND) }
}

function openBlank() {
  restoreJourney({ ...EMPTY_JOURNEY, brand: blankBrand() })
  useHistory.getState().clear()
  useCopilotThread.getState().reset()
  useWorkspaceUi.setState({ tabs: NO_TABS })
}

function openSample(seed: JourneyTemplate) {
  openBlank()
  const file = startFromTemplate({ ...EMPTY_JOURNEY, brand: blankBrand() }, seed)
  const live = { ...file, steps: withLive(file.steps, true) }
  restoreJourney(live)
  const chat = useCopilotThread.getState()
  chat.say('you', LIBRARY.find((e) => e.id === seed)?.title ?? 'Start with a template')
  chat.say('bot', planIntro(live), { widget: 'plan' })
  chat.setTurn('plan')
  chat.setBeat('walk')
  useOrchestration.getState().setSpotlight(null)
  useOrchestration.setState({ stepStripShown: true })
  useWorkspaceUi.setState({ tabs: { open: ['editor'], active: 'editor' } })
}

function openSnapshot(s: ThreadSnapshot) {
  applyDraftPayload(s)
  useHistory.getState().hydrate(Array.isArray(s.history) ? s.history : [])
  useCopilotThread.setState({ lines: s.chat.lines, turn: s.chat.turn, beat: s.chat.beat })
  const tabs = s.tabs ?? NO_TABS
  useWorkspaceUi.setState({ tabs })
  const fromTab = LAYOUT === 'tabs' && (tabs.active === 'editor' || tabs.active === 'canvas') ? tabs.active : null
  const surface = fromTab ?? (s.surface === 'canvas' ? 'canvas' : 'editor')
  useOrchestration.setState({
    stepStripShown: s.journey.steps.length > 0,
    workSurface: surface,
  })
  if (LAYOUT === 'tabs' && tabs.active === 'preview') useExperience.getState().setMode('play')
}

function openThread(id: string) {
  whilePaused(() => openThreadNow(id))
}

function openThreadNow(id: string) {
  const thread = useWorkspace.getState().threads.find((t) => t.id === id)
  if (!thread) return
  prepStores()
  if (thread.snapshot) openSnapshot(thread.snapshot)
  else if (thread.seed) openSample(thread.seed)
  else openBlank()
  const snap = thread.snapshot
  useOrchestration.setState({
    savedAt: snap && snap.savedAt ? snap.savedAt : null,
    dirty: snap ? snap.dirty : false,
    installConnected: useWorkspace.getState().installConnected,
  })
  useWorkspaceUi.setState({ paneHidden: false })
  resetHistoryBaseline()
}

export function switchThread(id: string) {
  const { activeId } = useWorkspace.getState()
  if (id === activeId) return
  storeActive()
  useWorkspace.setState({ activeId: id })
  openThread(id)
  persist()
}

export function newThread() {
  const emptyNow =
    useJourney.getState().file.steps.length === 0 && useCopilotThread.getState().lines.length === 0
  if (emptyNow) {
    useWorkspaceUi.setState({ search: '' })
    return
  }
  storeActive()
  const stale = useWorkspace.getState().threads.filter((t) => t.id !== useWorkspace.getState().activeId && isBlank(t))
  if (stale.length) {
    const drop = new Set(stale.map((t) => t.id))
    useWorkspace.setState((s) => ({ threads: s.threads.filter((t) => !drop.has(t.id)) }))
  }
  const thread: ExperienceThread = { id: newId(), title: 'New experience', updatedAt: Date.now() }
  useWorkspace.setState((s) => ({ threads: [thread, ...s.threads], activeId: thread.id }))
  openThread(thread.id)
  persist()
}

export function setWorkspaceInstall(connected: boolean) {
  useWorkspace.setState({ installConnected: connected })
  useOrchestration.getState().setInstallConnected(connected)
  persist()
}

/** Newest on top. Seeded threads carry older times, so new work lands above them. */
export function orderedThreads(threads: ExperienceThread[]): ExperienceThread[] {
  return [...threads].sort((a, b) => b.updatedAt - a.updatedAt)
}

function watchActiveThread() {
  let last = useJourney.getState().file
  useJourney.subscribe((s) => {
    if (s.file === last) return
    last = s.file
    const { activeId, threads, brand } = useWorkspace.getState()
    const title = titleFor(s.file)
    const thread = threads.find((t) => t.id === activeId)
    if (thread && thread.title !== title) patchThread(activeId, { title })
    if (s.file.brand.matched && s.file.brand !== brand) useWorkspace.setState({ brand: s.file.brand })
  })
}

/** Boot for the threads and tabs layouts, in place of loadDraft. */
export function loadWorkspace() {
  setDraftSink({
    save: (draft) => {
      storeActive(draft)
      return persist()
    },
    clear: () => {
      patchThread(useWorkspace.getState().activeId, {
        snapshot: undefined,
        seed: undefined,
        sample: false,
        title: 'New experience',
        updatedAt: Date.now(),
      })
      useWorkspaceUi.setState({ tabs: NO_TABS })
      persist()
    },
  })
  useWorkspace.setState(read() ?? seedWorkspace())
  openThread(useWorkspace.getState().activeId)
  persist()
  watchActiveThread()
  startPaneSync()
}
