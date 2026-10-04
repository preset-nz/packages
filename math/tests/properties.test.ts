// Behaviour checked from first principles, independent of the fixtures.
import { describe, expect, it } from "vitest";
import * as m from "../src-ts/index.ts";
import type { Basis, Curve } from "../src-ts/index.ts";

const sweep = (a: number, b: number, n = 200) =>
  Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

describe("scalars", () => {
  it("fit(0.3, 0, 1, 10, 20) is 13", () => {
    expect(m.fit(0.3, 0, 1, 10, 20)).toBeCloseTo(13);
  });
  it("fit clamps, fitUnclamped extrapolates", () => {
    expect(m.fit(2, 0, 1, 10, 20)).toBe(20);
    expect(m.fitUnclamped(2, 0, 1, 10, 20)).toBe(30);
  });
  it("fit reverses with a reversed range", () => {
    expect(m.fit(0, 1, 0, 10, 20)).toBe(20);
    expect(m.fit(1, 1, 0, 10, 20)).toBe(10);
    expect(m.fit(0, -1, 1, 0, 1)).toBe(0.5);
  });
  it("invlerp undoes lerp, and a degenerate range is 0.5", () => {
    expect(m.invlerp(m.lerp(3, 7, 0.3), 3, 7)).toBeCloseTo(0.3);
    expect(m.invlerp(5, 2, 2)).toBe(0.5);
  });
  it("smooth is 3t² − 2t³ between its edges", () => {
    expect(m.smooth(0, 1, 0.25)).toBeCloseTo(0.15625);
    expect(m.smooth(0, 1, 0)).toBe(0);
    expect(m.smooth(0, 1, 1)).toBe(1);
  });
  for (const [name, bias, gain] of [
    ["Schlick", m.bias, m.gain],
    ["Perlin", m.biasPerlin, m.gainPerlin],
  ] as const) {
    it(`${name}: 0.5 is the identity, ends are fixed, bias(0.5, b) = b`, () => {
      for (const x of sweep(0, 1, 20)) {
        expect(bias(x, 0.5)).toBeCloseTo(x);
        expect(gain(x, 0.5)).toBeCloseTo(x);
      }
      for (const b of [0.1, 0.3, 0.8]) {
        expect(bias(0, b)).toBe(0);
        expect(bias(1, b)).toBe(1);
        expect(bias(0.5, b)).toBeCloseTo(b);
      }
    });
    it(`${name}: gain above 0.5 steepens the middle`, () => {
      expect(gain(0.25, 0.8)).toBeLessThan(0.25);
      expect(gain(0.75, 0.8)).toBeGreaterThan(0.75);
    });
  }
  it("Schlick bias with 1 − b is its inverse", () => {
    for (const x of sweep(0, 1, 20)) expect(m.bias(m.bias(x, 0.3), 0.7)).toBeCloseTo(x);
  });
  it("the two pairs differ away from the midpoint", () => {
    expect(Math.abs(m.bias(0.25, 0.8) - m.biasPerlin(0.25, 0.8))).toBeGreaterThan(0.05);
  });
});

const curve = (basis: Basis, pts: [number, number][], extra: Partial<Curve> = {}): Curve => ({
  points: pts.map(([x, y]) => ({ x, y, basis })),
  ...extra,
});

describe("curve", () => {
  it("passes through every point for every basis", () => {
    const pts: [number, number][] = [[0, 0], [0.2, 1], [0.7, 0.3], [1, 0.9]];
    for (const b of ["constant", "linear", "monotone", "catmull-rom"] as const) {
      for (const [x, y] of pts) expect(m.evaluate(curve(b, pts), x)).toBeCloseTo(y);
    }
  });
  it("holds the end values outside the points", () => {
    const c = curve("monotone", [[0.2, 0.3], [0.8, 0.9]]);
    expect(m.evaluate(c, -5)).toBe(0.3);
    expect(m.evaluate(c, 5)).toBe(0.9);
  });
  it("monotone never leaves the range of its segment's endpoints", () => {
    const c = curve("monotone", [[0, 0], [0.1, 0.9], [0.15, 1], [0.6, 0.95], [0.65, 0.1], [1, 0]]);
    for (let i = 0; i < c.points.length - 1; i++) {
      const a = c.points[i]!;
      const b = c.points[i + 1]!;
      const lo = Math.min(a.y, b.y) - 1e-12;
      const hi = Math.max(a.y, b.y) + 1e-12;
      for (const x of sweep(a.x, b.x, 50)) {
        const y = m.evaluate(c, x);
        expect(y).toBeGreaterThanOrEqual(lo);
        expect(y).toBeLessThanOrEqual(hi);
      }
    }
  });
  it("monotone data gives a monotone curve", () => {
    const c = curve("monotone", [[0, 0], [0.3, 0.05], [0.4, 0.7], [0.9, 0.71], [1, 1]]);
    let prev = -Infinity;
    for (const x of sweep(0, 1, 500)) {
      const y = m.evaluate(c, x);
      expect(y).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = y;
    }
  });
  it("catmull-rom may overshoot", () => {
    const c = curve("catmull-rom", [[0, 0], [0.45, 1], [0.55, 1], [1, 0]]);
    expect(Math.max(...sweep(0.45, 0.55).map((x) => m.evaluate(c, x)))).toBeGreaterThan(1);
  });
  it("tension is monotone, keeps its ends, and bends the right way", () => {
    for (const k of [-1, -0.3, 0.3, 1]) {
      expect(m.tensionWarp(0, k)).toBeCloseTo(0);
      expect(m.tensionWarp(1, k)).toBeCloseTo(1);
      let prev = -Infinity;
      for (const t of sweep(0, 1, 100)) {
        const w = m.tensionWarp(t, k);
        expect(w).toBeGreaterThanOrEqual(prev);
        prev = w;
      }
    }
    expect(m.tensionWarp(0.5, 1)).toBeLessThan(0.5);
    expect(m.tensionWarp(0.5, -1)).toBeGreaterThan(0.5);
    expect(m.tensionWarp(0.5, 0)).toBe(0.5);
  });
  it("a step takes the later point", () => {
    const c = curve("linear", [[0, 0], [0.5, 0.2], [0.5, 0.8], [1, 1]]);
    expect(m.evaluate(c, 0.5)).toBe(0.8);
  });
  it("sortPoints keeps sustain on its point", () => {
    const c = m.sortPoints({
      points: [
        { x: 0.9, y: 0, basis: "linear" },
        { x: 0, y: 0, basis: "linear" },
        { x: 0.4, y: 0.5, basis: "linear" },
      ],
      sustain: 2,
    });
    expect(c.points.map((p) => p.x)).toEqual([0, 0.4, 0.9]);
    expect(c.sustain).toBe(1);
  });
});

describe("envelope", () => {
  const adsr: Curve = {
    sustain: 2,
    points: [
      { x: 0, y: 0, basis: "linear" },
      { x: 0.1, y: 1, basis: "linear", tension: -0.5 },
      { x: 0.3, y: 0.6, basis: "linear", tension: -0.5 },
      { x: 0.8, y: 0, basis: "linear" },
    ],
  };
  it("holds at sustain while the gate is down", () => {
    expect(m.evaluateEnvelope(adsr, 10)).toBe(0.6);
    expect(m.evaluateEnvelope(adsr, 10, 20)).toBe(0.6);
  });
  it("releases from the level it reached, without a jump", () => {
    for (const r of [0.05, 0.2, 2]) {
      const before = m.evaluateEnvelope(adsr, r - 1e-9, r);
      const after = m.evaluateEnvelope(adsr, r + 1e-9, r);
      expect(after).toBeCloseTo(before, 6);
    }
  });
  it("finishes its release after the release segments' length", () => {
    expect(m.evaluateEnvelope(adsr, 2 + 0.5, 2)).toBeCloseTo(0);
    expect(m.evaluateEnvelope(adsr, 2 + 0.25, 2)).toBeGreaterThan(0);
  });
  it("without sustain is a one-shot", () => {
    const c: Curve = { points: adsr.points };
    expect(m.evaluateEnvelope(c, 0.5, 0.05)).toBe(m.evaluate(c, 0.5));
  });
});

describe("bake", () => {
  it("samples from first to last x and reads back between samples", () => {
    const c = curve("monotone", [[0, 0], [0.5, 0.8], [1, 1]]);
    const lut = m.bake(c, 257);
    expect(lut[0]).toBeCloseTo(0);
    expect(lut[256]).toBeCloseTo(1);
    for (const x of sweep(0, 1, 37)) {
      expect(m.evaluateBaked(lut, 0, 1, x)).toBeCloseTo(m.evaluate(c, x), 4);
    }
    expect(m.evaluateBaked(lut, 0, 1, -1)).toBeCloseTo(0);
  });
});
