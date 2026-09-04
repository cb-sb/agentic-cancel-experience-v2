/**
 * Mirror of the dev-only handle in `src/orchestration/flow/testHook.tsx`.
 *
 * Ambient rather than imported: it is types only, so the audit scripts stay
 * runnable by `node --experimental-strip-types` with no resolution step, and
 * neither script can drift from the other's idea of the hook.
 */
interface CanvasHook {
  zoom: () => number
  setZoom: (z: number) => void
  fit: () => void
  focusStep: (index: number) => void
  toggleCollapse: () => void
  mappingExpected: () => number
  stepCount: () => number
  setFocusPresentation: (presentation: 'overlay' | 'drawer') => void
  setDevice: (device: 'desktop' | 'tablet' | 'mobile') => void
  setAssistantOpen: (open: boolean) => void
  setSplitMode: (mode: 'single' | 'percent' | 'audience') => void
}

interface Window {
  __canvas?: CanvasHook
}
