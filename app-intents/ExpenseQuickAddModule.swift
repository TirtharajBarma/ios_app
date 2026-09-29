// `internal import` must match the access level the generated
// `ExpoModulesProvider.swift` uses, otherwise Swift rejects the target with
// "ambiguous implicit access level for import of 'ExpoModulesCore'". The
// provider is an `internal class` in this same target, so an internal module
// class is all it needs.
internal import ExpoModulesCore

/// Bridges the native outbox to JS so the app can reconcile quick adds that were
/// saved while it was terminated.
///
/// Every function returns a JSON string: record conversions between Swift and JS
/// are the fragile part of the bridge, and a string is the one shape that always
/// survives the round trip.
internal class ExpenseQuickAddModule: Module {

  func definition() -> ModuleDefinition {
    Name("ExpenseQuickAdd")

    AsyncFunction("getPendingQuickAddsAsync") { () -> String in
      self.encode(ExpenseOpsLog.pending())
    }

    AsyncFunction("ackQuickAddAsync") { (opId: String) in
      ExpenseOpsLog.acknowledge(opId: opId)
    }

    AsyncFunction("setQuickAddTransactionIdAsync") { (opId: String, transactionId: String) in
      ExpenseOpsLog.updateTransactionId(opId: opId, transactionId: transactionId)
    }

    AsyncFunction("getExpenseSnapshotAsync") { () -> String in
      let snapshot = ExpenseStore.load()
      let categories = (snapshot?.categories ?? []).map { entry -> [String: String] in
        [
          "id": (entry["id"] as? String) ?? "",
          "name": (entry["name"] as? String) ?? "",
        ]
      }
      let accounts = (snapshot?.accounts ?? []).map { entry -> [String: String] in
        [
          "id": (entry["id"] as? String) ?? "",
          "name": (entry["name"] as? String) ?? "",
          "type": (entry["type"] as? String) ?? "debit",
        ]
      }
      return self.encode(["categories": categories, "accounts": accounts])
    }

    AsyncFunction("syncShortcutsParametersAsync") { () in
      if #available(iOS 16.0, *) {
        SubscriptionAppShortcuts.updateAppShortcutParameters()
      }
    }
  }

  private func encode(_ value: Any) -> String {
    guard
      JSONSerialization.isValidJSONObject(value),
      let data = try? JSONSerialization.data(withJSONObject: value),
      let text = String(data: data, encoding: .utf8)
    else { return "null" }
    return text
  }
}
