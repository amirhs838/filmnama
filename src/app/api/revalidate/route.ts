import { revalidatePath, revalidateTag } from "next/cache";
import { parseRevalidatePaths, readRevalidateBody, validRevalidateSecret, verifyRevalidateSignature } from "@/lib/revalidation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.NEXT_REVALIDATE_SECRET;
  if (!validRevalidateSecret(secret)) return Response.json({ error: "Revalidation unavailable" }, { status: 503 });
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return Response.json({ error: "JSON body required" }, { status: 415 });
  let rawBody: string;
  try {
    rawBody = await readRevalidateBody(request);
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!verifyRevalidateSignature(rawBody, request.headers.get("x-revalidate-timestamp"), request.headers.get("x-revalidate-signature"), secret)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let paths: string[];
  try {
    paths = parseRevalidatePaths(rawBody);
  } catch {
    return Response.json({ error: "Invalid revalidation paths" }, { status: 400 });
  }
  revalidateTag("courses", { expire: 0 });
  revalidateTag("instructors", { expire: 0 });
  revalidateTag("blog", { expire: 0 });
  revalidateTag("gallery", { expire: 0 });
  revalidateTag("works", { expire: 0 });
  revalidateTag("settings", { expire: 0 });
  for (const path of paths) revalidatePath(path);
  return Response.json({ revalidated: true, paths, regeneration: "on-next-visit" });
}
