import { proxy } from "@/lib/backend";

export async function POST(request: Request) {
  return proxy("/sales/preview", { method: "POST", body: await request.json() });
}
