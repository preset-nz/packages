import { useEffect, useState } from "react"

const TEXT_INPUT_TYPES = new Set(["", "text", "search", "url", "email", "tel", "password", "number"])

/** True for elements that have their own typing undo: text inputs, textareas, contenteditable. */
export function isTextField(el: EventTarget | Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled
  if (el instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(el.type) && !el.readOnly && !el.disabled
  return el.isContentEditable
}

/**
 * Whether an editable text field has focus in this window. Apps with a custom Edit > Undo
 * use it to route Cmd+Z to the field's typing (`document.execCommand("undo")`) instead of
 * the document. Checkbox, colour, range and other non-text inputs do not count.
 */
export function useTextFocus(): boolean {
  const [focused, setFocused] = useState(() => isTextField(document.activeElement))
  useEffect(() => {
    const onIn = (e: FocusEvent) => setFocused(isTextField(e.target))
    const onOut = (e: FocusEvent) => setFocused(isTextField(e.relatedTarget))
    // The window losing focus keeps document.activeElement; the menu must not treat it as typing.
    const onWinBlur = () => setFocused(false)
    const onWinFocus = () => setFocused(isTextField(document.activeElement))
    document.addEventListener("focusin", onIn)
    document.addEventListener("focusout", onOut)
    window.addEventListener("blur", onWinBlur)
    window.addEventListener("focus", onWinFocus)
    return () => {
      document.removeEventListener("focusin", onIn)
      document.removeEventListener("focusout", onOut)
      window.removeEventListener("blur", onWinBlur)
      window.removeEventListener("focus", onWinFocus)
    }
  }, [])
  return focused
}
