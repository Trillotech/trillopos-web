import { errorResponse, publicCall, api, writeTokens } from "@/lib/backend";
import type { Schemas } from "@/lib/backend";
import { formLocale, isFormPost, sameOrigin, seeOther, withError } from "@/lib/form-post";

function signIn(phone: string, password: string) {
  return publicCall<Schemas["LoginResult"]>(() =>
    api().POST("/auth/login", { body: { phone, password, deviceLabel: "trillopos-web" } }),
  );
}

export async function POST(request: Request) {
  if (isFormPost(request)) {
    // the page's script had not run: answer the plain form with a redirect
    const form = await request.formData();
    const back = `/${formLocale(form)}/login`;
    if (!sameOrigin(request)) {
      return seeOther(withError(back, "unknown"));
    }
    const result = await signIn(String(form.get("phone") ?? ""), String(form.get("password") ?? ""));
    if (!result.ok || !result.data?.tokens) {
      return seeOther(withError(back, result.ok ? "unknown" : result.problem.code));
    }
    await writeTokens(result.data.tokens);
    return seeOther(`/${formLocale(form)}/${result.data.tokens.kind === "PICKER" ? "businesses" : "dashboard"}`);
  }

  const body = (await request.json()) as { phone?: string; password?: string };
  const result = await signIn(body.phone ?? "", body.password ?? "");
  if (!result.ok || !result.data?.tokens) {
    return errorResponse(result.ok ? 502 : result.status, result.ok ? { code: "unknown" } : result.problem);
  }
  await writeTokens(result.data.tokens);
  return Response.json({
    kind: result.data.tokens.kind,
    memberships: result.data.memberships ?? [],
  });
}
