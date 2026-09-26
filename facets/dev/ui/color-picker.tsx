/**
 * A swatch that opens a colour picker. The value is a hex string; the host
 * chooses the picker (the playground and a-color use react-colorful in a Base
 * UI popover). The trigger should read as the swatch itself.
 */
export function ColorPicker(_props: {
  color: string
  onChange: (color: string) => void
  disabled?: boolean
  className?: string
}) {
  return <button type="button" />
}
