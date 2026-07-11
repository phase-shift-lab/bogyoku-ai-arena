import { pathToFileURL } from "node:url";
import path from "node:path";
import process from "node:process";
import { clearTimeout, setTimeout } from "node:timers";

const enginePath = path.resolve(
  process.argv[2] ?? "src/engine/runtime/threaded/yaneuraou.js",
);
const timeoutMs = Number(process.argv[3] ?? 30_000);
const goCommand = process.argv[4] ?? "go depth 1";
const stopAfterMs = Number(process.argv[5] ?? 0);
const threads = Number(process.argv[6] ?? 1);
const wasmPath = enginePath.replace(/\.js$/, ".wasm");

async function send(command) {
  process.stderr.write(`> ${command}\n`);
  await engine.postMessage(command);
}

const { default: createEngine } = await import(pathToFileURL(enginePath));
const options = {
  locateFile: (file) =>
    file === "yaneuraou.wasm"
      ? wasmPath
      : path.join(path.dirname(enginePath), file),
  print: (line) => {
    process.stdout.write(`${line}\n`);
  },
  printErr: (line) => process.stderr.write(`${line}\n`),
};
const engine = await createEngine(options);
engine.addMessageListener((line) => process.stdout.write(`${line}\n`));

function waitFor(pattern, command) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      engine.removeMessageListener(listener);
      reject(new Error(`Timed out waiting for ${pattern}`));
    }, timeoutMs);
    const listener = (line) => {
      if (!pattern.test(String(line))) return;
      clearTimeout(timer);
      engine.removeMessageListener(listener);
      resolve(line);
    };
    engine.addMessageListener(listener);
    void send(command).catch(reject);
  });
}

try {
  await waitFor(/^usiok$/, "usi");
  await send(`setoption name Threads value ${threads}`);
  await send("setoption name USI_Hash value 16");
  await send("setoption name USI_OwnBook value false");
  await send("setoption name MinimumThinkingTime value 1");
  await waitFor(/^readyok$/, "isready");
  await send("position startpos");
  if (stopAfterMs > 0) setTimeout(() => void send("stop"), stopAfterMs);
  await waitFor(/^bestmove\s+\S+/, goCommand);
  process.stdout.write("YaneuraOu smoke test passed.\n");
} finally {
  engine.terminate();
}
