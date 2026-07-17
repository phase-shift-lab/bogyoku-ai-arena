import {
  parseLearningState,
  type LearningState,
} from "./model";

const databaseName = "bogyoku-ai-learning";
const storeName = "adaptive-policy";
const stateKey = "state";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const request = operation(transaction.objectStore(storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export const learningRepository = {
  async load() {
    const stored = await transact<LearningState | undefined>("readonly", (store) =>
      store.get(stateKey),
    );
    return stored ? parseLearningState(JSON.stringify(stored)) : undefined;
  },
  async save(state: LearningState) {
    await transact<IDBValidKey>("readwrite", (store) =>
      store.put(state, stateKey),
    );
  },
  async clear() {
    await transact<undefined>("readwrite", (store) => store.clear());
  },
};
