import type { PushSubscription } from "web-push";
import { savePushSubscription, removePushSubscription } from "@/lib/push";
import { badRequest, parseJsonBody } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await parseJsonBody<PushSubscription>(req);
  if (body instanceof Response) return body;

  if (!body.endpoint || typeof body.endpoint !== "string") {
    return badRequest("invalid push subscription: missing endpoint");
  }

  await savePushSubscription(body);
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const body = await parseJsonBody<{ endpoint?: string }>(req);
  if (body instanceof Response) return body;

  if (!body.endpoint || typeof body.endpoint !== "string") {
    return badRequest("endpoint is required");
  }

  await removePushSubscription(body.endpoint);
  return Response.json({ ok: true });
}
