import { subscribe, getConnectedClientCount } from "@/lib/broadcast";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // stream closed
        }
      };

      send(JSON.stringify({ event: "connected", clients: getConnectedClientCount() + 1 }));

      const keepalive = setInterval(() => {
        send(JSON.stringify({ event: "ping", clients: getConnectedClientCount() }));
      }, 15_000);

      const unsubscribe = subscribe((msg) => {
        send(JSON.stringify(msg));
      });

      const cleanup = () => {
        clearInterval(keepalive);
        unsubscribe();
      };

      controller.enqueue(encoder.encode(""));

      const checkClosed = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(""));
        } catch {
          cleanup();
          clearInterval(checkClosed);
        }
      }, 30_000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
