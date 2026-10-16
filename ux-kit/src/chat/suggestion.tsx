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
 * Adapted from Vercel AI Elements (https://github.com/vercel/ai-elements), suggestion.tsx.
 * Modified by preset.nz, 2026-10-14: own Button and a plain scrolling row instead of ScrollArea, ux-kit tokens.
 */
import type { ComponentProps } from "react"

import { Button } from "../components/button"
import { cn } from "../lib/utils"

export type SuggestionsProps = ComponentProps<"div">

/** A row of starter prompts. Scrolls sideways when it does not fit. */
export function Suggestions({ className, ...props }: SuggestionsProps) {
  return (
    <div
      data-slot="suggestions"
      className={cn("flex w-full flex-nowrap items-center gap-2 overflow-x-auto pb-1", className)}
      {...props}
    />
  )
}

export type SuggestionProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  /** The text handed to `onClick`. Shown too, unless children are given. */
  suggestion: string
  onClick?: (suggestion: string) => void
}

export function Suggestion({
  suggestion,
  onClick,
  className,
  variant = "outline",
  size = "sm",
  children,
  ...props
}: SuggestionProps) {
  return (
    <Button
      data-slot="suggestion"
      type="button"
      variant={variant}
      size={size}
      className={cn("shrink-0 rounded-full normal-case tracking-normal", className)}
      onClick={() => onClick?.(suggestion)}
      {...props}
    >
      {children || suggestion}
    </Button>
  )
}
