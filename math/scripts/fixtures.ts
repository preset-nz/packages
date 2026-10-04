/**
 * Writes fixtures/scalars.json and fixtures/curves.json from the TypeScript
 * reference. Both test suites read them: Rust checks it computes the same
 * numbers, TypeScript that nothing moved by accident. Run `just fixtures`
 * and review the diff; a moved value is a behaviour change.
 */
import { writeFileSync } from "node:fs";
import * as m from "../src-ts/index.ts";
import type { Curve } from "../src-ts/index.ts";

type ScalarCase = { fn: string; args: number[]; expected: number };

const scalarFns: Record<string, (...a: number[]) => number> = {
  lerp: m.lerp,
  invlerp: m.invlerp,
  clamp: m.clamp,
  fit: m.fit,
  fitUnclamped: m.fitUnclamped,
  smooth: m.smooth,
  bias: m.bias,
  gain: m.gain,
  biasPerlin: m.biasPerlin,
  gainPerlin: m.gainPerlin,
};

const scalarArgs: Record<string, number[][]> = {
  lerp: [[0, 10, 0.3], [5, -5, 0.5], [0, 1, 1.5], [0, 1, -0.5]],
  invlerp: [[3, 0, 10], [0.5, 1, 0], [15, 0, 10], [2, 2, 2]],
  clamp: [[-1, 0, 1], [0.4, 0, 1], [7, 0, 1]],
  fit: [[0.3, 0, 1, 10, 20], [2, 0, 1, 10, 20], [-1, 0, 1, 10, 20], [5, 10, 0, 0, 1], [3, 3, 3, 0, 10]],
  fitUnclamped: [[2, 0, 1, 10, 20], [-1, 0, 1, 10, 20], [0.25, 0, 1, 1, 0]],
  smooth: [[0, 1, -0.1], [0, 1, 0.25], [0, 1, 0.5], [0, 1, 0.75], [2, 4, 5], [1, 1, 1]],
  bias: [[0.5, 0.5], [0.25, 0.8], [0.25, 0.2], [0, 0.3], [1, 0.3], [0.6, 0], [0.6, 1]],
  gain: [[0.25, 0.5], [0.25, 0.8], [0.1, 0.8], [0.75, 0.8], [0.9, 0.2], [0.5, 0.9]],
  biasPerlin: [[0.5, 0.5], [0.25, 0.8], [0.25, 0.2], [0, 0.3], [0.6, 0], [0.6, 1]],
  gainPerlin: [[0.25, 0.5], [0.25, 0.8], [0.1, 0.8], [0.75, 0.8], [0.9, 0.2]],
};

const scalars: ScalarCase[] = Object.entries(scalarArgs).flatMap(([fn, cases]) =>
  cases.map((args) => ({ fn, args, expected: scalarFns[fn]!(...args) })),
);

type CurveCase = {
  name: string;
  curve: Curve;
  samples: { x: number; y: number }[];
  envelope?: { t: number; release: number | null; y: number }[];
};

const curves: { name: string; curve: Curve; xs: number[]; env?: [number, number | null][] }[] = [
  {
    name: "single point",
    curve: { points: [{ x: 0.5, y: 0.7, basis: "linear" }] },
    xs: [-1, 0.5, 2],
  },
  {
    name: "linear ramp",
    curve: { points: [{ x: 0, y: 0, basis: "linear" }, { x: 1, y: 1, basis: "linear" }] },
    xs: [-0.5, 0, 0.25, 0.5, 1, 1.5],
  },
  {
    name: "constant steps",
    curve: {
      points: [
        { x: 0, y: 0.2, basis: "constant" },
        { x: 0.5, y: 0.6, basis: "constant" },
        { x: 1, y: 1, basis: "constant" },
      ],
    },
    xs: [0, 0.49, 0.5, 0.99, 1],
  },
  {
    name: "duplicate x is a step",
    curve: {
      points: [
        { x: 0, y: 0, basis: "linear" },
        { x: 0.5, y: 0.5, basis: "linear" },
        { x: 0.5, y: 1, basis: "linear" },
        { x: 1, y: 0, basis: "linear" },
      ],
    },
    xs: [0.25, 0.4999, 0.5, 0.75],
  },
  {
    name: "tension",
    curve: {
      points: [
        { x: 0, y: 0, basis: "linear", tension: 1 },
        { x: 1, y: 1, basis: "linear", tension: -0.5 },
        { x: 2, y: 0, basis: "linear" },
      ],
    },
    xs: [0.25, 0.5, 0.75, 1.25, 1.5, 1.75],
  },
  {
    name: "monotone transfer",
    curve: {
      points: [
        { x: 0, y: 0, basis: "monotone" },
        { x: 0.25, y: 0.1, basis: "monotone" },
        { x: 0.5, y: 0.6, basis: "monotone" },
        { x: 0.75, y: 0.62, basis: "monotone" },
        { x: 1, y: 1, basis: "monotone" },
      ],
    },
    xs: [0.1, 0.2, 0.3, 0.4, 0.55, 0.6, 0.7, 0.8, 0.9],
  },
  {
    name: "monotone peak",
    curve: {
      points: [
        { x: 0, y: 0, basis: "monotone" },
        { x: 0.3, y: 1, basis: "monotone" },
        { x: 1, y: 0.2, basis: "monotone" },
      ],
    },
    xs: [0.1, 0.25, 0.35, 0.6, 0.9],
  },
  {
    name: "catmull-rom uneven",
    curve: {
      points: [
        { x: 0, y: 0, basis: "catmull-rom" },
        { x: 0.2, y: 1, basis: "catmull-rom" },
        { x: 0.7, y: 0.3, basis: "catmull-rom" },
        { x: 1, y: 0.9, basis: "catmull-rom" },
      ],
    },
    xs: [0.05, 0.1, 0.3, 0.5, 0.65, 0.8, 0.95],
  },
  {
    name: "mixed bases",
    curve: {
      points: [
        { x: 0, y: 0, basis: "linear" },
        { x: 0.3, y: 0.5, basis: "monotone" },
        { x: 0.6, y: 0.4, basis: "catmull-rom" },
        { x: 0.8, y: 0.9, basis: "constant" },
        { x: 1, y: 1, basis: "linear" },
      ],
    },
    xs: [0.15, 0.4, 0.5, 0.7, 0.9, 1],
  },
  {
    name: "adsr",
    curve: {
      sustain: 2,
      points: [
        { x: 0, y: 0, basis: "linear", tension: -0.4 },
        { x: 0.1, y: 1, basis: "linear", tension: -0.6 },
        { x: 0.3, y: 0.6, basis: "linear", tension: -0.6 },
        { x: 0.8, y: 0, basis: "linear" },
      ],
    },
    xs: [0.05, 0.2, 0.3, 0.5],
    env: [
      [0.05, null],
      [0.2, null],
      [0.3, null],
      [5, null],
      [1, 1],
      [1.2, 1],
      [1.6, 1],
      [0.05, 0.05],
      [0.2, 0.05],
      [0.6, 0.05],
      [0.2, 0.2],
      [0.4, 0.2],
    ],
  },
  {
    name: "sustain on last point",
    curve: {
      sustain: 1,
      points: [
        { x: 0, y: 0, basis: "monotone" },
        { x: 0.5, y: 0.8, basis: "monotone" },
      ],
    },
    xs: [0.25],
    env: [
      [0.25, null],
      [0.25, 0.25],
      [3, 0.25],
      [3, 1],
    ],
  },
];

const curveCases: CurveCase[] = curves.map(({ name, curve, xs, env }) => ({
  name,
  curve,
  samples: xs.map((x) => ({ x, y: m.evaluate(curve, x) })),
  ...(env && {
    envelope: env.map(([t, release]) => ({
      t,
      release,
      y: m.evaluateEnvelope(curve, t, release ?? undefined),
    })),
  }),
}));

const write = (file: string, data: unknown) =>
  writeFileSync(new URL(`../fixtures/${file}`, import.meta.url), `${JSON.stringify(data, null, 2)}\n`);

write("scalars.json", { tolerance: 1e-5, cases: scalars });
write("curves.json", { tolerance: 1e-5, cases: curveCases });
console.log(`fixtures: ${scalars.length} scalar cases, ${curveCases.length} curves`);
