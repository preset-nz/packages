import { useEffect, useRef } from "react"
import { invoke } from "@tauri-apps/api/core"
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow"

import type { Command } from "../commands"

/**
 * Connects the command table to the native menu: menu items arrive as `command` events
 * carrying the command id, and enabled/checked state goes back with `menu_state`.
 * Undo and redo are left to Rust, which sets their titles from the tree's history.
 */
export function useMenuSync(commands: Command[]) {
  const latest = useRef(commands)
  latest.current = commands

  useEffect(() => {
    const un = getCurrentWebviewWindow().listen<string>("command", (e) => {
      const c = latest.current.find((x) => x.id === e.payload)
      if (c?.enabled) c.run()
    })
    return () => {
      un.then((f) => f())
    }
  }, [])

  const key = JSON.stringify(commands.map((c) => [c.id, c.enabled, c.pressed]))
  useEffect(() => {
    const states = latest.current
      .filter((c) => !c.id.startsWith("edit."))
      .map((c) => ({ id: c.id, enabled: c.enabled, checked: c.pressed }))
    invoke("menu_state", { states }).catch(() => {})
  }, [key])
}
