import { relay, api } from "@/lib/relay";
import type { Schemas } from "@/lib/backend";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  const body = (await request.json()) as Schemas["SizeChartUpdate"];
  return relay((token) => api(token).PATCH("/size-charts/{id}", { params: { path: { id } }, body }));
}

export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params;
  return relay((token) => api(token).DELETE("/size-charts/{id}", { params: { path: { id } } }));
}
