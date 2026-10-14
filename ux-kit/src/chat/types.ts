/** Who a message is from. */
export type ChatRole = "user" | "assistant"

/** Where a tool call is: still running, finished, or declined by the host. */
export type ToolCallState = "running" | "done" | "refused"

/** What the conversation is doing. The host owns it; the components only read it. */
export type ChatStatus = "idle" | "streaming" | "stopped" | "error"
