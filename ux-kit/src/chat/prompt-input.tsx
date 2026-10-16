/**
 * Copyright 2023 Vercel, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Adapted from Vercel AI Elements (https://github.com/vercel/ai-elements), prompt-input.tsx.
 * Modified by preset.nz, 2026-10-14: trimmed to a textarea, a toolbar slot and a submit or stop button (no attachments, model select, command menu or provider); own types instead of the `ai` package, ux-kit Textarea and Button, Phosphor icons.
 */
import { ArrowUpIcon, StopIcon } from "@phosphor-icons/react"
import type { ComponentProps, FormEvent, KeyboardEvent, ReactNode } from "react"
import { useState } from "react"

import { Button } from "../components/button"
import { Textarea } from "../components/textarea"
import { cn } from "../lib/utils"
import type { ChatStatus } from "./types"

export type PromptInputProps = Omit<ComponentProps<"form">, "onSubmit"> & {
  /** Called with the trimmed text when the person presses Enter or the send button. */
  onSubmit: (text: string) => void
  /** Called by the stop button, which replaces send while `status` is "streaming". */
  onStop?: () => void
  status?: ChatStatus
  /** The text, if the host holds it (so a suggestion can fill it). Uncontrolled when left out. */
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  /** The toolbar slot, left of the send button: mode toggles, model name, and the like. */
  tools?: ReactNode
  /** Disables typing and sending. The stop button still works. */
  disabled?: boolean
}

/**
 * A message box: Enter sends, Shift+Enter breaks the line (and an IME
 * composition is left alone). While streaming, the send button becomes stop.
 */
export function PromptInput({
  onSubmit,
  onStop,
  status = "idle",
  value,
  onValueChange,
  placeholder = "Ask for a pattern or a change…",
  tools,
  disabled = false,
  className,
  ...props
}: PromptInputProps) {
  const [inner, setInner] = useState("")
  const text = value ?? inner
  const setText = (next: string) => {
    setInner(next)
    onValueChange?.(next)
  }
  const streaming = status === "streaming"
  const canSend = !disabled && !streaming && text.trim().length > 0

  const send = () => {
    if (!canSend) return
    onSubmit(text.trim())
    setText("")
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (streaming) onStop?.()
    else send()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return
    if (event.nativeEvent.isComposing) return
    event.preventDefault()
    send()
  }

  return (
    <form
      data-slot="prompt-input"
      onSubmit={handleSubmit}
      className={cn(
        "flex w-full flex-col gap-1 rounded-md border border-input bg-background p-1.5 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/50 dark:bg-input/30",
        className,
      )}
      {...props}
    >
      <Textarea
        name="message"
        rows={1}
        value={text}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => setText(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
        className="field-sizing-content max-h-40 min-h-9 resize-none border-0 bg-transparent px-1 py-1 focus-visible:ring-0 dark:bg-transparent"
      />
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1">{tools}</div>
        <Button
          type="submit"
          size="icon-sm"
          aria-label={streaming ? "Stop" : "Send"}
          disabled={streaming ? !onStop : !canSend}
        >
          {streaming ? <StopIcon weight="fill" /> : <ArrowUpIcon />}
        </Button>
      </div>
    </form>
  )
}
