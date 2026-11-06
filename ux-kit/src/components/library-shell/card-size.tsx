import { useId } from "react"

import { cn } from "../../lib/utils"
import { StatusBar, StatusSpacer } from "../status-bar"

/** The card-size slider's range, in px. `CardGrid`'s `cellSize` takes the value. */
const CARD_SIZE = { min: 80, max: 280, step: 10, default: 130 } as const

interface CardSizeSliderProps {
  value: number
  onValueChange: (next: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
}

/** "Size", a range input and the value in px: the card-size control for a status bar. */
function CardSizeSlider({
  value,
  onValueChange,
  min = CARD_SIZE.min,
  max = CARD_SIZE.max,
  step = CARD_SIZE.step,
  className,
}: CardSizeSliderProps) {
  const id = useId()
  return (
    <div data-slot="card-size-slider" className={cn("flex items-center gap-2", className)}>
      <label
        className="font-heading text-[11px] font-semibold tracking-[0.08em] uppercase"
        htmlFor={id}
      >
        Size
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onValueChange(Number(e.target.value))}
        aria-label="Card size"
        className="h-1 w-32 cursor-pointer appearance-none rounded-full bg-border accent-foreground"
      />
      <span className="w-8 text-right tabular-nums">{value}px</span>
    </div>
  )
}

interface LibraryStatusBarProps {
  cardSize: number
  onCardSizeChange: (next: number) => void
  /** The app's own cells (job progress, selection count), drawn before the slider. */
  children?: React.ReactNode
  className?: string
}

/** The kit's `StatusBar` with the card-size slider at the right, in the library look. */
function LibraryStatusBar({
  cardSize,
  onCardSizeChange,
  children,
  className,
}: LibraryStatusBarProps) {
  return (
    <StatusBar className={cn("h-7 bg-card/40 text-[10px] tracking-wide", className)}>
      {children}
      <StatusSpacer />
      <CardSizeSlider value={cardSize} onValueChange={onCardSizeChange} />
    </StatusBar>
  )
}

export type { CardSizeSliderProps, LibraryStatusBarProps }
export { CARD_SIZE, CardSizeSlider, LibraryStatusBar }
