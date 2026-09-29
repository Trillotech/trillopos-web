import { cookies } from "next/headers";
import { api, clearTokens, cookieOptions, refreshToken } from "@/lib/backend";
const DEVICE = "trillopos_register";
export async function registerCredential() { return (await cookies()).get(DEVICE)?.value; }
export async function rememberRegister(credential: string) {
  (await cookies()).set(DEVICE, credential, cookieOptions(30 * 24 * 60 * 60));
}
export async function forgetRegister() { (await cookies()).delete(DEVICE); }
export async function endSession() {
  const refresh = await refreshToken();
  if (refresh) await api().POST("/auth/logout", { body: { refreshToken: refresh } });
  await clearTokens();
}
export async function registerStaff(credential: string) {
  return api().GET("/auth/register/staff", { headers: { "X-Register-Device": credential } });
}
