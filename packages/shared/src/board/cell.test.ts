import { describe, expect, it } from "vitest";
import { parseCell, yard, track, home } from "./cell.js";

describe("cell-ID serialize", () => {
  it("serializes yard cells", () => {
    expect(yard(1, 1)).toBe("Y/1/1");
    expect(yard(4, 4)).toBe("Y/4/4");
    expect(yard(8, 2)).toBe("Y/8/2");
  });

  it("serializes track cells", () => {
    expect(track(1)).toBe("T/1");
    expect(track(52)).toBe("T/52");
    expect(track(104)).toBe("T/104");
  });

  it("serializes home cells", () => {
    expect(home(1, 1)).toBe("H/1/1");
    expect(home(4, 4)).toBe("H/4/4");
    expect(home(8, 3)).toBe("H/8/3");
  });
});

describe("cell-ID parse", () => {
  it("parses yard cells", () => {
    expect(parseCell("Y/1/1")).toEqual({ kind: "yard", seat: 1, slot: 1 });
    expect(parseCell("Y/8/4")).toEqual({ kind: "yard", seat: 8, slot: 4 });
  });

  it("parses track cells", () => {
    expect(parseCell("T/1")).toEqual({ kind: "track", index: 1 });
    expect(parseCell("T/52")).toEqual({ kind: "track", index: 52 });
    expect(parseCell("T/104")).toEqual({ kind: "track", index: 104 });
  });

  it("parses home cells", () => {
    expect(parseCell("H/1/1")).toEqual({ kind: "home", seat: 1, index: 1 });
    expect(parseCell("H/4/4")).toEqual({ kind: "home", seat: 4, index: 4 });
  });

  it("rejects empty string", () => {
    expect(() => parseCell("")).toThrow();
  });

  it("rejects unknown prefix", () => {
    expect(() => parseCell("X/1/1")).toThrow();
  });

  it("rejects non-integer components", () => {
    expect(() => parseCell("Y/a/1")).toThrow();
    expect(() => parseCell("T/abc")).toThrow();
    expect(() => parseCell("H/1/x")).toThrow();
  });

  it("rejects zero-indexed values (must be 1-based)", () => {
    expect(() => parseCell("Y/0/1")).toThrow();
    expect(() => parseCell("Y/1/0")).toThrow();
    expect(() => parseCell("T/0")).toThrow();
    expect(() => parseCell("H/0/1")).toThrow();
    expect(() => parseCell("H/1/0")).toThrow();
  });

  it("rejects negative values", () => {
    expect(() => parseCell("Y/-1/1")).toThrow();
    expect(() => parseCell("T/-5")).toThrow();
  });

  it("rejects fractional values", () => {
    expect(() => parseCell("T/1.5")).toThrow();
    expect(() => parseCell("Y/1/2.5")).toThrow();
  });

  it("rejects wrong segment count for yard", () => {
    expect(() => parseCell("Y/1")).toThrow();
    expect(() => parseCell("Y/1/2/3")).toThrow();
  });

  it("rejects wrong segment count for track", () => {
    expect(() => parseCell("T/1/2")).toThrow();
  });

  it("rejects wrong segment count for home", () => {
    expect(() => parseCell("H/1")).toThrow();
    expect(() => parseCell("H/1/2/3")).toThrow();
  });

  it("rejects yard slot > 4 (M=4)", () => {
    expect(() => parseCell("Y/1/5")).toThrow();
  });

  it("rejects home index > 4 (L=4)", () => {
    expect(() => parseCell("H/1/5")).toThrow();
  });
});

describe("round-trip", () => {
  it("parse(serialize) is identity for yard", () => {
    const id = yard(3, 2);
    expect(parseCell(id)).toEqual({ kind: "yard", seat: 3, slot: 2 });
  });

  it("parse(serialize) is identity for track", () => {
    const id = track(27);
    expect(parseCell(id)).toEqual({ kind: "track", index: 27 });
  });

  it("parse(serialize) is identity for home", () => {
    const id = home(5, 3);
    expect(parseCell(id)).toEqual({ kind: "home", seat: 5, index: 3 });
  });
});
