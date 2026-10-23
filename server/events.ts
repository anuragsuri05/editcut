// Server-sent events bus: GET /api/events. Broadcast media/export/transcription progress.
import type { Request, Response } from "express";

const clients = new Set<Response>();

export function eventsHandler(req: Request, res: Response): void {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.write(": connected\n\n");
  clients.add(res);
  const ping = setInterval(() => res.write(": ping\n\n"), 20000);
  req.on("close", () => {
    clearInterval(ping);
    clients.delete(res);
  });
}

export function broadcast(event: { type: string; [k: string]: unknown }): void {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const c of clients) c.write(data);
}
