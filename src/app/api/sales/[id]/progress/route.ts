import { proxy } from "@/lib/backend";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxy(`/sales/${id}/progress`);
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxy(`/sales/${id}/progress`, { method: "POST", body: await request.json() });
}
