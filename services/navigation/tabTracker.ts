/**
 * Tab Tracker service to coordinate scroll positions across tab navigation.
 *
 * Switching between tabs preserves the scroll position of each tab, aligning
 * with Apple HIG and Android Material Design standards. Native scroll-to-top
 * when tapping the already active tab is handled natively via useScrollToTop.
 */

let activeTabName: string = '';

export function handleTabFocus(tabName: string, onTabSwitched?: () => void): void {
  if (activeTabName !== tabName) {
    activeTabName = tabName;
    // Per Apple HIG and Material Design guidelines, switching between tabs
    // preserves each tab's scroll position rather than forcing an abrupt
    // un-animated scroll jump to offset 0 during the screen transition.
    // Tapping the currently active tab to scroll to top is handled natively
    // by useScrollToTop(scrollRef).
  }
}

export function getActiveTabName(): string {
  return activeTabName;
}
