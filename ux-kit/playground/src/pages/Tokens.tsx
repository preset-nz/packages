import { Button, Icons } from "@preset.nz/ux-kit"

const TOKENS = [
  "background", "foreground", "card", "card-foreground", "popover", "popover-foreground",
  "primary", "primary-foreground", "secondary", "secondary-foreground",
  "muted", "muted-foreground", "accent", "accent-foreground", "destructive",
  "border", "input", "ring",
  "chart-1", "chart-2", "chart-3", "chart-4", "chart-5",
  "sidebar", "sidebar-foreground", "sidebar-primary", "sidebar-primary-foreground",
  "sidebar-accent", "sidebar-accent-foreground", "sidebar-border", "sidebar-ring",
]

export function Tokens({ dark, onToggleTheme }: { dark: boolean; onToggleTheme: () => void }) {
  return (
    <section>
      <header className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold">Tokens</h1>
        <Button variant="outline" onClick={onToggleTheme}>
          {dark ? <Icons.SunIcon /> : <Icons.MoonIcon />}
          {dark ? "Light" : "Dark"}
        </Button>
      </header>
      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
        {TOKENS.map((name) => (
          <div key={name} className="overflow-hidden rounded-md border border-border">
            <div className="h-14" style={{ background: `var(--${name})` }} />
            <div className="px-2 py-1.5 font-mono text-xs">--{name}</div>
          </div>
        ))}
      </div>
      <h2 className="mt-8 font-heading text-lg font-semibold">Type</h2>
      <p className="mt-2 font-heading text-xl">Heading: Geist (size and weight carry the hierarchy)</p>
      <p className="mt-1 text-sm">Body: Geist Variable</p>
      <p className="mt-1 font-mono text-sm">Mono: JetBrains Mono Variable</p>
    </section>
  )
}
