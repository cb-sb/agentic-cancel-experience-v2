import { useCallback, useEffect, useMemo, useRef } from 'react'
import { OFFER_VARIANTS } from '../lib/offerVariants'
import type { PlaySession } from '../store/useExperience'
import { useExperience } from '../store/useExperience'
import type { TemplateArtifact, TemplateManifest, CbAction } from './types'
import { DEFAULT_SUBSCRIBER_CONTEXT, isCbAction, isOfferBind } from './types'
import { CB } from './contract'

function stripScripts(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
}

export function buildSrcdoc(html: string, css?: string): string {
  const cleaned = stripScripts(html)
  const style = css ? `<style>${css}</style>` : ''
  if (/<html/i.test(cleaned)) {
    if (/<head/i.test(cleaned)) return cleaned.replace(/<head([^>]*)>/i, `<head$1>${style}`)
    return cleaned.replace(/<html([^>]*)>/i, `<html$1><head>${style}</head>`)
  }
  return `<!doctype html><html><head><meta charset="utf-8">${style}</head><body>${cleaned}</body></html>`
}

export function htmlForStep(
  artifact: TemplateArtifact,
  step: TemplateManifest['steps'][number],
): { html: string; css?: string } {
  const file =
    artifact.files.find((f) => f.path === step.file) ??
    artifact.files.find((f) => /\.html?$/i.test(f.path)) ??
    artifact.files[0]
  if (!file) return { html: '<p>Missing template file.</p>' }
  const doc = new DOMParser().parseFromString(file.html, 'text/html')
  const section = doc.querySelector(`[${CB.step}="${step.id}"]`)
  if (section) {
    const styles = [...doc.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n')
    return { html: section.outerHTML, css: [file.css, styles].filter(Boolean).join('\n') || undefined }
  }
  return { html: file.html, css: file.css }
}

function outcomeCopy(result: PlaySession['result']): { html: string; css?: string } {
  const title = result === 'cancelled' ? 'Your plan has been cancelled' : 'You’re staying'
  const body =
    result === 'cancelled'
      ? 'Access continues through the end of the current term.'
      : 'Nothing changed. We’ll see you at renewal.'
  return {
    html: `<main class="page"><h1>${title}</h1><p class="lede">${body}</p><button type="button" class="btn btn-primary" data-cb-action="exit">Close</button></main>`,
  }
}

interface ArtifactPlayerProps {
  artifact: TemplateArtifact
  manifest: TemplateManifest
  interactive?: boolean
  /** Pin a step (canvas / focus). Defaults to the live session index. */
  stepId?: string
  className?: string
}

export function ArtifactPlayer({
  artifact,
  manifest,
  interactive = true,
  stepId,
  className,
}: ArtifactPlayerProps) {
  const session = useExperience((s) => s.session)
  const experience = useExperience((s) => s.experience)
  const store = useExperience()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const live = experience.steps.filter((s) => !s.disabled)
  const currentCompiled = live[Math.min(session.index, Math.max(live.length - 1, 0))]

  const manifestStep = useMemo(() => {
    if (session.result) {
      const want = session.result === 'cancelled' ? 'outcome_cancelled' : 'outcome_saved'
      return manifest.steps.find((s) => s.kind === want) ?? null
    }
    if (stepId) return manifest.steps.find((s) => s.id === stepId) ?? manifest.steps[0]
    return manifest.steps.find((s) => s.id === currentCompiled?.id) ?? manifest.steps[session.index] ?? manifest.steps[0]
  }, [manifest.steps, session.result, session.index, stepId, currentCompiled?.id])

  const pack = useMemo(() => {
    if (session.result && !manifestStep) {
      const fallback = outcomeCopy(session.result)
      return { html: fallback.html, css: artifact.files[0]?.css }
    }
    if (!manifestStep) return { html: '<p>No steps in this template.</p>' }
    return htmlForStep(artifact, manifestStep)
  }, [artifact, manifestStep, session.result])

  const srcdoc = useMemo(() => buildSrcdoc(pack.html, pack.css), [pack])

  const runAction = useCallback(
    (action: CbAction) => {
      if (!interactive) return
      const compiled = currentCompiled
      const offer = compiled?.components.find((c) => c.kind === 'offer')
      switch (action) {
        case 'continue':
          store.goNext()
          break
        case 'back':
          store.goBack()
          break
        case 'accept_offer':
          if (offer) store.acceptOffer(offer.id)
          break
        case 'decline_offer':
          store.declineOffer()
          break
        case 'keep':
          store.keepSubscription()
          break
        case 'cancel':
          store.confirmCancel()
          break
        case 'exit':
          store.resetSession()
          break
      }
    },
    [interactive, currentCompiled, store],
  )

  const hydrate = useCallback(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    const ctx = { ...DEFAULT_SUBSCRIBER_CONTEXT, ...manifest.subscriberContext }

    doc.querySelectorAll(`[${CB.field}]`).forEach((el) => {
      const name = el.getAttribute(CB.field)
      if (name && ctx[name] != null) el.textContent = ctx[name]
    })

    const offerSlot = manifestStep?.slots.find((s) => s.type === 'offer')
    const offerKey = offerSlot?.bind && isOfferBind(offerSlot.bind) ? offerSlot.bind : 'discount'
    const variant = OFFER_VARIANTS.find((v) => v.category === offerKey)
    if (variant) {
      doc.querySelectorAll(`[${CB.bind}]`).forEach((el) => {
        const bind = el.getAttribute(CB.bind)
        if (bind === 'title') el.textContent = variant.title
        if (bind === 'cta') el.textContent = variant.primaryCta
        if (bind === 'body') el.textContent = variant.description
        if (bind === 'eyebrow') el.textContent = variant.eyebrow
      })
    }

    const reasons = manifest.surveyReasons ?? []
    const radios = [...doc.querySelectorAll<HTMLInputElement>(`[${CB.slot}="survey"] input[type="radio"]`)]
    radios.forEach((input, i) => {
      const reason = reasons[i]
      if (reason) {
        input.value = reason.id
        const label = input.closest('label')
        if (label) {
          const text = [...label.childNodes].find((n) => n.nodeType === Node.TEXT_NODE)
          if (text) text.textContent = ` ${reason.label}`
        }
      }
      input.checked = session.selectedReasonId === input.value
    })

    if (doc.documentElement.dataset.cbHydrated === '1') return
    doc.documentElement.dataset.cbHydrated = '1'

    radios.forEach((input) => {
      if (interactive) {
        input.addEventListener('change', () => store.selectReason(input.value))
      } else {
        input.disabled = true
      }
    })

    doc.querySelectorAll(`[${CB.action}]`).forEach((el) => {
      const raw = el.getAttribute(CB.action) ?? ''
      if (!isCbAction(raw)) return
      el.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (interactive) runAction(raw)
      })
    })

    doc.querySelectorAll('a[href]').forEach((a) => {
      a.addEventListener('click', (e) => {
        if (a.hasAttribute(CB.action)) return
        e.preventDefault()
      })
    })
  }, [interactive, manifest, manifestStep, runAction, session.selectedReasonId, store])

  useEffect(() => {
    hydrate()
  }, [hydrate, srcdoc])

  return (
    <iframe
      key={`${manifestStep?.id ?? 'none'}:${session.result ?? 'open'}:${artifact.checksum}`}
      ref={iframeRef}
      title={manifestStep?.id ?? 'template'}
      srcDoc={srcdoc}
      onLoad={hydrate}
      className={className ?? 'h-full min-h-0 w-full border-0 bg-white'}
      style={{ pointerEvents: interactive ? undefined : 'none' }}
    />
  )
}
