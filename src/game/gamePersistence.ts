import {
  createInitialGameState,
  playUsi,
  type ShogiGameState,
} from "./shogiGame";

interface GameSnapshotV1 {
  readonly version: 1;
  readonly startingSfen: string;
  readonly moves: readonly string[];
}

export interface GameStateStorage {
  load(): string | null;
  save(serializedState: string): void;
  clear(): void;
}

export interface AsyncGameRepository {
  load(): Promise<string | null>;
  save(serializedState: string): Promise<void>;
  clear(): Promise<void>;
}

const DATABASE_NAME = "bogyoku-ai-arena";
const STORE_NAME = "game-state";
const ACTIVE_GAME_KEY = "active";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = operation(
        database.transaction(STORE_NAME, mode).objectStore(STORE_NAME),
      );
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

export const indexedDbGameRepository: AsyncGameRepository = {
  async load() {
    if (typeof indexedDB === "undefined") return null;
    return (
      (await transact("readonly", (store) => store.get(ACTIVE_GAME_KEY))) ??
      null
    );
  },
  async save(serializedState) {
    if (typeof indexedDB === "undefined") return;
    await transact("readwrite", (store) =>
      store.put(serializedState, ACTIVE_GAME_KEY),
    );
  },
  async clear() {
    if (typeof indexedDB === "undefined") return;
    await transact("readwrite", (store) => store.delete(ACTIVE_GAME_KEY));
  },
};

export function serializeGame(state: ShogiGameState): string {
  const snapshot: GameSnapshotV1 = {
    version: 1,
    startingSfen: state.startingSfen,
    moves: state.moves.map((move) => move.usi),
  };
  return JSON.stringify(snapshot);
}

export function restoreGame(
  serializedState: string,
): ShogiGameState | undefined {
  try {
    const snapshot = JSON.parse(serializedState) as Partial<GameSnapshotV1>;
    if (
      snapshot.version !== 1 ||
      typeof snapshot.startingSfen !== "string" ||
      !Array.isArray(snapshot.moves) ||
      !snapshot.moves.every((move) => typeof move === "string")
    ) {
      return undefined;
    }

    let state = createInitialGameState(snapshot.startingSfen);
    for (const usi of snapshot.moves) {
      const next = playUsi(state, usi);
      if (next.moves.length !== state.moves.length + 1) return undefined;
      state = next;
    }
    return state;
  } catch {
    return undefined;
  }
}
