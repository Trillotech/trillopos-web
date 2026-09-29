import { endSession, registerCredential } from "@/lib/register-device";
export async function POST() {
  await endSession();
  return new Response(null, { status: 204, headers: { "X-Login-Path": await registerCredential() ? "/register" : "/login" } });
}
