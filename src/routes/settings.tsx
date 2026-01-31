import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { Building01Icon, Key01Icon, Search01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"

export const Route = createFileRoute("/settings")({
  component: SettingsLayout,
})

const navItems = [
  {
    title: "Workspace",
    href: "/settings/workspace",
    icon: Building01Icon,
    description: "Manage workspace and team",
  },
  {
    title: "API Keys",
    href: "/settings/api-keys",
    icon: Key01Icon,
    description: "Manage API access",
  },
  {
    title: "Search & AI",
    href: "/settings/search",
    icon: Search01Icon,
    description: "Embeddings and semantic search",
  },
]

function SettingsLayout() {
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-muted/30 p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">Settings</h2>
          <p className="text-sm text-muted-foreground">Manage your workspace</p>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = currentPath === item.href
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <HugeiconsIcon icon={item.icon} className="h-4 w-4" strokeWidth={2} />
                <div>
                  <div className="font-medium">{item.title}</div>
                </div>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
