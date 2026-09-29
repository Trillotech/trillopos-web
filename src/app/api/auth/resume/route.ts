import { api, clearTokens, tokenKind, withAccess } from "@/lib/backend";

/**
 * Renews an expired session where cookie writes are allowed. The console layout cannot write
 * cookies, so its page asks here and reloads itself on 204, staying where the person was going.
 * No redirect: behind the proxy, request.url is the container's own address, not the public one.
 */
export async function POST() {
  // Choose again after renewal: an expired access cookie may already be gone.
  const session = await withAccess(async (token) => {
    const result = await api(token).GET(tokenKind(token) === "PICKER" ? "/auth/memberships" : "/session");
    return { response: result.response };
  });
  if (session.response.ok) {
    return new Response(null, { status: 204 });
  }
  if (session.response.status === 401) {
    await clearTokens();
    return Response.json({ code: "unauthorized" }, { status: 401 });
  }
  return Response.json({ code: "network" }, { status: 503 });
}
