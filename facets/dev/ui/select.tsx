import type * as React from "react"

/** Radix `Select.Root` — value is always a string; there is no multi-select. */
export function Select({
  children,
}: {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  children?: React.ReactNode
}) {
  return <div>{children}</div>
}

export function SelectTrigger(props: React.ComponentProps<"button">) {
  return <button type="button" {...props} />
}

export function SelectValue({
  placeholder: _placeholder,
  ...props
}: React.ComponentProps<"span"> & { placeholder?: string }) {
  return <span {...props} />
}

export function SelectContent(props: React.ComponentProps<"div">) {
  return <div {...props} />
}

export function SelectItem({
  value: _value,
  ...props
}: Omit<React.ComponentProps<"div">, "value"> & { value: string }) {
  return <div {...props} />
}
