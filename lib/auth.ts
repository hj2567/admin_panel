export const AUTH_COOKIE = "token";

export function getOriginFromRequestHeaders(host: string, proto?: string) {
  const scheme = proto ?? "http";
  return `${scheme}://${host}`;
}

export function buildLoginUrl(origin: string) {
  const proxyBase = process.env.NEXT_PUBLIC_AUTH_PROXY_BASE!;
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!;

  const redirectUri = `${origin}/auth/callback`;

  const url = new URL("/google", proxyBase);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);

  return url.toString();
}

export function parseTokenFromHash(hash: string) {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  return (
    params.get("token") ||
    params.get("access_token") ||
    params.get("id_token") ||
    ""
  );
}
