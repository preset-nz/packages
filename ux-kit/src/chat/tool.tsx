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
 * Adapted from Vercel AI Elements (https://github.com/vercel/ai-elements), tool.tsx.
 * Modified by preset.nz, 2026-10-14: own types instead of the `ai` package, Base UI Collapsible, Phosphor icons, no code-block dependency.
 */
import { Collapsible } from "@base-ui/react/collapsible"
import {
  CaretDownIcon,
  CheckCircleIcon,
  ClockIcon,
  ProhibitIcon,
  WrenchIcon,
} from "@phosphor-icons/react"
import type { ComponentProps, ReactNode } from "react"

import { cn } from "../lib/utils"
import type { ToolCallState } from "./types"

const STATE_LABELS: Record<ToolCallState, string> = {
  running: "Running",
  done: "Done",
  refused: "Refused",
}

const STATE_ICONS: Record<ToolCallState, ReactNode> = {
  running: <ClockIcon className="size-3.5 animate-pulse" />,
  done: <CheckCircleIcon className="size-3.5" weight="fill" />,
  refused: <ProhibitIcon className="size-3.5 text-destructive" weight="fill" />,
}

export type ToolCallProps = Collapsible.Root.Props

/** A collapsible row for one tool call: a header that always shows, a body that folds. */
export function ToolCall({ className, ...props }: ToolCallProps) {
  return (
    <Collapsible.Root
      data-slot="tool-call"
      className={cn("group w-full rounded-md border border-border", className)}
      {...props}
    />
  )
}

export type ToolCallHeaderProps = Omit<Collapsible.Trigger.Props, "children"> & {
  /** The tool's name, as the model called it. */
  name: string
  state: ToolCallState
}

export function ToolCallHeader({ className, name, state, ...props }: ToolCallHeaderProps) {
  return (
    <Collapsible.Trigger
      data-slot="tool-call-header"
      className={cn(
        "flex w-full items-center justify-between gap-2 p-2 text-left outline-none focus-visible:ring-1 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    >
      <span className="flex min-w-0 items-center gap-2">
        <WrenchIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate font-mono text-xs font-medium">{name}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        {STATE_ICONS[state]}
        {STATE_LABELS[state]}
        <CaretDownIcon className="size-3.5 transition-transform group-data-[open]:rotate-180" />
      </span>
    </Collapsible.Trigger>
  )
}

export type ToolCallContentProps = Collapsible.Panel.Props

export function ToolCallContent({ className, ...props }: ToolCallContentProps) {
  return (
    <Collapsible.Panel
      data-slot="tool-call-content"
      className={cn("space-y-3 p-2 pt-0 text-popover-foreground outline-none", className)}
      {...props}
    />
  )
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2)
}

export type ToolCallInputProps = ComponentProps<"div"> & {
  /** The arguments the model sent. Objects are shown as JSON. */
  input: unknown
}

export function ToolCallInput({ className, input, ...props }: ToolCallInputProps) {
  return (
    <div className={cn("space-y-1.5 overflow-hidden", className)} {...props}>
      <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Arguments
      </h4>
      <pre className="overflow-x-auto rounded-sm bg-muted/50 p-2 font-mono text-xs">
        {asText(input)}
      </pre>
    </div>
  )
}

export type ToolCallOutputProps = ComponentProps<"div"> & {
  output?: unknown
  /** Set when the call failed or was refused; shown in place of the output. */
  errorText?: string
}

export function ToolCallOutput({ className, output, errorText, ...props }: ToolCallOutputProps) {
  if (output === undefined && !errorText) return null
  return (
    <div className={cn("space-y-1.5", className)} {...props}>
      <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {errorText ? "Error" : "Result"}
      </h4>
      <pre
        className={cn(
          "overflow-x-auto rounded-sm p-2 font-mono text-xs",
          errorText ? "bg-destructive/10 text-destructive" : "bg-muted/50 text-foreground",
        )}
      >
        {errorText ?? asText(output)}
      </pre>
    </div>
  )
}
