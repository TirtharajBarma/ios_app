import AppIntents

/// A category the user actually has in their ledger.
///
/// Filters out system categories (income, split returns, debt repayment) and
/// hidden categories so only active user expense categories appear in Siri and Shortcuts.
@available(iOS 16.0, *)
struct ExpenseCategoryEntity: AppEntity, Identifiable {
  static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Expense Category")
  static var defaultQuery = ExpenseCategoryQuery()

  let id: String
  let name: String

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(name)")
  }
}

private let systemCategoryIds: Set<String> = [
  "cat_split_return",
  "cat_debt_repayment",
  "cat_income",
  "cat_cig",
]

private func isUserExpenseCategory(_ raw: [String: Any]) -> Bool {
  let id = string(raw["id"])
  let name = string(raw["name"]).trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
  if systemCategoryIds.contains(id) { return false }
  if name == "income" || name == "split received" || name == "debt repayment" || name.contains("cigarette") {
    return false
  }
  return !id.isEmpty && !name.isEmpty
}

@available(iOS 16.0, *)
struct ExpenseCategoryQuery: EntityStringQuery {

  func entities(for identifiers: [ExpenseCategoryEntity.ID]) async throws -> [ExpenseCategoryEntity] {
    let all = (ExpenseStore.load()?.categories ?? []).filter { isUserExpenseCategory($0) }
    return all
      .filter { identifiers.contains(string($0["id"])) }
      .map { ExpenseCategoryEntity(id: string($0["id"]), name: string($0["name"])) }
  }

  func suggestedEntities() async throws -> [ExpenseCategoryEntity] {
    (ExpenseStore.load()?.categories ?? [])
      .filter { isUserExpenseCategory($0) }
      .map { ExpenseCategoryEntity(id: string($0["id"]), name: string($0["name"])) }
  }

  func entities(matching query: String) async throws -> [ExpenseCategoryEntity] {
    let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    let filtered = (ExpenseStore.load()?.categories ?? []).filter { isUserExpenseCategory($0) }
    guard !needle.isEmpty else {
      return filtered.map { ExpenseCategoryEntity(id: string($0["id"]), name: string($0["name"])) }
    }
    return filtered
      .map { ExpenseCategoryEntity(id: string($0["id"]), name: string($0["name"])) }
      .filter { $0.name.lowercased().contains(needle) }
  }
}

@available(iOS 16.0, *)
struct ExpenseAccountEntity: AppEntity, Identifiable {
  static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Account")
  static var defaultQuery = ExpenseAccountQuery()

  let id: String
  let name: String
  let kind: String

  var displayRepresentation: DisplayRepresentation {
    let suffix = kind == "credit" ? " (credit)" : ""
    return DisplayRepresentation(title: "\(name)\(suffix)")
  }
}

@available(iOS 16.0, *)
struct ExpenseAccountQuery: EntityStringQuery {

  func entities(for identifiers: [ExpenseAccountEntity.ID]) async throws -> [ExpenseAccountEntity] {
    let all = (ExpenseStore.load()?.accounts ?? []).filter { !(($0["isArchived"] as? Bool) ?? false) }
    return all
      .filter { identifiers.contains(string($0["id"])) }
      .map { account(from: $0) }
  }

  func suggestedEntities() async throws -> [ExpenseAccountEntity] {
    (ExpenseStore.load()?.accounts ?? [])
      .filter { !(($0["isArchived"] as? Bool) ?? false) }
      .map { account(from: $0) }
  }

  func entities(matching query: String) async throws -> [ExpenseAccountEntity] {
    let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    let all = (ExpenseStore.load()?.accounts ?? [])
      .filter { !(($0["isArchived"] as? Bool) ?? false) }
      .map { account(from: $0) }
    guard !needle.isEmpty else { return all }
    return all.filter { $0.name.lowercased().contains(needle) }
  }

  private func account(from raw: [String: Any]) -> ExpenseAccountEntity {
    let type = string(raw["type"])
    return ExpenseAccountEntity(
      id: string(raw["id"]),
      name: string(raw["name"]),
      kind: type.isEmpty ? "debit" : type
    )
  }
}

private func string(_ value: Any?) -> String {
  (value as? String) ?? ""
}
