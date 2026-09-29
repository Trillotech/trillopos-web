import { relay, api } from "@/lib/relay";
import type { Schemas } from "@/lib/backend";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  return relay((token) => api(token).GET("/products/{id}", { params: { path: { id } } }));
}

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  const body = (await request.json()) as Schemas["ProductWrite"];
  return relay((token) => api(token).PATCH("/products/{id}", { params: { path: { id } }, body }));
}

/** Deleting archives the product; `?writeOffStock=true` also writes off the stock it still holds. */
export async function DELETE(request: Request, context: Context) {
  const { id } = await context.params;
  const writeOffStock = new URL(request.url).searchParams.get("writeOffStock") === "true";
  return relay((token) => api(token).DELETE("/products/{id}", { params: { path: { id }, query: { writeOffStock } } }));
}
