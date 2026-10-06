import { V8, V9 } from '../layout/layoutMode'
import './dls.css'
import './slg-tokens.css'
import './slg.css'

/**
 * V9 wears the SLG skin and V8 the Sting skin. `?skin=dls`, `?skin=slg` or
 * `?skin=classic` shows another look for comparison.
 */
if (V8) {
  const asked = new URLSearchParams(window.location.search).get('skin')
  const skin = asked === 'classic' || asked === 'dls' || asked === 'slg' ? asked : V9 ? 'slg' : 'dls'
  if (skin !== 'classic') document.documentElement.dataset.skin = skin
}
