import { api, errorResponse, publicCall, withAccess, writeTokens } from "@/lib/backend";
import type { Membership, Schemas } from "@/lib/backend";
import { formLocale, isFormPost, sameOrigin, seeOther, withError } from "@/lib/form-post";

type SignupFields = {
  phone?: string;
  password?: string;
  fullName?: string;
  businessName?: string;
  signupCode?: string;
};

function signUp(fields: SignupFields) {
  return publicCall<Schemas["IssuedTokens"]>(() =>
    api().POST("/auth/signup", {
      body: {
        phone: fields.phone ?? "",
        password: fields.password ?? "",
        fullName: fields.fullName ?? "",
        businessName: fields.businessName ?? "",
        deviceLabel: "trillopos-web",
        signupCode: fields.signupCode || undefined,
      },
    }),
  );
}

export async function POST(request: Request) {
  if (isFormPost(request)) {
    // the page's script had not run: answer the plain form with a redirect
    const form = await request.formData();
    const back = `/${formLocale(form)}/signup`;
    if (!sameOrigin(request)) {
      return seeOther(withError(back, "unknown"));
    }
    const text = (name: string) => String(form.get(name) ?? "");
    const result = await signUp({
      phone: text("phone"),
      password: text("password"),
      fullName: text("fullName"),
      businessName: text("businessName"),
      signupCode: text("signupCode"),
    });
    if (!result.ok || !result.data) {
      return seeOther(withError(back, result.ok ? "unknown" : result.problem.code));
    }
    await writeTokens(result.data);
    return seeOther(`/${formLocale(form)}/${result.data.kind === "PICKER" ? "businesses" : "dashboard"}`);
  }

  const result = await signUp((await request.json()) as SignupFields);
  if (!result.ok || !result.data) {
    return errorResponse(result.ok ? 502 : result.status, result.ok ? { code: "unknown" } : result.problem);
  }
  await writeTokens(result.data);
  const listed = await withAccess((token) => api(token).GET("/auth/memberships"));
  const memberships = (listed.response.ok ? listed.data : []) as Membership[];
  return Response.json({ kind: result.data.kind, memberships }, { status: 201 });
}
