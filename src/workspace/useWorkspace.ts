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
import { nameProblem, uniqueName } from '../plays/names'
import { dropExperience, initPlays, playsUsing } from '../plays/usePlays'
import { startPaneSync, whilePaused } from './paneTabs'
import { useCancelSettings } from './useCancelSettings'
import { activeKind, normalizeTabs, NO_TABS, singleTab, useWorkspaceUi, type ThreadTabs } from './useWorkspaceUi'

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
  /** v8: the merchant named it, so the title no longer follows the template. */
  named?: boolean
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
  /** v9: when it was put in the archive. */
  archivedAt?: number
}

interface WorkspaceState {
  threads: ExperienceThread[]
  /** v9: put away. Out of every play and list, until brought back. */
  archived: ExperienceThread[]
  activeId: string
  /** Look new experiences start from. Follows the last brand set in any experience. */
  brand: JourneyBrand | null
  installConnected: boolean
}

export const useWorkspace = create<WorkspaceState>(() => ({
  threads: [],
  archived: [],
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

/** v8 names are unique, so an auto title gets a number when another experience already has it. */
function autoTitle(threadId: string, file: JourneyFile): string {
  const thread = useWorkspace.getState().threads.find((t) => t.id === threadId)
  if (thread?.named) return thread.title
  const base = titleFor(file)
  if (!V8) return base
  return uniqueName(base, experienceNames(threadId))
}

export function experienceNames(exceptId?: string): string[] {
  return useWorkspace
    .getState()
    .threads.filter((t) => t.id !== exceptId)
    .map((t) => t.title)
}

function isBlank(t: ExperienceThread): boolean {
  if (V8 && playsUsing(t.id).length > 0) return false
  if (t.seed) return false
  if (!t.snapshot) return true
  return t.snapshot.journey.steps.length === 0 && chatsOf(t).every((c) => c.chat.lines.length === 0)
}

function persist(): boolean {
  const { threads, archived, activeId, brand, installConnected } = useWorkspace.getState()
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, threads, archived, activeId, brand, installConnected }))
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
      archived: Array.isArray(parsed.archived) ? parsed.archived : [],
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
  return { threads: [blank, ...samples], archived: [], activeId: blank.id, brand: null, installConnected: false }
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
    title: autoTitle(activeId, snapshot.journey),
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
  useCopilotThread.setState({ lines: chat.lines, turn: chat.turn, beat: chat.beat, setupItem: null })
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
  useWorkspaceUi.setState({ tabs: singleTab('editor') })
}

function openSnapshot(s: ThreadSnapshot) {
  applyDraftPayload(s)
  useHistory.getState().hydrate(Array.isArray(s.history) ? s.history : [])
  useCopilotThread.setState({ lines: s.chat.lines, turn: s.chat.turn, beat: s.chat.beat, setupItem: null })
  const tabs = normalizeTabs(s.tabs)
  useWorkspaceUi.setState({ tabs })
  const kind = activeKind(tabs)
  const fromTab = TABBED && (kind === 'editor' || kind === 'canvas') ? kind : null
  const surface = fromTab ?? (s.surface === 'canvas' ? 'canvas' : 'editor')
  useOrchestration.setState({
    stepStripShown: s.journey.steps.length > 0,
    workSurface: surface,
  })
  if (TABBED && kind === 'preview') useExperience.getState().setMode('play')
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

/** `force` always makes a new one, even when the open experience is still empty. */
export function newThread(opts: { force?: boolean } = {}): string {
  if (isEmptyNow() && !opts.force && !(V8 && playsUsing(useWorkspace.getState().activeId).length > 0)) {
    useWorkspaceUi.setState({ search: '' })
    return useWorkspace.getState().activeId
  }
  storeActive()
  const stale = useWorkspace.getState().threads.filter((t) => t.id !== useWorkspace.getState().activeId && isBlank(t))
  if (stale.length) {
    const drop = new Set(stale.map((t) => t.id))
    useWorkspace.setState((s) => ({ threads: s.threads.filter((t) => !drop.has(t.id)) }))
  }
  const title = V8 ? uniqueName('New experience', experienceNames()) : 'New experience'
  const thread: ExperienceThread = { id: newId(), title, updatedAt: Date.now() }
  useWorkspace.setState((s) => ({ threads: [thread, ...s.threads], activeId: thread.id }))
  openThread(thread.id)
  persist()
  return thread.id
}

/** v8: null when the name is taken or empty, otherwise what went wrong. */
export function renameThread(id: string, name: string): string | null {
  const problem = nameProblem(name, experienceNames(id), 'experience')
  if (problem) return problem
  patchThread(id, { title: name.trim().replace(/\s+/g, ' '), named: true, updatedAt: Date.now() })
  persist()
  return null
}

/**
 * v8: an independent copy with its own journey. It never shares edits with the
 * original, so it has to carry a different name.
 */
export function duplicateThread(id: string, name?: string): string | null {
  const { activeId } = useWorkspace.getState()
  if (id === activeId) storeActive()
  const src = useWorkspace.getState().threads.find((t) => t.id === id)
  if (!src) return null
  const title = name && !nameProblem(name, experienceNames(), 'experience') ? name.trim() : uniqueName(`${src.title} copy`, experienceNames())
  const note: CopilotLine = {
    id: `${Date.now()}-copy`,
    from: 'bot',
    text: `This is a copy of ${src.title}. Changes here stay in this copy.`,
  }
  const hasSteps = Boolean(src.snapshot?.journey.steps.length) || Boolean(src.seed)
  const chat: ThreadChat = { lines: [note], turn: hasSteps ? 'done' : 'kind', beat: 'walk' }
  const snapshot: ThreadSnapshot | undefined = src.snapshot && {
    ...(JSON.parse(JSON.stringify(src.snapshot)) as ThreadSnapshot),
    dirty: false,
    chat,
    tabs: singleTab('editor'),
  }
  if (snapshot) snapshot.play = { ...snapshot.play, publishState: 'draft' }
  const chatId = newId()
  const copy: ExperienceThread = {
    id: newId(),
    title,
    named: true,
    updatedAt: Date.now(),
    seed: snapshot ? undefined : src.seed,
    snapshot,
    chats: snapshot ? [{ id: chatId, updatedAt: Date.now(), chat }] : undefined,
    activeChatId: snapshot ? chatId : undefined,
  }
  useWorkspace.setState((s) => {
    const at = s.threads.findIndex((t) => t.id === id)
    return { threads: [...s.threads.slice(0, at + 1), copy, ...s.threads.slice(at + 1)] }
  })
  persist()
  return copy.id
}

/** v8: removes the experience everywhere, including from every play it sat in. */
export function deleteThread(id: string) {
  const { threads, activeId } = useWorkspace.getState()
  if (!threads.some((t) => t.id === id)) return
  dropExperience(id)
  const { globalFallbackId, setGlobalFallback } = useCancelSettings.getState()
  if (globalFallbackId === id) setGlobalFallback(null)
  const rest = threads.filter((t) => t.id !== id)
  if (id !== activeId) {
    useWorkspace.setState({ threads: rest })
    persist()
    return
  }
  const next = orderedThreads(rest)[0]
  if (next) {
    useWorkspace.setState({ threads: rest, activeId: next.id })
    openThread(next.id)
  } else {
    const blank: ExperienceThread = { id: newId(), title: 'New experience', updatedAt: Date.now() }
    useWorkspace.setState({ threads: [blank], activeId: blank.id })
    openThread(blank.id)
  }
  persist()
}

/** v9: takes it out of every play it sat in, like delete, but it can come back. */
export function archiveThread(id: string) {
  const { threads, activeId } = useWorkspace.getState()
  if (!threads.some((t) => t.id === id)) return
  if (id === activeId) storeActive()
  const thread = useWorkspace.getState().threads.find((t) => t.id === id)!
  dropExperience(id)
  const { globalFallbackId, setGlobalFallback } = useCancelSettings.getState()
  if (globalFallbackId === id) setGlobalFallback(null)
  const rest = useWorkspace.getState().threads.filter((t) => t.id !== id)
  const archived = [{ ...thread, archivedAt: Date.now(), snapshot: thread.snapshot && { ...thread.snapshot, play: { ...thread.snapshot.play, publishState: 'draft' as const } } }, ...useWorkspace.getState().archived]
  if (id !== activeId) {
    useWorkspace.setState({ threads: rest, archived })
    persist()
    return
  }
  const next = orderedThreads(rest)[0]
  if (next) {
    useWorkspace.setState({ threads: rest, archived, activeId: next.id })
    openThread(next.id)
  } else {
    const blank: ExperienceThread = { id: newId(), title: 'New experience', updatedAt: Date.now() }
    useWorkspace.setState({ threads: [blank], archived, activeId: blank.id })
    openThread(blank.id)
  }
  persist()
}

/** Back in the list, in no play. Takes a number when another experience has its name now. */
export function unarchiveThread(id: string) {
  const { threads, archived } = useWorkspace.getState()
  const thread = archived.find((t) => t.id === id)
  if (!thread) return
  const title = uniqueName(thread.title, threads.map((t) => t.title))
  useWorkspace.setState({ threads: [{ ...thread, title, archivedAt: undefined }, ...threads], archived: archived.filter((t) => t.id !== id) })
  persist()
}

export function deleteArchivedThread(id: string) {
  useWorkspace.setState({ archived: useWorkspace.getState().archived.filter((t) => t.id !== id) })
  persist()
}

/** The journey behind any experience, open or not. Samples never opened are built from their template. */
export function fileOfThread(t: ExperienceThread): JourneyFile {
  const { activeId } = useWorkspace.getState()
  if (t.id === activeId) return useJourney.getState().file
  if (t.snapshot) return t.snapshot.journey
  if (t.seed) {
    const cached = seedFiles.get(t.seed)
    if (cached) return cached
    const file = startFromTemplate({ ...EMPTY_JOURNEY, brand: blankBrand() }, t.seed)
    const live = { ...file, steps: withLive(file.steps, true) }
    seedFiles.set(t.seed, live)
    return live
  }
  return EMPTY_JOURNEY
}

const seedFiles = new Map<JourneyTemplate, JourneyFile>()

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
    const title = autoTitle(activeId, s.file)
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
  const saved = read()
  useWorkspace.setState(saved ?? seedWorkspace())
  if (V8) {
    const seen: string[] = []
    useWorkspace.setState((s) => ({
      threads: s.threads.map((t) => {
        const title = uniqueName(t.title, seen)
        seen.push(title)
        return title === t.title ? t : { ...t, title }
      }),
    }))
    initPlays(
      useWorkspace.getState().threads.map((t) => ({
        id: t.id,
        title: t.title,
        seed: t.seed,
        blank: isBlank(t),
        audience: t.snapshot?.play.audience,
        live: t.snapshot?.play.publishState === 'live',
      })),
      !saved,
    )
  }
  openThread(useWorkspace.getState().activeId)
  persist()
  watchActiveThread()
  startPaneSync()
}

// Filled once at boot, so a hot swap leaves an empty store whose next save would overwrite the saved copy.
import.meta.hot?.dispose(() => window.location.reload())
