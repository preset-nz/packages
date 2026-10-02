import { useState, type ReactNode } from "react"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Icons,
  Input,
  Label,
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  Skeleton,
  Slider,
  SnackbarProvider,
  SnackbarViewport,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Toaster,
  Toggle,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  toast,
  useSnackbar,
} from "@preset.nz/ux-kit"

const VARIANTS = ["default", "outline", "secondary", "ghost", "destructive", "link"] as const

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
      <div className="space-y-6">{children}</div>
      <Separator />
    </section>
  )
}

function Demo({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-muted-foreground">{name}</Label>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

function ButtonsAndInputs() {
  return (
    <Group title="Buttons and inputs">
      <Demo name="Button">
        {VARIANTS.map((v) => (
          <Button key={v} variant={v}>
            {v}
          </Button>
        ))}
      </Demo>
      <Demo name="Checkbox">
        <Checkbox id="demo-check" defaultChecked />
        <Label htmlFor="demo-check">Checkbox</Label>
      </Demo>
      <div className="space-y-1.5">
        <Label htmlFor="demo-input">Input</Label>
        <Input id="demo-input" placeholder="Type here" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="demo-textarea">Textarea</Label>
        <Textarea id="demo-textarea" placeholder="Several lines" />
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
      <SliderDemo />
      <ToggleDemo />
    </Group>
  )
}

function SliderDemo() {
  const [single, setSingle] = useState<number | readonly number[]>(40)
  const [range, setRange] = useState<number | readonly number[]>([20, 70])
  return (
    <>
      <div className="space-y-1.5">
        <Label>Slider: {String(single)}</Label>
        <Slider value={single} onValueChange={setSingle} />
      </div>
      <div className="space-y-1.5">
        <Label>Range slider: {Array.isArray(range) ? range.join(" to ") : String(range)}</Label>
        <Slider value={range} onValueChange={setRange} />
      </div>
    </>
  )
}

function ToggleDemo() {
  const [pressed, setPressed] = useState(false)
  const [align, setAlign] = useState<string[]>(["left"])
  const [marks, setMarks] = useState<string[]>(["bold"])
  return (
    <>
      <Demo name={`Toggle: ${pressed ? "on" : "off"}`}>
        <Toggle pressed={pressed} onPressedChange={setPressed} aria-label="Bold">
          <Icons.TextBIcon />
        </Toggle>
        <Toggle variant="outline" defaultPressed>
          Outline
        </Toggle>
      </Demo>
      <Demo name={`Toggle group, single: ${align.join(",") || "none"}`}>
        <ToggleGroup value={align} onValueChange={setAlign} variant="outline" spacing={0}>
          <ToggleGroupItem value="left" aria-label="Left">
            <Icons.TextAlignLeftIcon />
          </ToggleGroupItem>
          <ToggleGroupItem value="center" aria-label="Centre">
            <Icons.TextAlignCenterIcon />
          </ToggleGroupItem>
          <ToggleGroupItem value="right" aria-label="Right">
            <Icons.TextAlignRightIcon />
          </ToggleGroupItem>
        </ToggleGroup>
      </Demo>
      <Demo name={`Toggle group, multiple: ${marks.join(",") || "none"}`}>
        <ToggleGroup multiple value={marks} onValueChange={setMarks}>
          <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
          <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
          <ToggleGroupItem value="underline">Underline</ToggleGroupItem>
        </ToggleGroup>
      </Demo>
    </>
  )
}

function Overlays() {
  const [name, setName] = useState("")
  return (
    <Group title="Overlays">
      <Demo name="Dialog">
        <Dialog>
          <DialogTrigger render={<Button variant="outline" />}>Open dialog</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename</DialogTitle>
              <DialogDescription>Controlled input inside a dialog.</DialogDescription>
            </DialogHeader>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
            <DialogFooter showCloseButton>
              <DialogClose render={<Button />}>Save</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Demo>
      <Demo name="Sheet">
        {(["left", "right", "top", "bottom"] as const).map((side) => (
          <Sheet key={side}>
            <SheetTrigger render={<Button variant="outline" />}>{side}</SheetTrigger>
            <SheetContent side={side}>
              <SheetHeader>
                <SheetTitle>Sheet from {side}</SheetTitle>
                <SheetDescription>A dialog docked to one edge.</SheetDescription>
              </SheetHeader>
              <SheetFooter>
                <Button variant="secondary">Action</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        ))}
      </Demo>
      <Demo name="Popover">
        <Popover>
          <PopoverTrigger render={<Button variant="outline" />}>Open popover</PopoverTrigger>
          <PopoverContent>
            <PopoverHeader>
              <PopoverTitle>Dimensions</PopoverTitle>
              <PopoverDescription>Set the size of the layer.</PopoverDescription>
            </PopoverHeader>
            <Input defaultValue="100%" />
          </PopoverContent>
        </Popover>
      </Demo>
      <Demo name="Tooltip">
        <TooltipProvider delay={200}>
          <Tooltip>
            <TooltipTrigger render={<Button variant="outline" />}>Hover me</TooltipTrigger>
            <TooltipContent>Tooltip text</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </Demo>
    </Group>
  )
}

function Menus() {
  const [bookmarks, setBookmarks] = useState(true)
  const [person, setPerson] = useState("pedro")
  const [last, setLast] = useState("none")
  return (
    <Group title="Menus">
      <p className="text-xs text-muted-foreground">Last action: {last}</p>
      <Demo name="Dropdown menu">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" />}>Open menu</DropdownMenuTrigger>
          <DropdownMenuContent className="w-52">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setLast("profile")}>
                Profile <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => setLast("delete")}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={bookmarks} onCheckedChange={setBookmarks}>
              Show bookmarks
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={person} onValueChange={setPerson}>
              <DropdownMenuRadioItem value="pedro">Pedro</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="colm">Colm</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => setLast("sub item")}>Sub item</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="text-xs text-muted-foreground">
          bookmarks {String(bookmarks)}, person {person}
        </span>
      </Demo>
      <Demo name="Context menu (right-click the box)">
        <ContextMenu>
          <ContextMenuTrigger className="flex h-24 w-64 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
            Right-click here
          </ContextMenuTrigger>
          <ContextMenuContent className="w-52">
            <ContextMenuGroup>
              <ContextMenuLabel>Layer</ContextMenuLabel>
              <ContextMenuItem onClick={() => setLast("context: duplicate")}>
                Duplicate <ContextMenuShortcut>⌘D</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem variant="destructive" onClick={() => setLast("context: delete")}>
                Delete
              </ContextMenuItem>
            </ContextMenuGroup>
            <ContextMenuSeparator />
            <ContextMenuCheckboxItem checked={bookmarks} onCheckedChange={setBookmarks}>
              Visible
            </ContextMenuCheckboxItem>
            <ContextMenuRadioGroup value={person} onValueChange={setPerson}>
              <ContextMenuRadioItem value="pedro">Pedro</ContextMenuRadioItem>
              <ContextMenuRadioItem value="colm">Colm</ContextMenuRadioItem>
            </ContextMenuRadioGroup>
            <ContextMenuSub>
              <ContextMenuSubTrigger>More</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem onClick={() => setLast("context: sub item")}>Sub item</ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
          </ContextMenuContent>
        </ContextMenu>
      </Demo>
      <Demo name="Navigation menu">
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Docs</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-56 gap-1">
                  <li>
                    <NavigationMenuLink href="#intro">Introduction</NavigationMenuLink>
                  </li>
                  <li>
                    <NavigationMenuLink href="#install">Installation</NavigationMenuLink>
                  </li>
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink href="#plain" active>
                Plain link
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </Demo>
    </Group>
  )
}

function SnackbarButton() {
  const snackbar = useSnackbar()
  return (
    <Button
      variant="outline"
      onClick={() => snackbar.show({ message: "Snackbar shown", action: { label: "Undo", onClick: () => {} } })}
    >
      Show snackbar
    </Button>
  )
}

function Feedback() {
  return (
    <Group
      title="Feedback"
      note="Sonner and the Strata snackbar both live in the kit for now; pick one."
    >
      <Demo name="Sonner">
        <Toaster />
        <Button variant="outline" onClick={() => toast("Event created", { description: "Via sonner" })}>
          Show toast
        </Button>
      </Demo>
      <Demo name="Snackbar (Base UI Toast)">
        <SnackbarProvider>
          <SnackbarButton />
          <div className="relative h-0 w-0">
            <SnackbarViewport className="bottom-0 left-0" />
          </div>
        </SnackbarProvider>
      </Demo>
      <Demo name="Badge">
        <Badge>default</Badge>
        <Badge variant="secondary">secondary</Badge>
        <Badge variant="destructive">destructive</Badge>
        <Badge variant="outline">outline</Badge>
      </Demo>
      <Demo name="Skeleton">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </Demo>
    </Group>
  )
}

function Layout() {
  return (
    <Group title="Layout and navigation">
      <Demo name="Tabs">
        <Tabs defaultValue="one" className="w-full max-w-sm">
          <TabsList>
            <TabsTrigger value="one">One</TabsTrigger>
            <TabsTrigger value="two">Two</TabsTrigger>
          </TabsList>
          <TabsContent value="one">First panel</TabsContent>
          <TabsContent value="two">Second panel</TabsContent>
        </Tabs>
      </Demo>
      <Demo name="Tabs, line variant">
        <Tabs defaultValue="a" className="w-full max-w-sm">
          <TabsList variant="line">
            <TabsTrigger value="a">Alpha</TabsTrigger>
            <TabsTrigger value="b">Beta</TabsTrigger>
          </TabsList>
          <TabsContent value="a">Alpha panel</TabsContent>
          <TabsContent value="b">Beta panel</TabsContent>
        </Tabs>
      </Demo>
      <Demo name="Card">
        <Card className="w-72">
          <CardHeader>
            <CardTitle>Card title</CardTitle>
            <CardDescription>Card description</CardDescription>
            <CardAction>
              <Button size="sm" variant="ghost">
                Edit
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>Content</CardContent>
          <CardFooter>
            <Button size="sm">Save</Button>
          </CardFooter>
        </Card>
      </Demo>
      <Demo name="Avatar">
        <Avatar>
          <AvatarImage src="/does-not-exist.png" alt="" />
          <AvatarFallback>GD</AvatarFallback>
        </Avatar>
      </Demo>
      <Demo name="Breadcrumb">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#home">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbEllipsis />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Current</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </Demo>
      <SidebarDemo />
    </Group>
  )
}

function SidebarDemo() {
  const [active, setActive] = useState("Inbox")
  return (
    <Demo name={`Sidebar (fixed, non-collapsing form): ${active}`}>
      <SidebarProvider className="min-h-0 w-auto">
        <Sidebar collapsible="none" className="h-56 rounded-md border">
          <SidebarHeader>Workspace</SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Mail</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {["Inbox", "Drafts", "Sent"].map((item) => (
                    <SidebarMenuItem key={item}>
                      <SidebarMenuButton isActive={active === item} onClick={() => setActive(item)}>
                        {item}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
    </Demo>
  )
}

export function Primitives() {
  return (
    <section className="max-w-3xl space-y-8">
      <h1 className="font-heading text-2xl font-semibold">Primitives</h1>
      <ButtonsAndInputs />
      <Overlays />
      <Menus />
      <Feedback />
      <Layout />
    </section>
  )
}
