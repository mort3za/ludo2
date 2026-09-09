/**
 * Cache policy and conditional-GET handling for the built client bundle.
 *
 * Bun's `new Response(Bun.file(...))` sends no cache headers whatsoever — no
 * Cache-Control, no validator — so a browser was given neither a freshness
 * lifetime nor a way to ask "has this changed?". It re-downloaded the whole
 * JS/CSS bundle, and every .ogg sound, on every single page load.
 *
 * Two classes of file, split by whether the filename carries a content hash:
 *
 * - `/assets/*` is content-hashed by Vite, so the bytes behind one of those
 *   URLs can never change. Cache for a year and skip revalidation entirely.
 * - `index.html`, `/sw.js`, `/sounds/*` and the favicons keep their names
 *   across releases, so they must be revalidated. `index.html` above all: it
 *   names the current hashed bundle, so a stale copy pins the whole app to
 *   the previous release. An ETag is what keeps that revalidation cheap — a
 *   304 with no body instead of a full re-download.
 */

const ONE_YEAR_SECONDS = 31_536_000;

/** Files Vite content-hashes, and so can be cached without ever revalidating. */
function isContentHashed(pathname: string): boolean {
  return pathname.startsWith("/assets/");
}

export function cacheControlFor(pathname: string): string {
  return isContentHashed(pathname)
    ? `public, max-age=${ONE_YEAR_SECONDS}, immutable`
    : "public, no-cache";
}

/**
 * Validator built from size and mtime, so it costs a stat rather than a read
 * of the file. Base 36 only to keep the header short.
 */
export function etagFor(file: { size: number; lastModified: number }): string {
  return `"${file.size.toString(36)}-${file.lastModified.toString(36)}"`;
}

/** An `If-None-Match` value is a list, and each entry may be weak (`W/`). */
function matchesEtag(ifNoneMatch: string, etag: string): boolean {
  return ifNoneMatch.split(",").some((candidate) => {
    const trimmed = candidate.trim();
    return trimmed === "*" || trimmed.replace(/^W\//, "") === etag;
  });
}

/**
 * Serve `file` with its cache policy, answering 304 when the client already
 * holds the current version. `pathname` decides the policy — pass the path the
 * file actually lives at, not the request path, so an SPA route that falls
 * back to index.html is treated as index.html.
 */
export function staticFileResponse(
  file: Blob & { lastModified: number },
  pathname: string,
  ifNoneMatch: string | null,
  extraHeaders: Record<string, string> = {},
): Response {
  const etag = etagFor(file);
  const headers: Record<string, string> = {
    "cache-control": cacheControlFor(pathname),
    etag,
    ...extraHeaders,
  };

  if (ifNoneMatch && matchesEtag(ifNoneMatch, etag)) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(file, { headers });
}
