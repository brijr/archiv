import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Building01Icon, Mail01Icon, UserAdd01Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export const Route = createFileRoute("/settings/workspace")({
  component: WorkspaceSettingsPage,
})

// Simplified workspace settings for development
// TODO: Integrate with Better Auth organization API when fully configured
function WorkspaceSettingsPage() {
  const [isUpdating, setIsUpdating] = useState(false)
  const [workspaceName, setWorkspaceName] = useState("My Workspace")

  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member")
  const [isInviting, setIsInviting] = useState(false)

  // Mock data for development
  const activeOrg = {
    id: "default-org",
    name: "My Workspace",
    slug: "my-workspace",
  }

  const members = [
    {
      id: "member-1",
      userId: "dev-user",
      role: "owner",
      user: {
        name: "Development User",
        email: "dev@example.com",
      },
    },
  ]

  const handleUpdateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdating(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500))
    toast.success("Workspace updated")
    setIsUpdating(false)
  }

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail) return

    setIsInviting(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500))
    toast.success(`Invitation sent to ${inviteEmail}`)
    setInviteEmail("")
    setIsInviting(false)
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "owner":
        return "default" as const
      case "admin":
        return "secondary" as const
      default:
        return "outline" as const
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Workspace Settings</h1>
        <p className="text-muted-foreground">Manage your workspace and team members</p>
      </div>

      <div className="space-y-8">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HugeiconsIcon icon={Building01Icon} className="h-5 w-5" strokeWidth={2} />
              General
            </CardTitle>
            <CardDescription>Update your workspace information</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateWorkspace} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Workspace name</Label>
                <Input
                  id="name"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="My Workspace"
                />
              </div>
              <div className="space-y-2">
                <Label>URL slug</Label>
                <Input value={activeOrg.slug} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">
                  The URL slug cannot be changed after creation
                </p>
              </div>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? "Saving..." : "Save changes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Separator />

        {/* Invite Member */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HugeiconsIcon icon={UserAdd01Icon} className="h-5 w-5" strokeWidth={2} />
              Invite Member
            </CardTitle>
            <CardDescription>Add new members to your workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInviteMember} className="flex gap-4">
              <div className="flex-1">
                <Input
                  type="email"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <Select
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as "member" | "admin")}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={isInviting || !inviteEmail}>
                <HugeiconsIcon icon={Mail01Icon} className="mr-2 h-4 w-4" strokeWidth={2} />
                {isInviting ? "Sending..." : "Send Invite"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Team Members */}
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>People who have access to this workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{member.user.name}</p>
                        <p className="text-sm text-muted-foreground">{member.user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(member.role)}>
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
