export function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <section>
      <h1 className="font-heading text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Placeholder. {note}</p>
    </section>
  )
}
