/**
 * MIT License
 *
 * Copyright (c) 2023 shadcn
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Adapted from shadcn/ui's MessageScroller (https://github.com/shadcn-ui/ui),
 * on the headless core in @shadcn/react.
 * Modified by preset.nz, 2026-10-14: one ChatScroller that assembles the parts,
 * Phosphor icon, ux-kit Button, no utilities the kit's stylesheet lacks.
 */

import { ArrowDownIcon } from "@phosphor-icons/react"
import {
  MessageScroller as Primitive,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
} from "@shadcn/react/message-scroller"
import type { ComponentProps } from "react"

import { Button } from "../components/button"
import { cn } from "../lib/utils"

export type ChatScrollerProps = ComponentProps<typeof Primitive.Root> &
  Pick<
    ComponentProps<typeof Primitive.Provider>,
    "autoScroll" | "defaultScrollPosition" | "scrollEdgeThreshold"
  > & {
    /** Classes for the scrolling list inside, which holds the items. */
    contentClassName?: string
    /** Show the jump-to-latest button when scrolled away from the end. Default true. */
    scrollButton?: boolean
  }

/**
 * The conversation's scrolling container. It follows a streamed reply to the
 * end and lets go as soon as the person scrolls up. Fill it with
 * `ChatScrollerItem`s; give it a height (it fills its parent).
 */
export function ChatScroller({
  className,
  contentClassName,
  children,
  autoScroll = true,
  defaultScrollPosition = "end",
  scrollEdgeThreshold,
  scrollButton = true,
  ...props
}: ChatScrollerProps) {
  return (
    <Primitive.Provider
      autoScroll={autoScroll}
      defaultScrollPosition={defaultScrollPosition}
      scrollEdgeThreshold={scrollEdgeThreshold}
    >
      <Primitive.Root
        data-slot="chat-scroller"
        className={cn("relative flex size-full min-h-0 flex-col overflow-hidden", className)}
        {...props}
      >
        <Primitive.Viewport
          data-slot="chat-scroller-viewport"
          className="size-full min-h-0 min-w-0 overflow-y-auto overscroll-contain data-pending-scroll:invisible"
        >
          <Primitive.Content
            data-slot="chat-scroller-content"
            className={cn("flex h-max min-h-full flex-col gap-4 p-3", contentClassName)}
          >
            {children}
          </Primitive.Content>
        </Primitive.Viewport>
        {scrollButton && <ChatScrollerButton />}
      </Primitive.Root>
    </Primitive.Provider>
  )
}

export type ChatScrollerItemProps = ComponentProps<typeof Primitive.Item>

/** One entry in the list. Mark a user turn with `scrollAnchor` to pin the view to it as the reply grows. */
export function ChatScrollerItem({
  className,
  scrollAnchor = false,
  ...props
}: ChatScrollerItemProps) {
  return (
    <Primitive.Item
      data-slot="chat-scroller-item"
      scrollAnchor={scrollAnchor}
      className={cn("min-w-0 shrink-0", className)}
      {...props}
    />
  )
}

export type ChatScrollerButtonProps = Omit<ComponentProps<typeof Primitive.Button>, "render">

/** The jump-to-latest button. `ChatScroller` includes one; use this to place your own. */
export function ChatScrollerButton({
  direction = "end",
  className,
  children,
  ...props
}: ChatScrollerButtonProps) {
  return (
    <Primitive.Button
      data-slot="chat-scroller-button"
      data-direction={direction}
      direction={direction}
      render={<Button variant="outline" size="icon-sm" />}
      className={cn(
        "absolute left-1/2 -translate-x-1/2 transition-[translate,scale,opacity] duration-200 data-[active=false]:pointer-events-none data-[active=false]:scale-95 data-[active=false]:opacity-0 data-[direction=end]:bottom-3 data-[direction=start]:top-3 data-[direction=start]:[&_svg]:rotate-180",
        className,
      )}
      {...props}
    >
      {children ?? (
        <>
          <ArrowDownIcon />
          <span className="sr-only">
            {direction === "end" ? "Jump to latest" : "Jump to start"}
          </span>
        </>
      )}
    </Primitive.Button>
  )
}

export { useMessageScroller, useMessageScrollerScrollable, useMessageScrollerVisibility }
