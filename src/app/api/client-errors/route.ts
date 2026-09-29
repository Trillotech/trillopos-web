/**
 * Errors from people's browsers, posted by the inline script in the root layout: the only way to
 * see what breaks on a phone we do not have. Written to the web container's output, one line each:
 *   docker compose logs web | grep client-error
 * No personal data: the page path, the error, the file and line, and the browser's user agent.
 */
export async function POST(request: Request) {
  const text = (await request.text()).slice(0, 4000);
  let report: Record<string, unknown>;
  try {
    report = JSON.parse(text) as Record<string, unknown>;
  } catch {
    report = { message: "unreadable report" };
  }
  const part = (value: unknown, max: number) => String(value ?? "").replace(/\s+/g, " ").slice(0, max);
  console.warn(
    `[client-error] ${part(report.kind, 20)} ${part(report.path, 120)} :: ${part(report.message, 300)}` +
      ` @ ${part(report.source, 160)}:${part(report.line, 8)}:${part(report.col, 8)} :: ${part(report.ua, 220)}`,
  );
  return new Response(null, { status: 204 });
}
