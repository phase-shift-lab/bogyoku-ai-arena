import type {
  EngineConfig,
  SearchRequest,
  SearchResult,
  WorkerRequest,
  WorkerResponse,
} from "./usiTypes";

type PendingRequest = {
  readonly kind: WorkerRequest["type"];
  readonly resolve: (value: unknown) => void;
  readonly reject: (reason: Error) => void;
  readonly timeout: ReturnType<typeof setTimeout>;
};

export class YaneuraOuClient {
  private worker: Worker;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly recentOutput: string[] = [];
  private nextId = 1;

  constructor() {
    this.worker = this.createWorker();
  }

  private createWorker(): Worker {
    const worker = new Worker(new URL("./usi.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) =>
      this.receive(event.data);
    worker.onerror = (event) =>
      this.rejectAll(
        new Error(event.message || "WASM Workerでエラーが発生しました"),
      );
    return worker;
  }

  async initialize(config: EngineConfig): Promise<void> {
    await this.request<void>(
      {
        type: "initialize",
        id: this.nextId++,
        assetBaseUrl: `${import.meta.env.BASE_URL}engine/`,
        config,
      },
      30_000,
    );
  }

  async restart(config: EngineConfig): Promise<void> {
    this.rejectAll(new Error("エンジンを再起動しました"));
    this.worker.terminate();
    this.worker = this.createWorker();
    await this.initialize(config);
  }

  async search(request: SearchRequest): Promise<SearchResult> {
    return await this.request<SearchResult>(
      { type: "search", id: this.nextId++, request },
      request.moveTimeMs + 30_000,
    );
  }

  stop(): void {
    for (const [id, pending] of this.pending) {
      if (pending.kind !== "search") continue;
      clearTimeout(pending.timeout);
      pending.reject(new Error("探索を停止しました"));
      this.pending.delete(id);
    }
    this.worker.postMessage({
      type: "stop",
      id: this.nextId++,
    } satisfies WorkerRequest);
  }

  dispose(): void {
    this.rejectAll(new Error("エンジンを終了しました"));
    this.worker.postMessage({
      type: "dispose",
      id: this.nextId++,
    } satisfies WorkerRequest);
    this.worker.terminate();
  }

  private request<T>(message: WorkerRequest, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(message.id);
        if (message.type === "search")
          this.worker.postMessage({
            type: "stop",
            id: this.nextId++,
          } satisfies WorkerRequest);
        const detail = this.recentOutput.length
          ? ` (last: ${this.recentOutput.join(" | ")})`
          : " (no worker output)";
        reject(new Error(`${message.type} タイムアウト${detail}`));
      }, timeoutMs);
      this.pending.set(message.id, {
        kind: message.type,
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });
      this.worker.postMessage(message);
    });
  }

  private receive(message: WorkerResponse): void {
    if (message.type === "output") {
      this.recentOutput.push(message.line);
      if (this.recentOutput.length > 12) this.recentOutput.shift();
      return;
    }
    const pending = this.pending.get(message.id);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pending.delete(message.id);
    if (message.type === "error") pending.reject(new Error(message.message));
    else if (message.type === "result") pending.resolve(message.result);
    else pending.resolve(undefined);
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }
}
