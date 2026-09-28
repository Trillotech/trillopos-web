/**
 * Sign-in and sign-up also work as plain HTML forms, for a phone that has not run the page's
 * script yet (a slow connection, an old browser): the browser posts the form here and follows
 * a redirect, instead of the page calling the route with JSON.
 */
export function isFormPost(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  return type.startsWith("application/x-www-form-urlencoded") || type.startsWith("multipart/form-data");
}

/** Another site may not post these forms. Browsers send Origin on a form POST; old ones may omit it. */
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin === null) {
    return true;
  }
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export function formLocale(form: FormData) {
  return form.get("locale") === "my" ? "my" : "en";
}

/** Only a backend error code goes into the address, never anything the person typed. */
export function withError(path: string, code: string | undefined) {
  return `${path}?error=${code && /^[a-z_]{1,40}$/.test(code) ? code : "unknown"}`;
}

/** A relative Location: behind the proxy, request.url is the container's own address. */
export function seeOther(path: string) {
  return new Response(null, { status: 303, headers: { Location: path } });
}
