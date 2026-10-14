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
 * Adapted from Vercel AI Elements (https://github.com/vercel/ai-elements), reasoning.tsx.
 * Modified by preset.nz, 2026-10-14: own state instead of Radix's useControllableState, Base UI Collapsible, CSS shimmer instead of motion, streamdown core only, Phosphor icons, NZ English strings.
 */
import { Collapsible } from "@base-ui/react/collapsible"
import { BrainIcon, CaretDownIcon } from "@phosphor-icons/react"
import type { ReactNode } from "react"
import { createContext, memo, useContext, useEffect, useMemo, useRef, useState } from "react"
import { Streamdown } from "streamdown"

import { cn } from "../lib/utils"

type ReasoningContextValue = {
  isStreaming: boolean
  isOpen: boolean
  duration: number | undefined
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null)

function useReasoning() {
  const context = useContext(ReasoningContext)
  if (!context) throw new Error("Reasoning parts must sit inside <Reasoning>")
  return context
}

export type ReasoningProps = Omit<Collapsible.Root.Props, "open" | "defaultOpen"> & {
  /** True while the thinking is still arriving. Opens the block, and folds it again a moment after it ends. */
  isStreaming?: boolean
  open?: boolean
  defaultOpen?: boolean
  /** Seconds spent thinking. Measured from `isStreaming` when not given. */
  duration?: number
}

const AUTO_CLOSE_DELAY = 1000

/** A folded "Thinking…" block. */
export const Reasoning = memo(function Reasoning({
  className,
  isStreaming = false,
  open,
  defaultOpen,
  onOpenChange,
  duration: durationProp,
  children,
  ...props
}: ReasoningProps) {
  const [innerOpen, setInnerOpen] = useState(defaultOpen ?? isStreaming)
  const [measured, setMeasured] = useState<number | undefined>(undefined)
  const isOpen = open ?? innerOpen
  const duration = durationProp ?? measured

  const everStreamed = useRef(isStreaming)
  const autoClosed = useRef(false)
  const startedAt = useRef<number | null>(null)

  // A host that passes `open` owns it; the automatic open and fold only run when it does not.
  const uncontrolled = open === undefined
  const setAuto = (next: boolean) => setInnerOpen(next)
  const setAutoRef = useRef(setAuto)
  setAutoRef.current = setAuto

  useEffect(() => {
    if (isStreaming) {
      everStreamed.current = true
      startedAt.current ??= Date.now()
      if (uncontrolled && defaultOpen !== false && !isOpen) setAutoRef.current(true)
    } else if (startedAt.current !== null) {
      setMeasured(Math.ceil((Date.now() - startedAt.current) / 1000))
      startedAt.current = null
    }
  }, [isStreaming, isOpen, defaultOpen, uncontrolled])

  useEffect(() => {
    if (!uncontrolled || !everStreamed.current || isStreaming || !isOpen || autoClosed.current) {
      return
    }
    const timer = setTimeout(() => {
      autoClosed.current = true
      setAutoRef.current(false)
    }, AUTO_CLOSE_DELAY)
    return () => clearTimeout(timer)
  }, [isStreaming, isOpen, uncontrolled])

  const value = useMemo(() => ({ duration, isOpen, isStreaming }), [duration, isOpen, isStreaming])

  return (
    <ReasoningContext.Provider value={value}>
      <Collapsible.Root
        data-slot="reasoning"
        className={cn("w-full", className)}
        open={isOpen}
        onOpenChange={(next, details) => {
          setInnerOpen(next)
          onOpenChange?.(next, details)
        }}
        {...props}
      >
        {children}
      </Collapsible.Root>
    </ReasoningContext.Provider>
  )
})

function defaultThinkingMessage(isStreaming: boolean, duration?: number): ReactNode {
  if (isStreaming || duration === 0) return <span className="shimmer">Thinking…</span>
  if (duration === undefined) return <span>Thought for a few seconds</span>
  return <span>Thought for {duration} seconds</span>
}

export type ReasoningTriggerProps = Collapsible.Trigger.Props & {
  getThinkingMessage?: (isStreaming: boolean, duration?: number) => ReactNode
}

export const ReasoningTrigger = memo(function ReasoningTrigger({
  className,
  children,
  getThinkingMessage = defaultThinkingMessage,
  ...props
}: ReasoningTriggerProps) {
  const { isStreaming, isOpen, duration } = useReasoning()
  return (
    <Collapsible.Trigger
      data-slot="reasoning-trigger"
      className={cn(
        "flex w-full items-center gap-2 text-xs text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    >
      {children ?? (
        <>
          <BrainIcon className="size-3.5" />
          {getThinkingMessage(isStreaming, duration)}
          <CaretDownIcon
            className={cn("size-3.5 transition-transform", isOpen ? "rotate-180" : "rotate-0")}
          />
        </>
      )}
    </Collapsible.Trigger>
  )
})

export type ReasoningContentProps = Omit<Collapsible.Panel.Props, "children"> & {
  /** The thinking so far, as markdown. */
  children: string
}

export const ReasoningContent = memo(function ReasoningContent({
  className,
  children,
  ...props
}: ReasoningContentProps) {
  const { isStreaming } = useReasoning()
  return (
    <Collapsible.Panel
      data-slot="reasoning-content"
      className={cn(
        "mt-2 border-l border-border pl-3 text-xs text-muted-foreground outline-none",
        className,
      )}
      {...props}
    >
      <Streamdown isAnimating={isStreaming}>{children}</Streamdown>
    </Collapsible.Panel>
  )
})
