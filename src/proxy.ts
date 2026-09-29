import { NextResponse, type NextRequest } from "next/server";
import { backendUrl, contentSource } from "@/lib/content-config";
import { isContentPath, parseCourse, parseDepartment, parseRedirect } from "@/lib/content-contract";

async function lookup(path: string): Promise<Response> {
  return fetch(new URL(path, backendUrl()), { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000), headers: { Accept: "application/json" } });
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (!["GET", "HEAD"].includes(request.method) || !isContentPath(path) || path === "/courses") return NextResponse.next();
  try {
    if (contentSource() === "mock") return NextResponse.next();
    const [, , department, slug] = path.split("/");
    const response = await lookup(slug ? `public/courses/${department}/${slug}` : `public/departments/${department}`);
    if (response.ok) return NextResponse.next();
    if (response.status !== 404) throw new Error();
    const redirectResponse = await lookup(`public/redirects?${new URLSearchParams({ path })}`);
    if (!redirectResponse.ok) throw new Error();
    const rawDestination = parseRedirect(await redirectResponse.json());
    const destination = rawDestination && !rawDestination.endsWith("/") ? `${rawDestination}/` : rawDestination;
    if (!destination || destination === path) return NextResponse.next();
    if (destination !== "/" && destination !== "/courses") {
      const [, , targetDepartment, targetSlug] = destination.split("/");
      const target = await lookup(targetSlug ? `public/courses/${targetDepartment}/${targetSlug}` : `public/departments/${targetDepartment}`);
      if (target.status === 404) return NextResponse.next();
      if (!target.ok) throw new Error();
      const value: unknown = await target.json();
      if (targetSlug) {
        const course = parseCourse(value);
        if (course.department !== targetDepartment || course.slug !== targetSlug) throw new Error();
      } else if (parseDepartment(value).slug !== targetDepartment) throw new Error();
    }
    return NextResponse.redirect(new URL(destination, request.url), 301);
  } catch {
    return new NextResponse("Course content is temporarily unavailable", { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60", "Content-Type": "text/plain; charset=utf-8" } });
  }
}

export const config = { matcher: "/courses/:path*" };
