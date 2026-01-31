import { Link, useLocation } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Upload04Icon,
  FolderOpenIcon,
  Tag01Icon,
  Search01Icon,
  Settings01Icon,
  GridViewIcon,
  Add01Icon,
} from "@hugeicons/core-free-icons"

import { getFolderTree } from "@/lib/server/folders"
import { moveAssets } from "@/lib/server/assets"
import type { FolderWithChildren } from "@/lib/types"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

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
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher"
import { UserMenu } from "@/components/UserMenu"

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
  onAssetMoved,
}: {
  folder: FolderWithChildren
  level?: number
  onAssetMoved?: () => void
}) {
  const location = useLocation()
  const isActive = location.pathname === `/folder/${folder.slug}`
  const hasChildren = folder.children.length > 0
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/x-archiv-asset")) {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const data = e.dataTransfer.getData("application/x-archiv-asset")
    if (data) {
      try {
        const asset = JSON.parse(data)
        await moveAssets({ data: { ids: [asset.id], folderId: folder.id } })
        toast.success(`Moved "${asset.filename}" to ${folder.name}`)
        onAssetMoved?.()
      } catch {
        toast.error("Failed to move asset")
      }
    }
  }

  if (level === 0) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={isActive}
          tooltip={folder.name}
          className={cn(isDragOver && "bg-accent ring-2 ring-primary")}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Link to="/folder/$slug" params={{ slug: folder.slug }}>
            <HugeiconsIcon icon={FolderOpenIcon} strokeWidth={2} />
            <span>{folder.name}</span>
          </Link>
        </SidebarMenuButton>
        {hasChildren && (
          <SidebarMenuSub>
            {folder.children.map((child) => (
              <FolderTreeItem key={child.id} folder={child} level={level + 1} onAssetMoved={onAssetMoved} />
            ))}
          </SidebarMenuSub>
        )}
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        asChild
        isActive={isActive}
        className={cn(isDragOver && "bg-accent ring-2 ring-primary")}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Link to="/folder/$slug" params={{ slug: folder.slug }}>
          <HugeiconsIcon icon={FolderOpenIcon} strokeWidth={2} className="h-4 w-4" />
          <span>{folder.name}</span>
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}

function UnfiledDropTarget({ onAssetMoved }: { onAssetMoved?: () => void }) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/x-archiv-asset")) {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const data = e.dataTransfer.getData("application/x-archiv-asset")
    if (data) {
      try {
        const asset = JSON.parse(data)
        await moveAssets({ data: { ids: [asset.id], folderId: null } })
        toast.success(`Moved "${asset.filename}" to Unfiled`)
        onAssetMoved?.()
      } catch {
        toast.error("Failed to move asset")
      }
    }
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        className={cn(
          "text-muted-foreground",
          isDragOver && "bg-accent ring-2 ring-primary text-foreground"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <HugeiconsIcon icon={GridViewIcon} strokeWidth={2} />
        <span>Unfiled</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
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
      // Ignore errors on initial load (e.g., not authenticated yet)
    }
  }

  useEffect(() => {
    loadFolders()
  }, [])

  return (
    <>
      <Sidebar>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <WorkspaceSwitcher />
            </SidebarMenuItem>
          </SidebarMenu>
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
                <UnfiledDropTarget onAssetMoved={loadFolders} />
                {folders.length > 0 ? (
                  folders.map((folder) => (
                    <FolderTreeItem key={folder.id} folder={folder} onAssetMoved={loadFolders} />
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
            <SidebarMenuItem>
              <UserMenu />
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
