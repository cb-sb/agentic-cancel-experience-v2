import './slgNav.css'

/** Classes for a nav row: dark at the current page, warm when a child is current. */
export function navItem(current?: boolean, section?: boolean): string {
  return `slg-nav-item${current ? ' is-current' : section ? ' is-section' : ''}`
}
