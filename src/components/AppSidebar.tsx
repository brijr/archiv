import { Link, useLocation } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Image01Icon,
  Upload04Icon,
  FolderOpenIcon,
  Tag01Icon,
  Search01Icon,
  Settings01Icon,
  GridViewIcon,
  Add01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"

import { getFolderTree } from "@/lib/server/folders"
import type { FolderWithChildren } from "@/lib/types"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { CreateFolderDialog } from "@/components/dialogs/CreateFolderDialog"

const navItems = [
  {
    title: "All Assets",
    url: "/",
    icon: GridViewIcon,
  },
  {
    title: "Upload",
    url: "/upload",
    icon: Upload04Icon,
  },
  {
    title: "Tags",
    url: "/tags",
    icon: Tag01Icon,
  },
  {
    title: "Search",
    url: "/search",
    icon: Search01Icon,
  },
]

function FolderTreeItem({
  folder,
  level = 0,
}: {
  folder: FolderWithChildren
  level?: number
}) {
  const location = useLocation()
  const isActive = location.pathname === `/folder/${folder.slug}`
  const hasChildren = folder.children.length > 0
  const [isOpen, setIsOpen] = useState(false)

  if (level === 0) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={isActive}
          tooltip={folder.name}
        >
          <Link to="/folder/$slug" params={{ slug: folder.slug }}>
            <HugeiconsIcon icon={FolderOpenIcon} strokeWidth={2} />
            <span>{folder.name}</span>
          </Link>
        </SidebarMenuButton>
        {hasChildren && (
          <SidebarMenuSub>
            {folder.children.map((child) => (
              <FolderTreeItem key={child.id} folder={child} level={level + 1} />
            ))}
          </SidebarMenuSub>
        )}
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild isActive={isActive}>
        <Link to="/folder/$slug" params={{ slug: folder.slug }}>
          <HugeiconsIcon icon={FolderOpenIcon} strokeWidth={2} className="h-4 w-4" />
          <span>{folder.name}</span>
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}

export function AppSidebar() {
  const location = useLocation()
  const [folders, setFolders] = useState<FolderWithChildren[]>([])
  const [showCreateFolder, setShowCreateFolder] = useState(false)

  const loadFolders = async () => {
    try {
      const tree = await getFolderTree()
      setFolders(tree)
    } catch {
      // Ignore errors on initial load
    }
  }

  useEffect(() => {
    loadFolders()
  }, [])

  return (
    <>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <HugeiconsIcon icon={Image01Icon} className="h-5 w-5" strokeWidth={2} />
            </div>
            <span className="font-semibold text-lg">Archiv</span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === item.url}
                      tooltip={item.title}
                    >
                      <Link to={item.url}>
                        <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          <SidebarGroup>
            <SidebarGroupLabel>
              <HugeiconsIcon icon={FolderOpenIcon} strokeWidth={2} className="mr-2" />
              Folders
            </SidebarGroupLabel>
            <SidebarGroupAction
              title="Create Folder"
              onClick={() => setShowCreateFolder(true)}
            >
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
            </SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenu>
                {folders.length > 0 ? (
                  folders.map((folder) => (
                    <FolderTreeItem key={folder.id} folder={folder} />
                  ))
                ) : (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className="text-muted-foreground text-sm"
                      onClick={() => setShowCreateFolder(true)}
                    >
                      <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                      <span>Create folder</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={location.pathname.startsWith("/settings")}
                tooltip="Settings"
              >
                <Link to="/settings/api-keys">
                  <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <CreateFolderDialog
        open={showCreateFolder}
        onOpenChange={setShowCreateFolder}
        onCreated={loadFolders}
      />
    </>
  )
}
