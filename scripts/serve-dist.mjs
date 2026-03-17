import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const rootDir = normalize(join(process.cwd(), "dist"));
const port = Number(process.env.PLAYWRIGHT_WEB_PORT ?? 4173);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function resolveRequestPath(url) {
  const pathname = new URL(url, `http://127.0.0.1:${port}`).pathname;
  const normalizedPath = pathname === "/" ? "/index.html" : pathname;
  const candidatePath = normalize(join(rootDir, normalizedPath));

  if (!candidatePath.startsWith(rootDir)) {
    return null;
  }

  if (existsSync(candidatePath)) {
    return candidatePath;
  }

  return join(rootDir, "index.html");
}

const server = createServer(async (request, response) => {
  const resolvedPath = resolveRequestPath(request.url ?? "/");

  if (resolvedPath === null) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  try {
    const fileStats = await stat(resolvedPath);

    if (!fileStats.isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const extension = extname(resolvedPath);
    const contentType =
      contentTypes.get(extension) ?? "application/octet-stream";

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Length": String(fileStats.size),
      "Content-Type": contentType,
    });

    createReadStream(resolvedPath).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  // eslint-disable-next-line no-console
  console.log(`ovumcy-app dist server listening on http://127.0.0.1:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => {
      process.exit(0);
    });
  });
}
