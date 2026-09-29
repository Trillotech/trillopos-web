import { api, errorResponse, withAccess, writeTokens } from "@/lib/backend";
import { sameOrigin } from "@/lib/form-post";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return errorResponse(403, { code: "forbidden" });
  const { code } = await request.json();
  const accepted = await withAccess(token => api(token).POST("/auth/invitations/accept", { body: { code } }));
  if (!accepted.response.ok || !accepted.data?.organizationId)
    return errorResponse(accepted.response.status, accepted.error ?? { code: "unknown" });
  const organizationId = accepted.data.organizationId;
  const switched = await withAccess(token => api(token).POST("/auth/switch", { body: { organizationId } }));
  if (!switched.response.ok || !switched.data) return errorResponse(switched.response.status, switched.error ?? { code: "unknown" });
  await writeTokens(switched.data);
  return Response.json({ kind: switched.data.kind });
}
