import { relay, api } from "@/lib/relay";

export async function GET() {
  return relay((token) => api(token).GET("/size-charts/library"));
}
