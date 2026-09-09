import { describe, it, expect } from "vitest";
import { cacheControlFor, etagFor, staticFileResponse } from "./static-files.js";

/**
 * Stand-in for a BunFile: staticFileResponse needs a body plus a lastModified.
 * `size` comes from the Blob itself, which is getter-only, so the contents are
 * what vary it.
 */
function fakeFile(content = "<!doctype html>", lastModified = 1_788_896_772_358) {
  const blob = new Blob([content]);
  return Object.defineProperty(blob, "lastModified", { value: lastModified }) as Blob & {
    lastModified: number;
  };
}

describe("static file cache policy", () => {
  describe("cacheControlFor", () => {
    it("caches content-hashed assets for a year without revalidation", () => {
      expect(cacheControlFor("/assets/index-B8NOjUmU.js")).toBe(
        "public, max-age=31536000, immutable",
      );
    });

    it("revalidates index.html, so a release is never pinned by a cached copy", () => {
      expect(cacheControlFor("/index.html")).toBe("public, no-cache");
    });

    it("revalidates files whose names survive a release", () => {
      // Copied verbatim from public/, so the bytes behind these can change.
      expect(cacheControlFor("/sw.js")).toBe("public, no-cache");
      expect(cacheControlFor("/sounds/dice-roll.ogg")).toBe("public, no-cache");
      expect(cacheControlFor("/favicon.svg")).toBe("public, no-cache");
    });
  });

  describe("etagFor", () => {
    it("changes when the size or the mtime changes", () => {
      const before = etagFor(fakeFile("same", 1_000));
      expect(etagFor(fakeFile("longer", 1_000))).not.toBe(before);
      expect(etagFor(fakeFile("same", 2_000))).not.toBe(before);
    });

    it("is stable for an unchanged file", () => {
      expect(etagFor(fakeFile())).toBe(etagFor(fakeFile()));
    });

    it("is quoted, as the header syntax requires", () => {
      expect(etagFor(fakeFile())).toMatch(/^"[\w-]+"$/);
    });
  });

  describe("staticFileResponse", () => {
    it("sends the body with an etag when the client holds nothing", () => {
      const res = staticFileResponse(fakeFile(), "/index.html", null);
      expect(res.status).toBe(200);
      expect(res.headers.get("etag")).toBe(etagFor(fakeFile()));
      expect(res.headers.get("cache-control")).toBe("public, no-cache");
    });

    it("answers 304 without a body when the client is already current", async () => {
      const file = fakeFile();
      const res = staticFileResponse(file, "/index.html", etagFor(file));
      expect(res.status).toBe(304);
      expect(await res.text()).toBe("");
    });

    it("sends the body when the client holds a stale etag", () => {
      const res = staticFileResponse(fakeFile(), "/index.html", '"stale-etag"');
      expect(res.status).toBe(200);
    });

    it("matches a weak validator and an etag list", () => {
      const file = fakeFile();
      const etag = etagFor(file);
      expect(staticFileResponse(file, "/index.html", `W/${etag}`).status).toBe(304);
      expect(staticFileResponse(file, "/index.html", `"other", ${etag}`).status).toBe(304);
      expect(staticFileResponse(file, "/index.html", "*").status).toBe(304);
    });

    it("keeps extra headers, so the SPA fallback still declares its type", () => {
      const res = staticFileResponse(fakeFile(), "/index.html", null, {
        "content-type": "text/html; charset=utf-8",
      });
      expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    });
  });
});
