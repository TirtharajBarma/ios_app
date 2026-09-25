import * as SQLite from "expo-sqlite";

// ─────────────────────────────────────────────────────────────────────────
// ON-DEVICE AUDIT LOG
// A hidden, append-only activity trail stored in its own SQLite database
// (audit_logs.db). It is deliberately kept separate from the subscriptions
// DB and the async-storage state so it survives app resets, is never synced
// to any server, and is not rendered anywhere except the Activity Logs
// screen under Settings → Data & Privacy.
// ─────────────────────────────────────────────────────────────────────────

export type AuditLevel = "error" | "warn" | "info" | "action";

export type AuditScope =
  | "app"
  | "transaction"
  | "account"
  | "category"
  | "budget"
  | "vault"
  | "folder"
  | "preset"
  | "subscription"
  | "settings"
  | "sync"
  | "export"
  | "import"
  | "security"
  | "database"
  | "system";

export interface AuditLogEntry {
  id: string;
  ts: string;
  level: AuditLevel;
  scope: AuditScope | string;
  message: string;
  meta: string | null;
}

export interface AuditLogFilter {
  level?: AuditLevel;
  scope?: AuditScope | string;
  query?: string;
  limit: number;
  offset: number;
}

const MAX_LOGS = 5000;
const MAX_PENDING = 500;
const DB_NAME = "audit_logs.db";

let dbRef: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<void> | null = null;
let writeChain: Promise<void> = Promise.resolve();
let pending: AuditLogEntry[] = [];
let writeCounter = 0;

// ── id + timestamp helpers ────────────────────────────────────────────
function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ── Secret redaction (logs are local, but never trust the input) ──────
const SECRET_KEY_RE = /(password|passwd|secret|token|apikey|api[_-]?key|auth|authorization|authorisation|cookie|session|cvv|cvc|private[_-]?key|access[_-]?key|supabase.*key)/i;
const CARD_RE = /\b(?:\d[ -]?){13,19}\b/g;
const SECRET_HINT_RE = /(Bearer\s+|Basic\s+|sk-[A-Za-z0-9]+|eyJ[A-Za-z0-9_-]{10,})/g;

function redactString(value: string): string {
  return value
    .replace(SECRET_HINT_RE, (m) => (m.startsWith("Bearer") || m.startsWith("Basic") ? "[REDACTED]" : "[REDACTED]"))
    .replace(CARD_RE, "[REDACTED_CARD]");
}

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactString(value);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
    };
  }
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const v = (value as Record<string, unknown>)[key];
      if (SECRET_KEY_RE.test(key)) {
        out[key] = "[REDACTED]";
      } else {
        out[key] = sanitizeValue(v);
      }
    }
    return out;
  }
  return value;
}

function toMetaJson(meta?: unknown): string | null {
  if (meta === undefined || meta === null) return null;
  try {
    return JSON.stringify(sanitizeValue(meta), null, 0);
  } catch {
    try {
      return JSON.stringify(redactString(String(meta)));
    } catch {
      return null;
    }
  }
}

// ── low-level write path (fail-safe, never throws upward) ─────────────
function enqueue(level: AuditLevel, scope: AuditScope | string, message: string, meta?: unknown): void {
  const entry: AuditLogEntry = {
    id: makeId(),
    ts: nowIso(),
    level,
    scope,
    message: redactString(message),
    meta: toMetaJson(meta),
  };

  if (dbRef) {
    queueWrite(entry);
  } else {
    pending.push(entry);
    if (pending.length > MAX_PENDING) pending.splice(0, pending.length - MAX_PENDING);
    // If the DB has not been initialised yet, kick off a lazy attempt —
    // this keeps logs durable even when the writer fires before startup init.
    if (!initPromise && !dbRef) {
      void initAuditLogs().catch(() => {});
    }
  }
}

function queueWrite(entry: AuditLogEntry): void {
  writeChain = writeChain.then(async () => {
    const db = dbRef;
    if (!db) return;
    try {
      await db.runAsync(
        "INSERT INTO app_logs (id, ts, level, scope, message, meta) VALUES (?, ?, ?, ?, ?, ?);",
        entry.id,
        entry.ts,
        entry.level,
        entry.scope,
        entry.message,
        entry.meta
      );
      writeCounter += 1;
      // Prune roughly every 75 writes (cheap: avoids unbounded growth).
      if (writeCounter % 75 === 0) {
        await pruneOverflow(db);
      }
    } catch {
      // Non-fatal — the logger must never crash the app.
    }
  });
}

async function pruneOverflow(db: SQLite.SQLiteDatabase): Promise<void> {
  try {
    await db.runAsync(
      `DELETE FROM app_logs WHERE id NOT IN (
        SELECT id FROM app_logs ORDER BY ts DESC, id DESC LIMIT ?);`,
      MAX_LOGS
    );
  } catch {
    // ignore
  }
}

// ── init ───────────────────────────────────────────────────────────────
export async function initAuditLogs(): Promise<void> {
  if (dbRef) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS app_logs (
        id TEXT PRIMARY KEY,
        ts TEXT NOT NULL,
        level TEXT NOT NULL,
        scope TEXT NOT NULL,
        message TEXT NOT NULL,
        meta TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_app_logs_ts ON app_logs (ts DESC);
      CREATE INDEX IF NOT EXISTS idx_app_logs_level ON app_logs (level);
      CREATE INDEX IF NOT EXISTS idx_app_logs_scope ON app_logs (scope);
    `);
    dbRef = db;

    // Flush anything written before the connection was ready.
    const buffered = pending;
    pending = [];
    for (const entry of buffered) queueWrite(entry);
    await writeChain;

    await pruneOverflow(db);
  })().catch((err) => {
    initPromise = null;
    // Keep the module alive in memory-only mode rather than failing hard.
    try {
      console.log("AuditLog: DB init failed, falling back to memory buffer.", err);
    } catch {
      // noop
    }
  });

  return initPromise;
}

/** True once the persistent DB is connected (memory fallback still logs). */
export function isAuditLogReady(): boolean {
  return dbRef !== null;
}

// ── public log API (fire-and-forget, never throws) ────────────────────
export function logError(scope: AuditScope | string, message: string, meta?: unknown): void {
  enqueue("error", scope, message, meta);
}

export function logWarn(scope: AuditScope | string, message: string, meta?: unknown): void {
  enqueue("warn", scope, message, meta);
}

export function logInfo(scope: AuditScope | string, message: string, meta?: unknown): void {
  enqueue("info", scope, message, meta);
}

export function logAction(scope: AuditScope | string, message: string, meta?: unknown): void {
  enqueue("action", scope, message, meta);
}

/** Error-aware variant: folds an exception into meta automatically. */
export function logException(scope: AuditScope | string, message: string, err?: unknown, meta?: unknown): void {
  enqueue("error", scope, message, { ...(meta as object | undefined), error: err instanceof Error ? { name: err.name, message: err.message } : err, at: nowIso() });
}

// ── query API (used by the Activity Logs screen) ───────────────────────
async function ensureReady(): Promise<SQLite.SQLiteDatabase | null> {
  if (!dbRef) await initAuditLogs();
  return dbRef;
}

export async function getLogs(filter: AuditLogFilter): Promise<AuditLogEntry[]> {
  const db = await ensureReady();
  if (!db) return [];

  const where: string[] = [];
  const params: (string | number)[] = [];
  if (filter.level) {
    where.push("level = ?");
    params.push(filter.level);
  }
  if (filter.scope) {
    where.push("scope = ?");
    params.push(filter.scope);
  }
  if (filter.query && filter.query.trim()) {
    where.push("(message LIKE ? OR meta LIKE ? OR scope LIKE ?)");
    const q = `%${filter.query.trim()}%`;
    params.push(q, q, q);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = Math.min(Math.max(filter.limit, 1), 500);
  const offset = Math.max(filter.offset, 0);

  try {
    const rows = await db.getAllAsync<AuditLogEntry>(
      `SELECT id, ts, level, scope, message, meta FROM app_logs
       ${whereSql} ORDER BY ts DESC, id DESC LIMIT ${limit} OFFSET ${offset};`,
      ...params
    );
    return rows;
  } catch {
    return [];
  }
}

export interface AuditLogCounts {
  actions: number;
  errors: number;
  warnings: number;
  info: number;
  total: number;
}

export async function getLogCounts(): Promise<AuditLogCounts> {
  const db = await ensureReady();
  const counts: AuditLogCounts = { actions: 0, errors: 0, warnings: 0, info: 0, total: 0 };
  if (!db) return counts;

  try {
    const rows = await db.getAllAsync<{ level: AuditLevel; c: number }>(
      "SELECT level, COUNT(*) as c FROM app_logs GROUP BY level;"
    );
    for (const row of rows) {
      if (row.level === "action") counts.actions = row.c;
      else if (row.level === "error") counts.errors = row.c;
      else if (row.level === "warn") counts.warnings = row.c;
      else if (row.level === "info") counts.info = row.c;
      counts.total += row.c;
    }
  } catch {
    // ignore
  }
  return counts;
}

export async function getLogScopes(): Promise<string[]> {
  const db = await ensureReady();
  if (!db) return [];
  try {
    const rows = await db.getAllAsync<{ scope: string }>(
      "SELECT DISTINCT scope FROM app_logs ORDER BY scope ASC;"
    );
    return rows.map((r) => r.scope);
  } catch {
    return [];
  }
}

/** Manual, explicit clear (a user control). Erase-data does NOT call this. */
export async function clearAuditLogs(): Promise<void> {
  const db = await ensureReady();
  if (!db) return;
  try {
    await db.execAsync("DELETE FROM app_logs;");
  } catch {
    // ignore
  }
}

/** Renders the whole log (newest first) as plain text, for share/export. */
export async function exportAuditLogsText(limit = 5000): Promise<string> {
  const db = await ensureReady();
  if (!db) return "Audit log is unavailable.";
  try {
    const rows = await db.getAllAsync<AuditLogEntry>(
      `SELECT id, ts, level, scope, message, meta FROM app_logs ORDER BY ts DESC, id DESC LIMIT ${limit};`
    );
    const lines = rows.map((r) => {
      const meta = r.meta ? `  ${r.meta}` : "";
      return `[${r.ts}] ${r.level.toUpperCase()} ${r.scope}  ${r.message}${meta}`;
    });
    return lines.join("\n");
  } catch {
    return "Audit log is unavailable.";
  }
}

// ── global console interceptor (auto-captures scattered warn/error) ───
let captureInstalled = false;

export function installConsoleCapture(): void {
  if (captureInstalled) return;
  captureInstalled = true;

  const originalWarn = console.warn;
  const originalError = console.error;

  function argsToString(args: unknown[]): string {
    const parts = args.map((a) => {
      if (typeof a === "string") return a;
      try {
        return JSON.stringify(sanitizeValue(a));
      } catch {
        return String(a);
      }
    });
    return parts.join(" ") || "unknown";
  }

  console.warn = (...args: unknown[]) => {
    try {
      originalWarn(...args);
    } catch {
      // noop
    }
    enqueue("warn", "system", argsToString(args));
  };

  console.error = (...args: unknown[]) => {
    try {
      originalError(...args);
    } catch {
      // noop
    }
    enqueue("error", "system", argsToString(args));
  };
}