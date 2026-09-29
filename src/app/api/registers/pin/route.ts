import { api, errorResponse, writeTokens } from "@/lib/backend";
import { sameOrigin } from "@/lib/form-post";
import { endSession, registerCredential } from "@/lib/register-device";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return errorResponse(403, { code: "forbidden" });
  const credential = await registerCredential();
  if (!credential) return errorResponse(401, { code: "register_required" });
  const { membershipId, pin } = await request.json();
  const result = await api().POST("/auth/pin", { headers: { "X-Register-Device": credential }, body: { membershipId, pin } });
  if (!result.response.ok || !result.data) return errorResponse(result.response.status, result.error ?? { code: "unknown" });
  await endSession();
  await writeTokens(result.data);
  return Response.json({ kind: result.data.kind });
}
