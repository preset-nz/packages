import { useState } from "react"
import { Popover } from "@base-ui/react/popover"
import { HexColorPicker } from "react-colorful"
import { cn } from "@/lib/utils"

// After sites/colours' picker: react-colorful in a Base UI popover, square
// corners, the swatch is the trigger. Colours come from the theme tokens.
export function ColorPicker({
  color,
  onChange,
  disabled,
  className,
}: {
  color: string
  onChange: (color: string) => void
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        disabled={disabled}
        className={cn(
          "size-8 shrink-0 border border-border outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        style={{ backgroundColor: color }}
        aria-label={`Pick a colour. Current colour is ${color}.`}
      />
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6} className="z-50">
          <Popover.Popup className="facets-colorful border border-border bg-popover p-3 shadow-md outline-none">
            <HexColorPicker color={color} onChange={onChange} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
