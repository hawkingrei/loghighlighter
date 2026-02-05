const PENDING_LOG_KEY = "loghighlighter.pendingLog.v1";
const MEMORY_LOG_KEY = "__loghighlighter_pendingLog";
const DB_NAME = "loghighlighter";
const STORE_NAME = "pendingLog";
const DB_KEY = "log";
const PENDING_LOG_VERSION = 1;

function buildPayload(text, source) {
  return {
    v: PENDING_LOG_VERSION,
    text,
    storedAt: Date.now(),
    source,
  };
}

function isPayload(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.text === "string" &&
    typeof value.storedAt === "number"
  );
}

function parseStoredValue(value) {
  if (isPayload(value)) return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    if (isPayload(parsed)) return parsed;
  } catch (error) {
    // Fall through to legacy format.
  }
  return { v: 0, text: value, storedAt: 0, source: "legacy" };
}

function pickBestPayload(candidates) {
  let best = null;
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (!best) {
      best = candidate;
      continue;
    }
    if (candidate.storedAt > best.storedAt) {
      best = candidate;
      continue;
    }
    if (candidate.storedAt === best.storedAt) {
      const bestVersion = typeof best.v === "number" ? best.v : 0;
      const candidateVersion = typeof candidate.v === "number" ? candidate.v : 0;
      if (candidateVersion > bestVersion) {
        best = candidate;
      } else if (best.source === "legacy" && candidate.source !== "legacy") {
        best = candidate;
      }
    }
  }
  return best;
}

function canUseIndexedDb() {
  return typeof indexedDB !== "undefined";
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

async function idbSet(value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(value, DB_KEY);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function idbConsume() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(DB_KEY);
    let value = null;
    let settled = false;

    const safeResolve = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const safeReject = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    request.onsuccess = () => {
      value = request.result;
      store.delete(DB_KEY);
    };

    request.onerror = () => {
      safeReject(request.error);
    };

    tx.oncomplete = () => {
      db.close();
      safeResolve(value);
    };

    tx.onabort = () => {
      db.close();
      safeReject(tx.error);
    };

    tx.onerror = () => {
      db.close();
      safeReject(tx.error);
    };
  });
}

async function idbDelete() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(DB_KEY);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

function setMemoryPendingLog(text) {
  try {
    window[MEMORY_LOG_KEY] = text;
    return true;
  } catch (error) {
    return false;
  }
}

function consumeMemoryPendingLog() {
  try {
    const value = window[MEMORY_LOG_KEY];
    if (value) {
      delete window[MEMORY_LOG_KEY];
      return value;
    }
  } catch (error) {
    return null;
  }
  return null;
}

function clearSessionPendingLog() {
  try {
    sessionStorage.removeItem(PENDING_LOG_KEY);
  } catch (error) {
    // Best effort.
  }
}

async function clearIndexedDbPendingLog() {
  if (!canUseIndexedDb()) return;
  try {
    await idbDelete();
  } catch (error) {
    // Best effort.
  }
}

function clearMemoryPendingLog() {
  try {
    delete window[MEMORY_LOG_KEY];
  } catch (error) {
    // Best effort.
  }
}

export async function storePendingLog(text) {
  if (typeof window === "undefined") return { ok: false };

  try {
    const payload = buildPayload(text, "session");
    sessionStorage.setItem(PENDING_LOG_KEY, JSON.stringify(payload));
    return { ok: true, via: "session" };
  } catch (error) {
    // Continue to indexedDB.
  }

  if (canUseIndexedDb()) {
    try {
      const payload = buildPayload(text, "indexeddb");
      await idbSet(payload);
      return { ok: true, via: "indexeddb" };
    } catch (error) {
      // Continue to memory.
    }
  }

  const payload = buildPayload(text, "memory");
  if (setMemoryPendingLog(payload)) {
    return { ok: true, via: "memory" };
  }

  return { ok: false };
}

export async function consumePendingLog() {
  if (typeof window === "undefined") return "";

  const memoryPayload = parseStoredValue(consumeMemoryPendingLog());
  let sessionPayload = null;
  let idbPayload = null;

  try {
    const pending = sessionStorage.getItem(PENDING_LOG_KEY);
    if (pending !== null) {
      sessionPayload = parseStoredValue(pending);
    }
  } catch (error) {
    // Continue to indexedDB.
  }

  if (canUseIndexedDb()) {
    try {
      const stored = await idbConsume();
      idbPayload = parseStoredValue(stored);
    } catch (error) {
      // Ignore indexedDB errors.
    }
  }

  const chosen = pickBestPayload([sessionPayload, idbPayload, memoryPayload]);

  clearSessionPendingLog();
  clearMemoryPendingLog();
  await clearIndexedDbPendingLog();

  if (!chosen) return "";
  return chosen.text;
}
