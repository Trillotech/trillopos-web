import { proxy } from "@/lib/backend";

export async function GET(request: Request) {
  const locationId = new URL(request.url).searchParams.get("locationId");
  const response = await proxy(`/shifts/current?locationId=${encodeURIComponent(locationId ?? "")}`);
  // "no shift is open at this store" is an answer, not a failure: the screens offer Open shift,
  // and cash taken meanwhile simply enters no drawer
  if (response.status === 404) {
    const problem = (await response.clone().json().catch(() => ({}))) as { code?: string };
    if (problem.code === "no_open_shift") {
      return Response.json(null);
    }
  }
  return response;
}

export async function POST(request: Request) {
  return proxy("/shifts", { method: "POST", body: await request.json() });
}
