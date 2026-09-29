import AppIntents

/// Publishes a "Quick Add Expense" shortcut into the Shortcuts app.
///
/// This is what creates the shortcut tile: after the Shortcuts app has indexed
/// the build, "Quick Add Expense" shows up as a ready-made action you can run,
/// rename, or attach to a Back Tap automation. The shortcut carries the
/// `AddExpenseIntent` from `AddExpenseIntent.swift`, so it prompts for the
/// amount, category and account and saves without opening the app.
@available(iOS 16.0, *)
struct SubscriptionAppShortcuts: AppShortcutsProvider {

  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: AddExpenseIntent(),
      phrases: [
        "Add an expense in \(.applicationName)",
        "Log an expense in \(.applicationName)",
        "Quick add expense in \(.applicationName)",
      ],
      shortTitle: "Add Expense",
      systemImageName: "plus.circle.fill"
    )
  }
}
