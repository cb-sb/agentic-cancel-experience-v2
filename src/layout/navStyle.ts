import './slgNav.css'

/** Classes for a left-nav row: dark when it's where you are, tinted when you're somewhere inside it. */
export function navItem(current?: boolean, section?: boolean): string {
  return `slg-nav-item${current ? ' is-current' : section ? ' is-section' : ''}`
}
