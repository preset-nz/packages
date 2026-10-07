import { Slider as SliderPrimitive } from "@base-ui/react/slider"
import * as React from "react"

import { cn } from "../lib/utils"

// Pass a number for one thumb or an array for a range; one thumb per value.
// While a thumb is dragged the slider shows only its own value and ignores incoming `value`
// props (an app that round-trips every change would fight the pointer with stale values); on
// release it re-syncs to the prop. The track and thumb are neutral, not the accent: a slider
// is read at a glance and a coloured fill is noise next to the fields around it.
function Slider({
  className,
  defaultValue,
  value: valueProp,
  onValueChange,
  onValueCommitted,
  min = 0,
  max = 100,
  ...props
}: SliderPrimitive.Root.Props) {
  const [live, setLive] = React.useState<typeof valueProp | null>(null)
  const value = live ?? valueProp
  const _values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min]),
    [value, defaultValue, min],
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      onValueChange={(v, d) => {
        if (valueProp !== undefined) setLive(v)
        onValueChange?.(v, d)
      }}
      onValueCommitted={(v, d) => {
        setLive(null)
        onValueCommitted?.(v, d)
      }}
      min={min}
      max={max}
      thumbAlignment="edge"
      className={cn("data-[orientation=vertical]:h-full", className)}
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-40 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative grow overflow-hidden rounded-none bg-muted select-none data-[orientation=horizontal]:h-1 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-muted-foreground/50 select-none data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            // biome-ignore lint/suspicious/noArrayIndexKey: thumbs are positional; the count is fixed by the value array and they have no identity
            key={index}
            index={index}
            className="block h-4 w-2 shrink-0 rounded-[1px] border border-muted-foreground bg-background ring-ring/50 transition-[color,box-shadow] select-none hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden has-[:focus-visible]:ring-4 data-disabled:pointer-events-none data-disabled:opacity-50"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
