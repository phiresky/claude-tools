import { createServer } from "node:http";
import { speak } from "./tts.ts";
import { readConfig } from "./config.ts";
import { createLogger } from "./log.ts";

const log = createLogger(import.meta);

const config = readConfig();
if (!config.speak_server_listen) {
  throw new Error("speak_server_listen is not configured in voicy.json (e.g. \"127.0.0.1:7700\")");
}
const [HOST, portStr] = config.speak_server_listen.split(":");
const PORT = parseInt(portStr, 10);

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end('{"status":"ok"}');
    return;
  }

  if (req.method === "POST" && req.url === "/speak") {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      let text: string;
      let voice: string;
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
        text = body.text;
        voice = body.voice;
        if (!text || !voice) throw new Error("missing text or voice");
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: (e as Error).message }));
        return;
      }

      res.writeHead(202, { "Content-Type": "application/json" });
      res.end('{"queued":true}');

      log(`speak request: voice=${voice} text="${text.slice(0, 80)}"`);
      speak(text, voice).catch((e) => log(`speak error: ${(e as Error).message}`));
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end('{"error":"not found"}');
});

server.listen(PORT, HOST, () => {
  log(`speak-server listening on ${HOST}:${PORT}`);
});
