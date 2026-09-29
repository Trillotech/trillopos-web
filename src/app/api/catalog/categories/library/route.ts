import { relay, api } from "@/lib/relay";

/** The ready-made categories, each with the kind of size table that fits it. */
export async function GET() {
  return relay((token) => api(token).GET("/categories/library"));
}
