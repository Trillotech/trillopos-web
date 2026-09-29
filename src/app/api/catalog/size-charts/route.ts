import { relay, api } from "@/lib/relay";
import type { Schemas } from "@/lib/backend";

export async function GET() {
  return relay((token) => api(token).GET("/size-charts"));
}

/** From the library (`templateKey`, returns the shop's copy if it has one) or typed by the shop. */
export async function POST(request: Request) {
  const body = (await request.json()) as Schemas["SizeChartCreate"];
  return relay((token) => api(token).POST("/size-charts", { body }));
}
