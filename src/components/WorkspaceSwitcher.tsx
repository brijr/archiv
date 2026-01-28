import { useNavigate } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  ArrowDown01Icon,
  CheckmarkCircle01Icon,
  Building01Icon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { useSession, organization } from "@/lib/auth-client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenuButton } from "@/components/ui/sidebar"

interface Organization {
  id: string
  name: string
  slug: string
  logo?: string | null
  createdAt: Date
}

export function WorkspaceSwitcher() {
  const navigate = useNavigate()
  const { data: session } = useSession()
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSwitching, setIsSwitching] = useState(false)

  // Fetch organizations when session changes
  useEffect(() => {
    async function fetchOrgs() {
      if (!session?.user) {
        setIsLoading(false)
        return
      }

      try {
        // Fetch user's organizations
        const result = await organization.list()
        if (result.data) {
          setOrgs(result.data as Organization[])

          // Find active organization
          const active = result.data.find(
            (org: Organization) => org.id === session.session.activeOrganizationId
          )
          setActiveOrg(active || null)
        }
      } catch (error) {
        console.error("Failed to fetch organizations:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrgs()
  }, [session])

  const handleSwitchOrg = async (orgId: string) => {
    if (orgId === session?.session.activeOrganizationId) return

    setIsSwitching(true)
    try {
      await organization.setActive({ organizationId: orgId })
      toast.success("Workspace switched")
      // Refresh the page to reload data with new org context
      window.location.reload()
    } catch {
      toast.error("Failed to switch workspace")
    } finally {
      setIsSwitching(false)
    }
  }

  // Show loading state
  if (!session?.user || isLoading) {
    return (
      <SidebarMenuButton size="lg" disabled>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-background animate-pulse" />
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-semibold text-muted-foreground">Loading...</span>
        </div>
      </SidebarMenuButton>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-background">
            {activeOrg?.logo ? (
              <img
                src={activeOrg.logo}
                alt={activeOrg.name}
                className="h-6 w-6 rounded"
              />
            ) : (
              <HugeiconsIcon icon={Building01Icon} className="h-4 w-4" strokeWidth={2} />
            )}
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">
              {activeOrg?.name || "Select Workspace"}
            </span>
            {activeOrg && (
              <span className="truncate text-xs text-muted-foreground">
                {activeOrg.slug}
              </span>
            )}
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
        {orgs.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => handleSwitchOrg(org.id)}
            disabled={isSwitching}
            className="gap-2 p-2"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-sm border">
              {org.logo ? (
                <img src={org.logo} alt={org.name} className="h-4 w-4 rounded-sm" />
              ) : (
                <HugeiconsIcon icon={Building01Icon} className="h-3 w-3" strokeWidth={2} />
              )}
            </div>
            <span className="flex-1 truncate">{org.name}</span>
            {org.id === session?.session.activeOrganizationId && (
              <HugeiconsIcon
                icon={CheckmarkCircle01Icon}
                className="h-4 w-4 text-primary"
                strokeWidth={2}
              />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: "/workspace/create" })}>
          <HugeiconsIcon icon={Add01Icon} className="mr-2 h-4 w-4" strokeWidth={2} />
          Create workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
