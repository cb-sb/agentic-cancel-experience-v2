import { create } from 'zustand'
import { STUDIO, TABBED, V8 } from '../layout/layoutMode'
import { LIBRARY, startFromTemplate, withLive } from '../journey/templates'
import {
  DEFAULT_JOURNEY_BRAND,
  EMPTY_JOURNEY,
  type JourneyBrand,
  type JourneyFile,
  type JourneyTemplate,
} from '../journey/types'
import { planIntro, v8Landing, type PlanBeat } from '../orchestration/JourneyPlan'
import { useCopilotThread, type CopilotLine, type PromptTurn } from '../orchestration/copilotThread'
import { applyDraftPayload, captureDraft, setDraftSink, type Draft } from '../store/draft'
import { useExperience } from '../store/useExperience'
import { resetHistoryBaseline, useHistory } from '../store/useHistory'
import { restoreJourney, useJourney } from '../store/useJourney'
import { useOrchestration } from '../store/useOrchestration'
import { useUpload } from '../upload/useUpload'
import { startPaneSync, whilePaused } from './paneTabs'
import { NO_TABS, useWorkspaceUi, type ThreadTabs } from './useWorkspaceUi'

/** Separate from the V5 draft key, so the two never overwrite each other. V7 and V8 tabs differ, so each keeps its own. */
const KEY = V8
  ? 'cancel-experience:workspace:v8'
  : STUDIO
    ? 'cancel-experience:workspace:v7'
    : 'cancel-experience:workspace:v1'

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

/** One Copilot conversation inside an experience. They all edit the same journey. */
export interface ChatThread {
  id: string
  updatedAt: number
  chat: ThreadChat
}

export interface ExperienceThread {
  id: string
  title: string
  updatedAt: number
  /** Seeded from a Chargebee template so the list isn't empty on first visit. */
  sample?: boolean
  /** Sample that hasn't been opened yet: built from this template on first open. */
  seed?: JourneyTemplate
  /** `snapshot.chat` mirrors the active chat. */
  snapshot?: ThreadSnapshot
  /** v7. Older threads have none and are read as one chat. */
  chats?: ChatThread[]
  activeChatId?: string
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

const EMPTY_CHAT: ThreadChat = { lines: [], turn: 'kind', beat: 'walk' }

/** Every chat of an experience, oldest first. A thread saved before chats existed reads as one. */
export function chatsOf(t: ExperienceThread): ChatThread[] {
  if (t.chats?.length) return t.chats
  return [{ id: `${t.id}-c0`, updatedAt: t.updatedAt, chat: t.snapshot?.chat ?? EMPTY_CHAT }]
}

export function activeChatOf(t: ExperienceThread): string {
  const chats = chatsOf(t)
  return chats.some((c) => c.id === t.activeChatId) ? t.activeChatId! : chats[chats.length - 1].id
}

/** The first thing the merchant asked, or "New chat". */
export function chatTitle(lines: CopilotLine[]): string {
  const first = lines.find((l) => l.from === 'you')?.text.trim()
  return first || 'New chat'
}

function isBlank(t: ExperienceThread): boolean {
  if (t.seed) return false
  if (!t.snapshot) return true
  return t.snapshot.journey.steps.length === 0 && chatsOf(t).every((c) => c.chat.lines.length === 0)
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
    ...storeChat(thread, snapshot.chat),
    ...(touched ? { updatedAt: Date.now(), sample: false } : {}),
  })
}

/** Write the open conversation back into its chat entry. */
function storeChat(thread: ExperienceThread, chat: ThreadChat): Pick<ExperienceThread, 'chats' | 'activeChatId'> {
  const activeChatId = activeChatOf(thread)
  const chats = chatsOf(thread).map((c) =>
    c.id === activeChatId
      ? { ...c, chat, updatedAt: c.chat.lines.length === chat.lines.length ? c.updatedAt : Date.now() }
      : c,
  )
  return { chats, activeChatId }
}

function loadChat(chat: ThreadChat) {
  useOrchestration.getState().setSpotlight(null)
  useCopilotThread.setState({ lines: chat.lines, turn: chat.turn, beat: chat.beat })
}

/** Open another conversation on the same experience. The journey and tabs stay as they are. */
export function switchChat(threadId: string, chatId: string) {
  const { activeId } = useWorkspace.getState()
  if (threadId !== activeId) {
    const target = useWorkspace.getState().threads.find((t) => t.id === threadId)
    if (target) patchThread(threadId, { activeChatId: chatId })
    switchThread(threadId)
    return
  }
  storeActive()
  const thread = useWorkspace.getState().threads.find((t) => t.id === activeId)
  const next = thread && chatsOf(thread).find((c) => c.id === chatId)
  if (!thread || !next || activeChatOf(thread) === chatId) return
  patchThread(activeId, { activeChatId: chatId, snapshot: thread.snapshot && { ...thread.snapshot, chat: next.chat } })
  loadChat(next.chat)
  persist()
}

/** A fresh conversation on this experience. Nothing to do while the open chat is still empty. */
export function newChat(threadId?: string) {
  const { activeId } = useWorkspace.getState()
  if (threadId && threadId !== activeId) switchThread(threadId)
  if (useCopilotThread.getState().lines.length === 0) return
  storeActive()
  const id = useWorkspace.getState().activeId
  const thread = useWorkspace.getState().threads.find((t) => t.id === id)
  if (!thread) return
  const chat: ThreadChat = {
    lines: [],
    turn: useJourney.getState().file.steps.length > 0 ? 'done' : 'kind',
    beat: 'walk',
  }
  const entry: ChatThread = { id: newId(), updatedAt: Date.now(), chat }
  patchThread(id, {
    chats: [...chatsOf(thread), entry],
    activeChatId: entry.id,
    snapshot: thread.snapshot && { ...thread.snapshot, chat },
  })
  loadChat(chat)
  persist()
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
  if (V8) {
    const landing = v8Landing(live)
    chat.say('bot', landing.text)
    chat.setTurn('plan')
    chat.setBeat(landing.beat)
  } else {
    chat.say('bot', planIntro(live), { widget: 'plan' })
    chat.setTurn('plan')
    chat.setBeat('walk')
  }
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
  const fromTab = TABBED && (tabs.active === 'editor' || tabs.active === 'canvas') ? tabs.active : null
  const surface = fromTab ?? (s.surface === 'canvas' ? 'canvas' : 'editor')
  useOrchestration.setState({
    stepStripShown: s.journey.steps.length > 0,
    workSurface: surface,
  })
  if (TABBED && tabs.active === 'preview') useExperience.getState().setMode('play')
}

function openThread(id: string) {
  whilePaused(() => openThreadNow(id))
}

function openThreadNow(id: string) {
  const thread = useWorkspace.getState().threads.find((t) => t.id === id)
  if (!thread) return
  prepStores()
  if (thread.snapshot) {
    openSnapshot(thread.snapshot)
    const id = activeChatOf(thread)
    const chat = thread.chats?.find((c) => c.id === id)?.chat
    if (chat) loadChat(chat)
  } else if (thread.seed) openSample(thread.seed)
  else openBlank()
  const snap = thread.snapshot
  useOrchestration.setState({
    savedAt: snap && snap.savedAt ? snap.savedAt : null,
    dirty: snap ? snap.dirty : false,
    installConnected: STUDIO || useWorkspace.getState().installConnected,
  })
  useWorkspaceUi.setState({ paneHidden: false, previewAs: '' })
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
  if (isEmptyNow()) {
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

function isEmptyNow(): boolean {
  return useJourney.getState().file.steps.length === 0 && useCopilotThread.getState().lines.length === 0
}

/** Templates start a new experience, unless the open one is still empty. */
export function openTemplatePicker(tab: 'ours' | 'yours' = 'ours') {
  if (!isEmptyNow()) newThread()
  useOrchestration.getState().openTemplates(tab)
}

export function startFromLibrary(id: Exclude<JourneyTemplate, 'none'>) {
  if (!isEmptyNow()) newThread()
  useOrchestration.getState().applyLibraryTemplate(id)
}

/** v8: upload runs as its own page in a new experience, unless the open one is still empty. */
export function startUploadPage() {
  if (!isEmptyNow()) newThread()
  useOrchestration.getState().closeTemplates()
  useWorkspaceUi.getState().setPage('thread')
  useUpload.getState().open()
}

export function startFromSaved(id: string) {
  if (!isEmptyNow()) newThread()
  useOrchestration.getState().applyMerchantTemplate(id)
}

/** Live when its play is published. The open thread reads the live store. */
export function threadIsLive(thread: ExperienceThread, activeId: string, activeLive: boolean): boolean {
  if (thread.id === activeId) return activeLive
  return thread.snapshot?.play.publishState === 'live'
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
        chats: undefined,
        activeChatId: undefined,
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
