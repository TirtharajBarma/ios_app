/**
 * Tab Tracker service to coordinate scroll positions across tab navigation.
 *
 * Ensures that tabs only reset their scroll position to top when actively
 * switching tabs from another tab, but PRESERVE their scroll position when
 * navigating into a sub-screen / modal (e.g. Subscription Detail, Add Subscription,
 * Budget Settings) and returning.
 */

let activeTabName: string = '';

export function handleTabFocus(tabName: string, onTabSwitched?: () => void): void {
  if (activeTabName !== tabName) {
    activeTabName = tabName;
    if (onTabSwitched) {
      onTabSwitched();
    }
  }
}

export function getActiveTabName(): string {
  return activeTabName;
}
