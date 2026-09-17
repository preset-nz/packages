# Reference primitives — typecheck harness only

`facets` deliberately does not own its form controls: it imports them from the
consumer's `@/components/ui/*`, so each app supplies its own (Oblique uses
Radix, the studio site uses Base UI). That is the whole point of the design, and
it is also why `src/` cannot typecheck on its own.

These files exist so it can. They are **reference stand-ins typed against the
shadcn API**, not the primitives any consumer actually ships. `tsconfig.json`
points `@/components/ui/*` here; `files: ["src"]` keeps the directory out of the
published tarball.

**Type them against the real signatures, not the narrowest thing that compiles.**
`onCheckedChange` really is `(checked: boolean | "indeterminate") => void` in
Radix — that is why `CheckboxRenderer` wraps its argument in `Boolean()`. Narrow
it to `boolean` here and the renderer still compiles while the harness quietly
stops checking the case the code was written for.

The standalone typecheck is the fast signal. The authoritative one is that
Oblique and Strata still compile against the real thing.
