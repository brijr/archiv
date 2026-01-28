import { useNavigate } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  ArrowDown01Icon,
  Building01Icon,
} from "@hugeicons/core-free-icons"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenuButton } from "@/components/ui/sidebar"

// Simplified workspace switcher for development
// TODO: Integrate with Better Auth organization atoms when auth is fully configured
export function WorkspaceSwitcher() {
  const navigate = useNavigate()

  // For development, use a default workspace
  const workspace = {
    id: "default-org",
    name: "My Workspace",
    slug: "my-workspace",
    logo: null as string | null,
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-background">
            {workspace.logo ? (
              <img
                src={workspace.logo}
                alt={workspace.name}
                className="h-6 w-6 rounded"
              />
            ) : (
              <HugeiconsIcon icon={Building01Icon} className="h-4 w-4" strokeWidth={2} />
            )}
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">
              {workspace.name}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {workspace.slug}
            </span>
          </div>
          <HugeiconsIcon icon={ArrowDown01Icon} className="ml-auto h-4 w-4" strokeWidth={2} />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
        side="bottom"
        align="start"
        sideOffset={4}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Workspaces
        </DropdownMenuLabel>
        <DropdownMenuItem className="gap-2 p-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-sm border">
            <HugeiconsIcon icon={Building01Icon} className="h-3 w-3" strokeWidth={2} />
          </div>
          <span className="flex-1 truncate">{workspace.name}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: "/workspace/create" })}>
          <HugeiconsIcon icon={Add01Icon} className="mr-2 h-4 w-4" strokeWidth={2} />
          Create workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
