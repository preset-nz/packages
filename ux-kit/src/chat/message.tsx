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
 * Adapted from Vercel AI Elements (https://github.com/vercel/ai-elements), message.tsx.
 * Modified by preset.nz, 2026-10-14: own types instead of the `ai` package, no branching or actions, markdown through streamdown core only, ux-kit tokens.
 */
import type { ComponentProps, HTMLAttributes } from "react"
import { memo } from "react"
import { Streamdown } from "streamdown"

import { cn } from "../lib/utils"
import type { ChatRole } from "./types"

export type ChatMessageProps = HTMLAttributes<HTMLDivElement> & {
  from: ChatRole
}

/** One turn. A user turn sits right in a bubble; an assistant turn runs the full width. */
export function ChatMessage({ className, from, ...props }: ChatMessageProps) {
  return (
    <div
      data-slot="chat-message"
      data-from={from}
      className={cn(
        "group flex w-full max-w-[95%] flex-col gap-2",
        from === "user" ? "is-user ml-auto justify-end" : "is-assistant",
        className,
      )}
      {...props}
    />
  )
}

export type ChatMessageContentProps = HTMLAttributes<HTMLDivElement>

export function ChatMessageContent({ className, ...props }: ChatMessageContentProps) {
  return (
    <div
      data-slot="chat-message-content"
      className={cn(
        "flex w-fit min-w-0 max-w-full flex-col gap-2 overflow-hidden text-xs text-foreground",
        "group-[.is-user]:ml-auto group-[.is-user]:rounded-md group-[.is-user]:bg-secondary group-[.is-user]:px-3 group-[.is-user]:py-2",
        className,
      )}
      {...props}
    />
  )
}

export type ChatMarkdownProps = ComponentProps<typeof Streamdown>

/**
 * Markdown that tolerates half-written input, for streamed text. Pass
 * `isAnimating` while the text is still arriving. Streamdown core only: code
 * blocks are plain, with no highlighting, diagrams or maths.
 */
export const ChatMarkdown = memo(
  function ChatMarkdown({ className, ...props }: ChatMarkdownProps) {
    return (
      <Streamdown
        className={cn("size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}
        {...props}
      />
    )
  },
  (prev, next) => prev.children === next.children && next.isAnimating === prev.isAnimating,
)
