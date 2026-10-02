import { Slider as SliderPrimitive } from "@base-ui/react/slider"

import { cn } from "@/lib/utils"

// The facets playground's own Slider: the host contract, on Base UI, square like the apps'.
function Slider({ className, ...props }: SliderPrimitive.Root.Props) {
  return (
    <SliderPrimitive.Root data-slot="slider" thumbAlignment="edge" className={className} {...props}>
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50">
        <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-none bg-muted select-none">
          <SliderPrimitive.Indicator className="h-full bg-primary select-none" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          index={0}
          className={cn(
            "block h-4 w-2 shrink-0 rounded-[1px] border border-primary bg-background select-none focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-hidden",
          )}
        />
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
