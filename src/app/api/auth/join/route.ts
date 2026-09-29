import { api, errorResponse, publicCall, writeTokens } from "@/lib/backend";
import { formLocale, isFormPost, sameOrigin, seeOther, withError } from "@/lib/form-post";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return errorResponse(403, { code: "forbidden" });
  const form = isFormPost(request) ? await request.formData() : undefined;
  const body = form ? Object.fromEntries(form) : await request.json();
  const result = await publicCall(() => api().POST("/auth/join", { body: {
    code: String(body.code ?? ""), phone: String(body.phone ?? ""), password: String(body.password ?? ""),
    fullName: String(body.fullName ?? ""), deviceLabel: "trillopos-web",
  } }));
  if (!result.ok || !result.data) {
    const code = result.ok ? "unknown" : result.problem.code;
    return form ? seeOther(withError(`/${formLocale(form)}/join`, code)) : errorResponse(result.ok ? 502 : result.status, { code });
  }
  await writeTokens(result.data);
  return form ? seeOther(`/${formLocale(form)}/dashboard`) : Response.json({ kind: result.data.kind });
}
