import { describe, expect, it } from "vitest"
import { isDisabled } from "../../src"

describe("isDisabled", () => {
  const values = { hairline: true, lineStyle: "solid", mode: "auto" }

  it("holds for one condition as before", () => {
    expect(isDisabled({ path: "mode", equals: "auto" }, values)).toBe(true)
    expect(isDisabled({ path: "mode", notEquals: "auto" }, values)).toBe(false)
    expect(isDisabled({ path: "lineStyle", in: ["dashed", "dotted"] }, values)).toBe(false)
    expect(isDisabled({ path: "lineStyle", notIn: ["dashed"] }, values)).toBe(true)
    expect(isDisabled(undefined, values)).toBe(false)
  })

  it("holds for a list when any condition does", () => {
    const either = [
      { path: "hairline", equals: true },
      { path: "lineStyle", notEquals: "solid" },
    ]
    expect(isDisabled(either, values)).toBe(true)
    expect(isDisabled(either, { ...values, hairline: false })).toBe(false)
    expect(isDisabled(either, { hairline: false, lineStyle: "dashed" })).toBe(true)
  })

  it("never holds for an empty list", () => {
    expect(isDisabled([], values)).toBe(false)
  })
})
