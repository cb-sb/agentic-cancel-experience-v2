import { uid } from '../lib/id'
import { hashFiles } from './hash'
import { writeZip } from './pack'
import type { TemplateArtifact, TemplateArtifactFile } from './types'
import sharedCss from './sample/shared.css?raw'
import singleHtml from './sample/single.html?raw'
import valueHtml from './sample/value.html?raw'
import surveyHtml from './sample/survey.html?raw'
import offerHtml from './sample/offer.html?raw'
import confirmHtml from './sample/confirm.html?raw'

function artifact(files: TemplateArtifactFile[]): TemplateArtifact {
  return {
    id: uid('art'),
    checksum: hashFiles(files),
    version: 1,
    files,
  }
}

/** One HTML+CSS document with four `[data-cb-step]` sections. */
export function sampleSingleArtifact(): TemplateArtifact {
  return artifact([{ path: 'cancel.html', html: singleHtml, css: sharedCss }])
}

const ZIP_PAGES: { path: string; html: string }[] = [
  { path: 'value.html', html: valueHtml },
  { path: 'survey.html', html: surveyHtml },
  { path: 'offer.html', html: offerHtml },
  { path: 'confirm.html', html: confirmHtml },
]

/** Zip of static pages that link with `data-cb-next` / `data-cb-action`. */
export function sampleZipArtifact(): TemplateArtifact {
  return artifact(ZIP_PAGES.map((p) => ({ path: p.path, html: p.html, css: sharedCss })))
}

export function sampleZipBytes(): Uint8Array {
  const encoder = new TextEncoder()
  return writeZip([
    { path: 'shared.css', bytes: encoder.encode(sharedCss) },
    ...ZIP_PAGES.map((p) => ({ path: p.path, bytes: encoder.encode(p.html) })),
  ])
}

export const SAMPLE_SINGLE_NAME = 'growth-starter.html'
export const SAMPLE_ZIP_NAME = 'growth-starter.zip'
