import { V8 } from '../layout/layoutMode'
import './dls.css'

/** The Sting skin is V8 only; `?skin=classic` shows the previous look for comparison. */
if (V8 && new URLSearchParams(window.location.search).get('skin') !== 'classic') {
  document.documentElement.dataset.skin = 'dls'
}
