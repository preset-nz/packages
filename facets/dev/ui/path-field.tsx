import type * as React from "react"

/** Typed to ux-kit's `PathField`, narrowed to the props facets passes. */
export interface PathFieldProps
  extends Omit<React.ComponentProps<"div">, "onChange" | "defaultValue"> {
  /** The path as written, relative or absolute. `null` is empty. */
  value: string | null
  /** Return or blur with changed text: the trimmed text, or null when empty. Without it the field is read-only. */
  onCommit?: (path: string | null) => void
  /** Recent paths, newest first, for the ▾ list. Empty disables the ▾. */
  recent?: string[]
  /** Opens the native file dialog. A resolved path is committed; null (cancelled) does nothing. */
  onBrowse?: () => Promise<string | null>
  /** "missing": the path in the warning tone. "invalid": the field is marked and `message` shown. */
  status?: "ok" | "missing" | "invalid"
  /** Why the path was refused; shown when `status` is "invalid". */
  message?: string
  label?: string
  placeholder?: string
  disabled?: boolean
}

export function PathField({
  value,
  onCommit,
  recent,
  onBrowse,
  status,
  message,
  label,
  placeholder,
  disabled,
  id,
  ...props
}: PathFieldProps) {
  return (
    <div {...props}>
      <input
        id={id}
        aria-label={label}
        value={value ?? ""}
        placeholder={placeholder}
        readOnly={!onCommit}
        disabled={disabled}
        aria-invalid={status === "invalid" || undefined}
        onChange={(e) => onCommit?.(e.target.value || null)}
      />
      {status === "missing" ? <span>Missing</span> : null}
      {status === "invalid" ? <p>{message}</p> : null}
      {recent?.map((p) => (
        <button key={p} type="button" onClick={() => onCommit?.(p)}>
          {p}
        </button>
      ))}
      {onBrowse ? <button type="button" onClick={() => void onBrowse()} /> : null}
    </div>
  )
}
