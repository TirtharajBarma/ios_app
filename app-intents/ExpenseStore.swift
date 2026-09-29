import Foundation
import CommonCrypto

/// Native read/write access to the expense state that React Native persists in
/// AsyncStorage.
///
/// AsyncStorage stores the Zustand blob under a hashed file name and tracks it
/// in `manifest.json`. The persisted value is the string `{"state":…,"version":…}`
/// — a big blob is kept out of the manifest and written to its own file, with
/// the manifest entry set to `null`.
///
/// Everything here is deliberately written against that on-disk contract instead
/// of a second database, so an expense created by the App Intent is
/// indistinguishable from one created in the app.
enum ExpenseStore {

  // MARK: - Keys

  static let storageKey = "@expense_data_v1"
  static let legacyStorageKey = "@legacy_expense_v1"

  // MARK: - Concurrency

  /// Guards read-modify-write so the App Intent and the Expo module cannot
  /// interleave a write.
  private static let queue = DispatchQueue(label: "subscription.expense.store")

  // MARK: - Snapshot

  struct Snapshot {
    /// The full persisted envelope, including any fields we do not model.
    var envelope: [String: Any]
    /// `envelope["state"]`.
    var state: [String: Any]

    var transactions: [[String: Any]] {
      (state["transactions"] as? [[String: Any]]) ?? []
    }

    var accounts: [[String: Any]] {
      (state["accounts"] as? [[String: Any]]) ?? []
    }

    var categories: [[String: Any]] {
      (state["categories"] as? [[String: Any]]) ?? []
    }
  }

  // MARK: - Paths

  static var storageDirectory: URL {
    let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    let bundleId = Bundle.main.bundleIdentifier ?? "subscription"
    return base
      .appendingPathComponent(bundleId, isDirectory: true)
      .appendingPathComponent("RCTAsyncLocalStorage_V1", isDirectory: true)
  }

  static var manifestURL: URL {
    storageDirectory.appendingPathComponent("manifest.json")
  }

  static func valueURL(for key: String) -> URL {
    storageDirectory.appendingPathComponent(md5Hex(key))
  }

  // MARK: - Manifest

  static func readManifest() -> [String: Any] {
    guard
      let data = try? Data(contentsOf: manifestURL),
      let object = try? JSONSerialization.jsonObject(with: data),
      let manifest = object as? [String: Any]
    else { return [:] }
    return manifest
  }

  private static func writeManifest(_ manifest: [String: Any]) {
    try? FileManager.default.createDirectory(
      at: storageDirectory, withIntermediateDirectories: true)
    guard JSONSerialization.isValidJSONObject(manifest),
      let data = try? JSONSerialization.data(withJSONObject: manifest)
    else { return }
    // Best effort, mirroring the same directory AsyncStorage uses.
    try? data.write(to: manifestURL, options: .atomic)
  }

  // MARK: - Reading

  /// Returns the raw stored string for `key`, following AsyncStorage's
  /// manifest-indirection: an inline string, or the value file when the
  /// manifest holds `null`.
  private static func readRawValue(key: String, manifest: [String: Any]) -> String? {
    if let inline = manifest[key] as? String { return inline }
    if let data = try? Data(contentsOf: valueURL(for: key)),
      let text = String(data: data, encoding: .utf8) {
      return text
    }
    return nil
  }

  private static func readEnvelope(key: String) -> [String: Any]? {
    guard
      let raw = readRawValue(key: key, manifest: readManifest()),
      let data = raw.data(using: .utf8),
      let object = try? JSONSerialization.jsonObject(with: data),
      let envelope = object as? [String: Any]
    else { return nil }
    return envelope
  }

  /// Loads the current envelope, falling back to the legacy key the same way
  /// `utils/storage.ts` does.
  static func load() -> Snapshot? {
    var envelope = readEnvelope(key: storageKey) ?? readEnvelope(key: legacyStorageKey)
    if envelope == nil {
      // Nothing persisted yet: write an empty envelope so a later native write
      // has a manifest entry to work with.
      let fresh: [String: Any] = ["state": [String: Any](), "version": 0]
      store(envelope: fresh)
      envelope = fresh
    }
    guard let envelope else { return nil }
    let state = (envelope["state"] as? [String: Any]) ?? [String: Any]()
    return Snapshot(envelope: envelope, state: state)
  }

  // MARK: - Writing

  private static func store(envelope: [String: Any]) {
    guard
      JSONSerialization.isValidJSONObject(envelope),
      let data = try? JSONSerialization.data(withJSONObject: envelope)
    else { return }

    try? FileManager.default.createDirectory(
      at: storageDirectory, withIntermediateDirectories: true)

    // Value first, manifest second: a crash between the two leaves the previous
    // value readable, never a manifest entry pointing at nothing.
    try? data.write(to: valueURL(for: storageKey), options: .atomic)

    var manifest = readManifest()
    manifest[storageKey] = NSNull()
    writeManifest(manifest)
  }

  /// Runs `body` with a freshly loaded snapshot and persists whatever it
  /// returns. Nothing is written when `body` returns `nil`.
  ///
  /// `Snapshot` is a value type, so a plain copy is handed to `body`; that is
  /// what makes this atomic, since the mutated copy is only written back after
  /// `body` returns a value.
  @discardableResult
  static func mutate<T>(_ body: (inout Snapshot) -> T?) -> T? {
    queue.sync {
      guard var snapshot = load() else { return nil }
      guard let result = body(&snapshot) else { return nil }
      // `state` is a separate copy of the envelope's value, so a mutation to it
      // does not propagate back into `envelope` — re-attach it before writing.
      snapshot.envelope["state"] = snapshot.state
      store(envelope: snapshot.envelope)
      return result
    }
  }

  // MARK: - Derived values

  /// Local-time `yyyy-MM-dd`, matching `localISODate()` in the store.
  static func currentDateKey() -> String {
    let parts = Calendar.current.dateComponents([.year, .month, .day], from: Date())
    let year = parts.year ?? 1970
    let month = parts.month ?? 1
    let day = parts.day ?? 1
    return String(format: "%04d-%02d-%02d", year, month, day)
  }

  private static func double(_ value: Any?) -> Double {
    if let number = value as? NSNumber { return number.doubleValue }
    if let text = value as? String { return Double(text) ?? 0 }
    return 0
  }

  private static func string(_ value: Any?) -> String? {
    value as? String
  }

  private static func normalizedName(_ value: Any?) -> String {
    (value as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
  }

  /// Faithful port of `recomputeAllAccountsHelper` in `store/useExpenseStore.ts`.
  ///
  /// The subtleties that matter, and that a naive port gets wrong:
  /// - `expenseSum`/`incomeSum` are all-time; only `monthlyChange` and
  ///   `txnCountThisMonth` are restricted to the current month.
  /// - Name matching is trimmed and case-insensitive, and only counts when the
  ///   account actually has a name.
  /// - A transfer counts as an outgoing amount for the source and an incoming
  ///   amount for the destination, and the same is true of the debt and vault
  ///   types.
  /// - A non-credit account gets `dueAmount: undefined`, which `JSON.stringify`
  ///   drops from the persisted blob entirely.
  static func recomputeAccounts(
    accounts: [[String: Any]],
    transactions: [[String: Any]]
  ) -> [[String: Any]] {
    let now = Calendar.current.dateComponents([.year, .month], from: Date())
    let currentYear = now.year ?? 1970
    let currentMonth = (now.month ?? 1) - 1

    return accounts.map { original in
      var account = original
      let accountId = string(account["id"]) ?? ""
      let accountNameLower = normalizedName(account["name"])
      let isCredit = string(account["type"]) == "credit"

      var txnCountThisMonth = 0
      var monthlyChange: Double = 0
      var expenseSum: Double = 0
      var incomeSum: Double = 0

      for transaction in transactions {
        let fromId = string(transaction["accountId"]) ?? ""
        let toId = string(transaction["toAccountId"]) ?? ""
        let fromName = normalizedName(transaction["accountName"])
        let toName = normalizedName(transaction["toAccountName"])

        let isFrom =
          (!accountId.isEmpty && fromId == accountId)
          || (!accountNameLower.isEmpty && !fromName.isEmpty && fromName == accountNameLower)
        let isTo =
          (!accountId.isEmpty && toId == accountId)
          || (!accountNameLower.isEmpty && !toName.isEmpty && toName == accountNameLower)

        guard isFrom || isTo else { continue }

        let inCurrentMonth = isInMonth(string(transaction["date"]) ?? "", year: currentYear, month: currentMonth)
        if inCurrentMonth { txnCountThisMonth += 1 }

        let amount = double(transaction["amount"])

        switch string(transaction["type"]) {
        case "expense":
          if isFrom {
            expenseSum += amount
            if inCurrentMonth { monthlyChange -= amount }
          }
        case "income":
          if isFrom {
            incomeSum += amount
            if inCurrentMonth { monthlyChange += amount }
          }
        case "transfer":
          if isFrom {
            expenseSum += amount
            if inCurrentMonth { monthlyChange -= amount }
          }
          if isTo {
            incomeSum += amount
            if inCurrentMonth { monthlyChange += amount }
          }
        case "debt_lend", "vault_deposit":
          if isFrom {
            expenseSum += amount
            if inCurrentMonth { monthlyChange -= amount }
          }
        case "debt_borrow", "vault_withdraw":
          if isFrom {
            incomeSum += amount
            if inCurrentMonth { monthlyChange += amount }
          }
        default:
          break
        }
      }

      // `openingBalance !== undefined ? openingBalance : (dueAmount || 0)`
      let startingOpening: Double
      if let opening = account["openingBalance"] as? NSNumber {
        startingOpening = opening.doubleValue
      } else {
        startingOpening = double(account["dueAmount"])
      }

      if isCredit {
        let finalDue = max(0, startingOpening + expenseSum - incomeSum)
        account["balance"] = 0
        account["dueAmount"] = finalDue
        account["monthlyChange"] = monthlyChange
        account["txnCountThisMonth"] = txnCountThisMonth
        account["statusType"] = finalDue > 0 ? "due" : "no_change"
      } else {
        let finalBalance = startingOpening + incomeSum - expenseSum
        account["balance"] = finalBalance
        // The store sets `dueAmount: undefined` here, and `JSON.stringify` drops
        // undefined keys, so the persisted blob must not carry the field.
        account.removeValue(forKey: "dueAmount")
        account["monthlyChange"] = monthlyChange
        account["txnCountThisMonth"] = txnCountThisMonth
        account["statusType"] = finalBalance >= 0 ? "positive" : "due"
      }

      return account
    }
  }

  /// Port of `parseISODate` + `isInMonth`. `month` is 0-based, as in the store.
  private static func isInMonth(_ dateString: String, year: Int, month: Int) -> Bool {
    let pattern = "^([0-9]{4})-([0-9]{2})-([0-9]{2})"
    guard
      let regex = try? NSRegularExpression(pattern: pattern),
      let match = regex.firstMatch(
        in: dateString, range: NSRange(dateString.startIndex..., in: dateString)),
      let range = Range(match.range(at: 1), in: dateString)
    else {
      // Fallback mirrors the store: parse loosely and use local components.
      let formatter = DateFormatter()
      formatter.dateFormat = "yyyy-MM-dd"
      formatter.timeZone = .current
      guard let parsed = formatter.date(from: dateString) else { return false }
      let parts = Calendar.current.dateComponents([.year, .month], from: parsed)
      return parts.year == year && (parts.month ?? 0) - 1 == month
    }
    let yearString = String(dateString[range])
    guard let parsedYear = Int(yearString) else { return false }
    let monthRange = Range(match.range(at: 2), in: dateString)
    guard let parsedMonth = monthRange.flatMap({ Int(String(dateString[$0])) }) else { return false }
    return parsedYear == year && parsedMonth - 1 == month
  }

  /// Applies an expense using the same shape and ordering rules as
  /// `addTransaction` in the store, then recomputes accounts.
  ///
  /// `transactionId` is derived from `opId`, so replaying the same operation
  /// is a no-op.
  static func addExpense(
    opId: String,
    transactionId: String,
    amount: Double,
    categoryId: String,
    accountId: String,
    note: String?,
    date: String
  ) -> Bool {
    var succeeded = false

    mutate { (snapshot: inout Snapshot) -> Snapshot? in
      let accounts = snapshot.accounts
      guard
        accounts.contains(where: { string($0["id"]) == accountId })
      else { return nil }

      var transactions = snapshot.transactions
      if transactions.contains(where: { string($0["id"]) == transactionId }) {
        succeeded = true
        return nil  // Already recorded; nothing to write.
      }

      guard
        let account = accounts.first(where: { string($0["id"]) == accountId })
      else { return nil }

      var transaction: [String: Any] = [
        "id": transactionId,
        "amount": amount,
        "type": "expense",
        "categoryId": categoryId,
        "accountId": accountId,
        "accountName": string(account["name"]) ?? "",
        "date": date,
      ]
      if let note, !note.isEmpty { transaction["note"] = note }

      transactions.insert(transaction, at: 0)
      transactions.sort { left, right in
        let leftDate = string(left["date"]) ?? ""
        let rightDate = string(right["date"]) ?? ""
        if leftDate != rightDate { return leftDate > rightDate }
        return (string(left["id"]) ?? "") > (string(right["id"]) ?? "")
      }

      snapshot.state["transactions"] = transactions
      snapshot.state["accounts"] = recomputeAccounts(
        accounts: accounts, transactions: transactions)

      succeeded = true
      return snapshot
    }

    return succeeded
  }

  // MARK: - MD5

  /// Matches AsyncStorage's `RCTMD5Hash`: lowercase hex of the UTF-8 key.
  ///
  /// MD5 is used here purely as a filename hash so this code resolves the exact
  /// same file AsyncStorage wrote. It is not used as a security primitive, and
  /// the resulting filename is never a credential.
  static func md5Hex(_ string: String) -> String {
    let data = Data(string.utf8)
    var digest = [UInt8](repeating: 0, count: Int(CC_MD5_DIGEST_LENGTH))
    data.withUnsafeBytes { buffer in
      _ = CC_MD5(buffer.baseAddress, CC_LONG(data.count), &digest)
    }
    return digest.map { String(format: "%02x", $0) }.joined()
  }
}

/// Durable outbox of quick adds that the App Intent has already written.
///
/// The app drains this on foreground and acknowledges each entry, so a
/// quick add the user saw confirmed can never be lost to a stale in-memory
/// snapshot.
enum ExpenseOpsLog {

  private static let maxEntries = 200

  private static var logURL: URL {
    ExpenseStore.storageDirectory.appendingPathComponent("quick_add_ops.json")
  }

  private static func read() -> [[String: Any]] {
    guard
      let data = try? Data(contentsOf: logURL),
      let object = try? JSONSerialization.jsonObject(with: data),
      let entries = object as? [[String: Any]]
    else { return [] }
    return entries
  }

  private static func write(_ entries: [[String: Any]]) {
    guard JSONSerialization.isValidJSONObject(entries) else { return }
    guard
      let data = try? JSONSerialization.data(withJSONObject: entries)
    else { return }
    try? data.write(to: logURL, options: .atomic)
  }

  static func record(_ entry: [String: Any]) {
    var entries = read()
    entries.removeAll { ($0["opId"] as? String) == (entry["opId"] as? String) }
    entries.append(entry)
    if entries.count > maxEntries {
      entries.removeFirst(entries.count - maxEntries)
    }
    write(entries)
  }

  static func pending() -> [[String: Any]] {
    read()
  }

  static func acknowledge(opId: String) {
    var entries = read()
    let before = entries.count
    entries.removeAll { ($0["opId"] as? String) == opId }
    if entries.count != before { write(entries) }
  }

  static func updateTransactionId(opId: String, transactionId: String) {
    var entries = read()
    var changed = false
    for index in entries.indices {
      if (entries[index]["opId"] as? String) == opId {
        entries[index]["transactionId"] = transactionId
        changed = true
      }
    }
    if changed { write(entries) }
  }
}
