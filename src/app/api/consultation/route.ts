import "server-only";
import { backendUrl, contentSource } from "@/lib/content-config";
import { proxyConsultation } from "@/lib/consultation-proxy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return proxyConsultation(request, { backendUrl, contentSource });
}
