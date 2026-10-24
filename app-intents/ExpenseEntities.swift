import AppIntents

/// A category the user actually has in their ledger.
///
/// Mirrors `getUserCategories` in store/useExpenseStore.ts: only the system
/// categories are hidden, by id. Names are never inspected, so every category the
/// user adds in Settings shows up here. Keep `systemCategoryIds` in sync with
/// `SYSTEM_CATEGORY_IDS` (plus `cat_cig`) in that file.
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
  "cat_goal",
  "cat_vault",
  "cat_cig",
]

private func isUserExpenseCategory(_ raw: [String: Any]) -> Bool {
  let id = string(raw["id"])
  let name = string(raw["name"]).trimmingCharacters(in: .whitespacesAndNewlines)
  return !id.isEmpty && !name.isEmpty && !systemCategoryIds.contains(id)
}

@available(iOS 16.0, *)
private let defaultCategories: [ExpenseCategoryEntity] = [
  ExpenseCategoryEntity(id: "cat_food", name: "Food"),
  ExpenseCategoryEntity(id: "cat_shop", name: "Shopping"),
  ExpenseCategoryEntity(id: "cat_trans", name: "Transport"),
  ExpenseCategoryEntity(id: "cat_subs", name: "Subscription"),
  ExpenseCategoryEntity(id: "cat_ent", name: "Entertainment"),
  ExpenseCategoryEntity(id: "cat_health", name: "Health"),
  ExpenseCategoryEntity(id: "cat_fin", name: "Finance"),
  ExpenseCategoryEntity(id: "cat_util", name: "Utilities"),
  ExpenseCategoryEntity(id: "cat_misc", name: "Misc"),
  ExpenseCategoryEntity(id: "cat_other", name: "Other"),
]

@available(iOS 16.0, *)
private let defaultAccounts: [ExpenseAccountEntity] = [
  ExpenseAccountEntity(id: "acc_cash", name: "Cash", kind: "cash"),
  ExpenseAccountEntity(id: "acc_bank", name: "Bank Account", kind: "bank"),
  ExpenseAccountEntity(id: "acc_card", name: "Credit Card", kind: "credit"),
]

/// The user's categories in Settings order. The built-in list is used only when
/// no categories could be read at all (app never run, or the file is unreadable);
/// a readable store whose categories are all hidden yields an empty list.
@available(iOS 16.0, *)
private func userCategoryEntities() -> [ExpenseCategoryEntity] {
  guard let snapshot = ExpenseStore.load(), !snapshot.categories.isEmpty else {
    return defaultCategories
  }
  return snapshot.categories
    .filter { isUserExpenseCategory($0) }
    .map { ExpenseCategoryEntity(id: string($0["id"]), name: string($0["name"])) }
}

@available(iOS 16.0, *)
struct ExpenseCategoryQuery: EntityStringQuery {

  func entities(for identifiers: [ExpenseCategoryEntity.ID]) async throws -> [ExpenseCategoryEntity] {
    userCategoryEntities().filter { identifiers.contains($0.id) }
  }

  func suggestedEntities() async throws -> [ExpenseCategoryEntity] {
    userCategoryEntities()
  }

  func entities(matching query: String) async throws -> [ExpenseCategoryEntity] {
    let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    let list = userCategoryEntities()
    guard !needle.isEmpty else { return list }
    return list.filter { $0.name.lowercased().contains(needle) }
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
    let mapped = all
      .filter { identifiers.contains(string($0["id"])) }
      .map { account(from: $0) }
    return mapped.isEmpty ? defaultAccounts.filter { identifiers.contains($0.id) } : mapped
  }

  func suggestedEntities() async throws -> [ExpenseAccountEntity] {
    let fromStore = (ExpenseStore.load()?.accounts ?? [])
      .filter { !(($0["isArchived"] as? Bool) ?? false) }
      .map { account(from: $0) }
    return fromStore.isEmpty ? defaultAccounts : fromStore
  }

  func entities(matching query: String) async throws -> [ExpenseAccountEntity] {
    let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    let fromStore = (ExpenseStore.load()?.accounts ?? [])
      .filter { !(($0["isArchived"] as? Bool) ?? false) }
      .map { account(from: $0) }
    let list = fromStore.isEmpty ? defaultAccounts : fromStore
    guard !needle.isEmpty else { return list }
    return list.filter { $0.name.lowercased().contains(needle) }
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
