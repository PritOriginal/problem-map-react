import type { QueuedItem, QueueStorage } from "./types";

/** In-memory storage: tests and browsers without IndexedDB (the queue then lives for the session). */
export class MemoryQueueStorage implements QueueStorage {
    private items = new Map<string, QueuedItem>();

    async getAll(): Promise<QueuedItem[]> {
        return Array.from(this.items.values());
    }

    async put(item: QueuedItem): Promise<void> {
        this.items.set(item.id, item);
    }

    async delete(id: string): Promise<void> {
        this.items.delete(id);
    }
}

const DB_NAME = "problem-map-offline";
const DB_VERSION = 1;
const STORE = "queue";

/** IndexedDB storage; `Blob`s are stored natively (structured clone), no base64 needed. */
export class IndexedDbQueueStorage implements QueueStorage {
    private dbPromise: Promise<IDBDatabase> | null = null;

    static isSupported(): boolean {
        return typeof indexedDB !== "undefined";
    }

    private open(): Promise<IDBDatabase> {
        if (!this.dbPromise) {
            this.dbPromise = new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);
                request.onupgradeneeded = () => {
                    if (!request.result.objectStoreNames.contains(STORE)) {
                        request.result.createObjectStore(STORE, { keyPath: "id" });
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            this.dbPromise.catch(() => {
                this.dbPromise = null;
            });
        }
        return this.dbPromise;
    }

    private async run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
        const db = await this.open();
        return new Promise<T>((resolve, reject) => {
            const tx = db.transaction(STORE, mode);
            const request = op(tx.objectStore(STORE));
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            tx.onerror = () => reject(tx.error);
        });
    }

    getAll(): Promise<QueuedItem[]> {
        return this.run("readonly", (store) => store.getAll() as IDBRequest<QueuedItem[]>);
    }

    async put(item: QueuedItem): Promise<void> {
        await this.run("readwrite", (store) => store.put(item));
    }

    async delete(id: string): Promise<void> {
        await this.run("readwrite", (store) => store.delete(id));
    }
}

export function createQueueStorage(): QueueStorage {
    return IndexedDbQueueStorage.isSupported() ? new IndexedDbQueueStorage() : new MemoryQueueStorage();
}
