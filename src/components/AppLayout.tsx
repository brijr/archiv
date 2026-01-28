import { useEffect, useState } from "react"
import { useNavigate, useLocation } from "@tanstack/react-router"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/AppSidebar"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useSession, organization } from "@/lib/auth-client"
import { Skeleton } from "@/components/ui/skeleton"

interface AppLayoutProps {
  children: React.ReactNode
}

// Routes that don't require authentication
const publicRoutes = ["/login", "/register", "/workspace/create"]

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="space-y-4 w-full max-w-md px-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-8 w-1/2" />
      </div>
    </div>
  )
}

interface Organization {
  id: string
  name: string
  slug: string
}

export function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: session, isPending: sessionPending } = useSession()
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [orgsLoading, setOrgsLoading] = useState(true)

  const isPublicRoute = publicRoutes.some((route) => location.pathname.startsWith(route))
  const isPending = sessionPending || (!isPublicRoute && orgsLoading)

  // Fetch organizations when session changes
  useEffect(() => {
    async function fetchOrgs() {
      if (!session?.user || isPublicRoute) {
        setOrgsLoading(false)
        return
      }

      try {
        const result = await organization.list()
        if (result.data) {
          setOrgs(result.data as Organization[])
        }
      } catch (error) {
        console.error("Failed to fetch organizations:", error)
      } finally {
        setOrgsLoading(false)
      }
    }

    fetchOrgs()
  }, [session, isPublicRoute])

  useEffect(() => {
    // Skip redirects for public routes
    if (isPublicRoute) return

    // Skip redirects while loading
    if (isPending) return

    // Redirect to login if not authenticated
    if (!session?.user) {
      navigate({ to: "/login" })
      return
    }

    // Redirect to workspace creation if no active organization
    if (!session.session.activeOrganizationId) {
      // Check if user has any organizations
      if (orgs.length > 0) {
        // Auto-select first organization
        organization.setActive({ organizationId: orgs[0].id }).then(() => {
          window.location.reload()
        })
      } else {
        navigate({ to: "/workspace/create" })
      }
    }
  }, [session, orgs, isPending, isPublicRoute, navigate])

  // For public routes, render without sidebar
  if (isPublicRoute) {
    return (
      <TooltipProvider>
        {children}
        <Toaster position="bottom-right" />
      </TooltipProvider>
    )
  }

  // Show loading while checking auth
  if (isPending) {
    return <LoadingScreen />
  }

  // Don't render protected content if not authenticated
  if (!session?.user || !session.session.activeOrganizationId) {
    return <LoadingScreen />
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 items-center gap-2 border-b px-4">
            <SidebarTrigger />
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </SidebarInset>
        <Toaster position="bottom-right" />
      </SidebarProvider>
    </TooltipProvider>
  )
}
