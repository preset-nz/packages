import { Progress as ProgressPrimitive } from "@base-ui/react/progress"

import { cn } from "../lib/utils"

type ProgressProps = {
  /** `null` is indeterminate: a slow moving segment, still under `prefers-reduced-motion`. */
  value: number | null
  max?: number
  /** The accessible name; shown above the bar when `showLabel`. */
  label?: string
  showLabel?: boolean
  /** Right-aligned text the caller builds ("12.4 / 44.7 MB", "63%"). The kit does not format it. */
  detail?: string
  className?: string
}

// A 6 px rounded bar that fills its container: `--primary` on `--muted`. No per-state colour:
// a failure is the caller's message, not a red bar.
function Progress({
  value,
  max = 100,
  label,
  showLabel = false,
  detail,
  className,
}: ProgressProps) {
  const labelShown = showLabel && label !== undefined
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      max={max}
      aria-label={labelShown ? undefined : label}
      className={cn("flex w-full flex-col gap-1.5", className)}
    >
      {(labelShown || detail !== undefined) && (
        <div className="flex items-baseline justify-between gap-3 text-xs">
          {labelShown ? (
            <ProgressPrimitive.Label data-slot="progress-label" className="font-medium">
              {label}
            </ProgressPrimitive.Label>
          ) : (
            <span />
          )}
          {detail !== undefined && (
            <span data-slot="progress-detail" className="text-muted-foreground tabular-nums">
              {detail}
            </span>
          )}
        </div>
      )}
      <ProgressPrimitive.Track
        data-slot="progress-track"
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          className="h-full rounded-full bg-primary transition-[width] data-indeterminate:w-2/5 data-indeterminate:animate-[progress-slide_2s_ease-in-out_infinite] data-indeterminate:transition-none motion-reduce:data-indeterminate:animate-none"
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  )
}

// Decimal sizes, one place: bytes under a kilobyte, then kilobytes, megabytes and gigabytes.
// 46_900_000 is "46.9 MB", 1_200_000_000 is "1.2 GB", 2_048 is "2.0 KB", 0 is "0 B".
function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B"
  if (n < 1_000) return `${Math.round(n)} B`
  // Each threshold sits where one place rounds up to 1000.0 of the smaller unit.
  if (n < 999_950) return `${(n / 1_000).toFixed(1)} KB`
  if (n < 999_950_000) return `${(n / 1_000_000).toFixed(1)} MB`
  return `${(n / 1_000_000_000).toFixed(1)} GB`
}

export type { ProgressProps }
export { formatBytes, Progress }
