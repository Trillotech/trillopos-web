import { errorResponse } from "@/lib/backend";
import { sameOrigin } from "@/lib/form-post";
import { endSession, forgetRegister, registerCredential, registerStaff, rememberRegister } from "@/lib/register-device";
export async function GET() {
  const credential = await registerCredential();
  if (!credential) return Response.json({ configured: false, staff: [] });
  const result = await registerStaff(credential);
  if (!result.response.ok) return errorResponse(result.response.status, result.error ?? { code: "register_invalid" });
  return Response.json({ configured: true, staff: result.data ?? [] });
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return errorResponse(403, { code: "forbidden" });
  const { credential } = await request.json();
  if (typeof credential !== "string" || !credential || credential.length > 512) return errorResponse(400, { code: "register_invalid" });
  const result = await registerStaff(credential);
  if (!result.response.ok) return errorResponse(result.response.status, result.error ?? { code: "register_invalid" });
  await endSession();
  await rememberRegister(credential);
  return Response.json({ configured: true });
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return errorResponse(403, { code: "forbidden" });
  await endSession();
  await forgetRegister();
  return new Response(null, { status: 204 });
}
