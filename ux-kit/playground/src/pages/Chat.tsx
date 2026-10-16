import { Icons, ToggleGroup, ToggleGroupItem, TooltipProvider } from "@preset.nz/ux-kit"
import {
  ChatMarkdown,
  ChatMessage,
  ChatMessageContent,
  ChatScroller,
  ChatScrollerItem,
  type ChatStatus,
  PromptInput,
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
  Suggestion,
  Suggestions,
  ToolCall,
  ToolCallContent,
  ToolCallHeader,
  ToolCallInput,
  ToolCallOutput,
  type ToolCallState,
} from "@preset.nz/ux-kit/chat"
import { useEffect, useRef, useState } from "react"

const THINKING =
  "The person wants a steady kick. A four-on-the-floor pattern on the first track, then check the tempo before adding hats."

const REPLY = `Done. I put a **kick on every beat** and left the rest empty:

- Track 1: kick, steps 1, 5, 9, 13
- Tempo stays at 120 BPM

\`\`\`json
{ "steps": [1, 5, 9, 13] }
\`\`\`

Say if you want hats next.`

type Turn = {
  id: number
  from: "user" | "assistant"
  text: string
  thinking?: string
  tools?: { name: string; state: ToolCallState; input: unknown; output?: string; error?: string }[]
}

type Mode = "quick" | "considered"

/** A fake streamed conversation in the width the side column will have. */
export function ChatPage() {
  const [turns, setTurns] = useState<Turn[]>([])
  const [status, setStatus] = useState<ChatStatus>("idle")
  const [mode, setMode] = useState<Mode>("quick")
  const [draft, setDraft] = useState("")
  const timer = useRef<number | undefined>(undefined)
  const nextId = useRef(1)

  useEffect(() => () => window.clearInterval(timer.current), [])

  const patchLast = (change: (turn: Turn) => Turn) =>
    setTurns((all) => all.map((turn, index) => (index === all.length - 1 ? change(turn) : turn)))

  const send = (text: string) => {
    const reply: Turn = { id: nextId.current + 1, from: "assistant", text: "" }
    setTurns((all) => [...all, { id: nextId.current, from: "user", text }, reply])
    nextId.current += 2
    setStatus("streaming")

    // Script: thinking, a tool call that runs then finishes, one that is refused, then text.
    let tick = 0
    let chars = 0
    window.clearInterval(timer.current)
    timer.current = window.setInterval(() => {
      tick += 1
      if (tick === 2) patchLast((turn) => ({ ...turn, thinking: THINKING }))
      if (tick === 6) {
        patchLast((turn) => ({
          ...turn,
          tools: [
            { name: "set_steps", state: "running", input: { track: 1, steps: [1, 5, 9, 13] } },
          ],
        }))
      }
      if (tick === 12) {
        patchLast((turn) => ({
          ...turn,
          tools: [
            {
              name: "set_steps",
              state: "done",
              input: { track: 1, steps: [1, 5, 9, 13] },
              output: "ok",
            },
            {
              name: "delete_track",
              state: "refused",
              input: { track: 2 },
              error: "Deleting a track is not something I can do from here.",
            },
          ],
        }))
      }
      if (tick > 14) {
        chars = Math.min(REPLY.length, chars + 6)
        patchLast((turn) => ({ ...turn, text: REPLY.slice(0, chars) }))
        if (chars >= REPLY.length) {
          window.clearInterval(timer.current)
          setStatus("idle")
        }
      }
    }, 120)
  }

  const stop = () => {
    window.clearInterval(timer.current)
    setStatus("stopped")
  }

  const streaming = status === "streaming"

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <h2 className="text-sm font-medium">Chat</h2>
      <p className="text-xs text-muted-foreground">
        A fake stream at the width of the side column (320 px). Send a message, or pick a
        suggestion.
      </p>
      <TooltipProvider>
        <div className="flex h-[560px] w-80 flex-col border border-border bg-background">
          <ChatScroller className="min-h-0 flex-1" aria-label="Conversation">
            {turns.map((turn, index) => (
              <ChatScrollerItem
                key={turn.id}
                messageId={String(turn.id)}
                scrollAnchor={turn.from === "user"}
              >
                <ChatMessage from={turn.from}>
                  {turn.thinking && (
                    <Reasoning isStreaming={streaming && index === turns.length - 1 && !turn.text}>
                      <ReasoningTrigger />
                      <ReasoningContent>{turn.thinking}</ReasoningContent>
                    </Reasoning>
                  )}
                  {turn.tools?.map((tool) => (
                    <ToolCall key={tool.name}>
                      <ToolCallHeader name={tool.name} state={tool.state} />
                      <ToolCallContent>
                        <ToolCallInput input={tool.input} />
                        <ToolCallOutput output={tool.output} errorText={tool.error} />
                      </ToolCallContent>
                    </ToolCall>
                  ))}
                  {(turn.from === "user" || turn.text) && (
                    <ChatMessageContent>
                      {turn.from === "user" ? (
                        turn.text
                      ) : (
                        <ChatMarkdown isAnimating={streaming && index === turns.length - 1}>
                          {turn.text}
                        </ChatMarkdown>
                      )}
                    </ChatMessageContent>
                  )}
                </ChatMessage>
              </ChatScrollerItem>
            ))}
          </ChatScroller>
          <div className="flex flex-col gap-2 border-t border-border p-2">
            {turns.length === 0 && (
              <Suggestions>
                <Suggestion suggestion="Four on the floor" onClick={setDraft} />
                <Suggestion suggestion="Slow it down" onClick={setDraft} />
              </Suggestions>
            )}
            <PromptInput
              value={draft}
              onValueChange={setDraft}
              onSubmit={send}
              onStop={stop}
              status={status}
              tools={
                <ToggleGroup
                  size="sm"
                  spacing={0}
                  variant="outline"
                  value={[mode]}
                  onValueChange={(next) => next[0] && setMode(next[0] as Mode)}
                >
                  <ToggleGroupItem value="quick">Quick</ToggleGroupItem>
                  <ToggleGroupItem value="considered">Considered</ToggleGroupItem>
                </ToggleGroup>
              }
            />
          </div>
        </div>
      </TooltipProvider>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icons.InfoIcon className="size-3.5" /> Status: {status}, mode: {mode}
      </p>
    </div>
  )
}
