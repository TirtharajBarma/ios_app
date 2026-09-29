import AppIntents

/// Records an expense in the ledger without opening the app.
///
/// The App Intent lives in the app target, so the write happens in the app's own
/// sandbox against the same AsyncStorage file the app uses. That is what makes
/// this work while the app is terminated and offline: there is no second
/// database and no dependency on React Native being alive.
@available(iOS 16.0, *)
struct AddExpenseIntent: AppIntent {

  static var title: LocalizedStringResource = "Add Expense"
  static var description = IntentDescription(
    "Record an expense in your ledger, even when the app is closed.")
  /// Do not bring the app to the foreground — just save and confirm.
  static var openAppWhenRun = false

  @Parameter(title: "Amount", requestValueDialog: "How much was it?")
  var amount: Double

  @Parameter(title: "Category")
  var category: ExpenseCategoryEntity

  @Parameter(title: "Account")
  var account: ExpenseAccountEntity

  @Parameter(title: "Note", default: nil)
  var note: String?

  /// Optional idempotency key. Supply the same value twice and the second run
  /// is ignored. Left out of the parameter summary so it never shows up in the
  /// Shortcuts sheet — it is only there for callers that want true
  /// exactly-once semantics.
  @Parameter(title: "Operation ID", default: nil)
  var opId: String?

  static var parameterSummary: some ParameterSummary {
    Summary("Add \(\.$amount) to \(\.$category) from \(\.$account)")
  }

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard amount.isFinite, amount > 0 else {
      return .result(dialog: "Enter an amount greater than zero.")
    }

    let resolvedOpId =
      (opId?.trimmingCharacters(in: .whitespacesAndNewlines)).flatMap { $0.isEmpty ? nil : $0 }
      ?? UUID().uuidString.lowercased()
    let transactionId = "tx_ia_\(resolvedOpId)"

    let date = ExpenseStore.currentDateKey()
    let trimmedNote = note?.trimmingCharacters(in: .whitespacesAndNewlines)

    let saved = ExpenseStore.addExpense(
      opId: resolvedOpId,
      transactionId: transactionId,
      amount: amount,
      categoryId: category.id,
      accountId: account.id,
      note: trimmedNote,
      date: date
    )

    guard saved else {
      return .result(dialog: "Could not save that expense. Open the app and try again.")
    }

    // Durable outbox: replayed and acknowledged on the next foreground so a
    // stale in-memory snapshot can never undo a save the user already saw.
    var entry: [String: Any] = [
      "opId": resolvedOpId,
      "transactionId": transactionId,
      "amount": amount,
      "categoryId": category.id,
      "accountId": account.id,
      "date": date,
    ]
    if let trimmedNote, !trimmedNote.isEmpty { entry["note"] = trimmedNote }
    ExpenseOpsLog.record(entry)

    let formatted = AmountFormatting.string(for: amount)
    if let trimmedNote, !trimmedNote.isEmpty {
      return .result(dialog: "Saved \(formatted) for \(category.name) on \(account.name) — \(trimmedNote)")
    }
    return .result(dialog: "Saved \(formatted) for \(category.name) on \(account.name)")
  }
}

/// Rounds to two decimals without turning whole amounts into `12.00`.
enum AmountFormatting {
  static func string(for amount: Double) -> String {
    if amount == amount.rounded() && abs(amount) < 1e15 {
      return String(Int(amount.rounded()))
    }
    return String(format: "%.2f", amount)
  }
}
