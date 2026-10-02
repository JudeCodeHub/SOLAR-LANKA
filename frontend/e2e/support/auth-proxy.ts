/** Sits between the app and the API and adds a signed token for whichever demo identity the test chose. */
import { existsSync, readFileSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";

import { ensureKeys, signToken } from "./jwt.ts";
import { API_PORT, FAIL_FILE, IDENTITY_FILE, PROXY_PORT } from "./paths.ts";

const KEPT_RESPONSE_HEADERS = new Set(["content-type", "cache-control", "www-authenticate", "retry-after", "content-disposition"]);
const read = (file: string) => (existsSync(file) ? readFileSync(file, "utf8").trim() : "");

export function startAuthProxy() {
  const { privateKey } = ensureKeys();
  const server = createServer((incoming, outgoing) => {
    const chunks: Buffer[] = [];
    incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
    incoming.on("end", () => {
      const body = Buffer.concat(chunks);
      // A test can ask for writes to fail, to see how the screens recover.
      if (read(FAIL_FILE) === "writes" && incoming.method !== "GET") {
        const data = JSON.stringify({ error: { code: "service_unavailable", message: "The service is temporarily unavailable.", issues: [] } });
        outgoing.writeHead(503, { "content-type": "application/json", "content-length": Buffer.byteLength(data) });
        outgoing.end(data);
        return;
      }
      const headers: Record<string, string> = {};
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (typeof value === "string" && !["host", "authorization", "connection", "content-length"].includes(name)) headers[name] = value;
      }
      headers["content-length"] = String(body.length);
      const subject = read(IDENTITY_FILE);
      if (subject) headers.authorization = `Bearer ${signToken(subject, privateKey)}`;
      const upstream = httpRequest({ host: "127.0.0.1", port: API_PORT, path: incoming.url, method: incoming.method, headers }, (response) => {
        const kept: Record<string, string> = {};
        for (const [name, value] of Object.entries(response.headers)) {
          if (KEPT_RESPONSE_HEADERS.has(name) && typeof value === "string") kept[name] = value;
        }
        outgoing.writeHead(response.statusCode ?? 502, kept);
        response.pipe(outgoing);
      });
      upstream.on("error", () => {
        outgoing.writeHead(502, { "content-type": "application/json" });
        outgoing.end(JSON.stringify({ error: { code: "service_unavailable", message: "The API is not running.", issues: [] } }));
      });
      upstream.end(body);
    });
  });
  server.listen(PROXY_PORT, "127.0.0.1");
  return server;
}
