import { api, tokenKind, withAccess, type Membership, type Schemas } from "@/lib/backend";
type Session = { kind?: string; current?: Schemas["SessionView"]; memberships: Membership[] };
export async function GET() {
  const session = await withAccess<Session>(async token => {
    if (tokenKind(token) === "PICKER") {
      const listed = await api(token).GET("/auth/memberships");
      return { response: listed.response, data: { kind: "PICKER", memberships: listed.data ?? [] } };
    }
    const current = await api(token).GET("/session");
    const kind = current.data?.kind;
    const listed = current.response.ok && kind !== "REGISTER" ? await api(token).GET("/auth/memberships") : undefined;
    return { response: current.response, data: { kind, current: current.data, memberships: listed?.data ?? [] } };
  });
  return Response.json(session.response.ok ? { authenticated: true, ...session.data } : { authenticated: false, memberships: [] });
}
