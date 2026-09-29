import { relay, api } from "@/lib/relay";
import type { Schemas } from "@/lib/backend";

/** Every size of one model at once: one product per size. */
export async function POST(request: Request) {
  const body = (await request.json()) as Schemas["SizesWrite"];
  return relay((token) => api(token).POST("/products/sizes", { body }));
}
