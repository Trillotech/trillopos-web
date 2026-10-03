export class ApiError extends Error {
  readonly code: string;
  readonly detail?: string;

  constructor(code: string, detail?: string) {
    super(code);
    this.name = "ApiError";
    this.code = code;
    this.detail = detail;
  }
}

export async function readResponse<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (response.status === 401) {
    throw new ApiError("unauthorized");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { code?: string; detail?: string };
    throw new ApiError(body.code ?? "unknown", body.detail);
  }
  if (response.status === 204) {
    return { data: undefined as T, replayed: false };
  }
  return {
    data: (await response.json()) as T,
    replayed: response.headers.get("Idempotent-Replay") === "true",
  };
}

export async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  return (await readResponse<T>(path, init)).data;
}

const internalIds = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Mapped copy when the code is known, with the backend's detail when it says something a person can
 * use ("3 on hand"); a detail that names records by their internal ids is left out. Otherwise the
 * backend's detail.
 */
export function messageFor(
  caught: unknown,
  translate: (key: string) => string,
  has: (key: string) => boolean,
) {
  if (caught instanceof ApiError) {
    const mapped = has(caught.code) ? translate(caught.code) : undefined;
    if (mapped && caught.detail && !internalIds.test(caught.detail)) {
      return `${mapped} (${caught.detail})`;
    }
    return mapped || caught.detail || translate("unknown");
  }
  return translate("unknown");
}
