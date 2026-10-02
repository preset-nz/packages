import {
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from "@preset.nz/ux-kit"

const VARIANTS = ["default", "outline", "secondary", "ghost", "destructive", "link"] as const

export function Primitives() {
  return (
    <section className="max-w-xl space-y-6">
      <h1 className="font-heading text-2xl font-semibold">Primitives</h1>

      <div className="flex flex-wrap gap-2">
        {VARIANTS.map((v) => (
          <Button key={v} variant={v}>
            {v}
          </Button>
        ))}
      </div>
      <Separator />

      <div className="flex items-center gap-2">
        <Checkbox id="demo-check" defaultChecked />
        <Label htmlFor="demo-check">Checkbox</Label>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="demo-input">Input</Label>
        <Input id="demo-input" placeholder="Type here" />
      </div>

      <div className="space-y-1.5">
        <Label>Select</Label>
        <Select defaultValue="one">
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="one">One</SelectItem>
            <SelectItem value="two">Two</SelectItem>
            <SelectItem value="three">Three</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </section>
  )
}
