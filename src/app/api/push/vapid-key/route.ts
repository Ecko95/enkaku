import { getVapidPublicKey } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ publicKey: await getVapidPublicKey() });
}
