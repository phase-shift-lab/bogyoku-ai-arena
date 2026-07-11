/// <reference lib="webworker" />

import { parseBestmove, parseInfoLine } from "./usiParser";
import type {
  EngineConfig,
  PrincipalVariation,
  WorkerRequest,
  WorkerResponse,
} from "./usiTypes";

interface YaneuraOuModule {
  addMessageListener(listener: (line: string) => void): void;
  removeMessageListener(listener: (line: string) => void): void;
  postMessage(command: string): Promise<void>;
  terminate(): void;
}

interface FactoryOptions {
  print(line: string): void;
  printErr(line: string): void;
}

type YaneuraOuFactory = (options: FactoryOptions) => Promise<YaneuraOuModule>;

async function loadFactory(
  runtime: EngineConfig["runtime"],
  assetBaseUrl: string,
) {
  const url = new URL(`${runtime}/yaneuraou.js`, assetBaseUrl);
  const module = (await import(/* @vite-ignore */ url.href)) as {
    default: YaneuraOuFactory;
  };
  return module.default;
}

const worker = self as unknown as DedicatedWorkerGlobalScope;
let engine: YaneuraOuModule | undefined;
let config: EngineConfig | undefined;
let activeSearchId: number | undefined;
const variations = new Map<number, PrincipalVariation>();
const recentOutput: string[] = [];

function send(message: WorkerResponse) {
  worker.postMessage(message);
}

async function command(value: string) {
  if (!engine) throw new Error("エンジンが初期化されていません");
  await engine.postMessage(value);
}

function onOutput(line: string) {
  recentOutput.push(line);
  if (recentOutput.length > 12) recentOutput.shift();
  send({ type: "output", line });
  const info = parseInfoLine(line);
  if (info) variations.set(info.multipv, info);
  const best = parseBestmove(line);
  if (best && activeSearchId !== undefined) {
    send({
      type: "result",
      id: activeSearchId,
      result: {
        ...best,
        variations: [...variations.values()].sort(
          (a, b) => a.multipv - b.multipv,
        ),
      },
    });
    activeSearchId = undefined;
  }
}

async function waitFor(token: string, timeoutMs = 15000) {
  return await new Promise<void>((resolve, reject) => {
    const listener = (line: string) => {
      if (line.trim() !== token) return;
      worker.clearTimeout(timeout);
      engine?.removeMessageListener(listener);
      resolve();
    };
    const timeout = worker.setTimeout(() => {
      engine?.removeMessageListener(listener);
      const detail = recentOutput.length
        ? ` (last: ${recentOutput.join(" | ")})`
        : " (no engine output)";
      reject(new Error(`${token} タイムアウト${detail}`));
    }, timeoutMs);
    engine?.addMessageListener(listener);
  });
}

async function initialize(
  id: number,
  nextConfig: EngineConfig,
  assetBaseUrl: string,
) {
  config = nextConfig;
  const factory = await loadFactory(config.runtime, assetBaseUrl);
  const options = {
    print: onOutput,
    printErr: (line) => send({ type: "output", line: `stderr: ${line}` }),
  } satisfies FactoryOptions;
  engine = await factory(options);
  engine.addMessageListener(onOutput);
  const usi = waitFor("usiok");
  await command("usi");
  await usi;
  await command(`setoption name Threads value ${config.threads}`);
  await command(`setoption name USI_Hash value ${config.hashMb}`);
  await command(`setoption name MultiPV value ${config.multiPv}`);
  const ready = waitFor("readyok");
  await command("isready");
  await ready;
  await command("usinewgame");
  send({ type: "ready", id });
}

worker.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  try {
    if (message.type === "initialize") {
      await initialize(message.id, message.config, message.assetBaseUrl);
    } else if (message.type === "search") {
      if (activeSearchId !== undefined) await command("stop");
      activeSearchId = message.id;
      variations.clear();
      const suffix = message.request.moves?.length
        ? ` moves ${message.request.moves.join(" ")}`
        : "";
      await command(`position sfen ${message.request.sfen}${suffix}`);
      const restricted = message.request.searchMoves?.length
        ? ` searchmoves ${message.request.searchMoves.join(" ")}`
        : "";
      await command(`go movetime ${message.request.moveTimeMs}${restricted}`);
    } else if (message.type === "stop") {
      await command("stop");
      activeSearchId = undefined;
      send({ type: "stopped", id: message.id });
    } else {
      if (engine) await command("quit");
      engine?.terminate();
      engine = undefined;
      close();
    }
  } catch (error) {
    send({
      type: "error",
      id: message.id,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

export {};
