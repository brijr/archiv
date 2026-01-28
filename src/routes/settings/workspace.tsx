import { createFileRoute } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Building01Icon, Mail01Icon, UserAdd01Icon, Delete02Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { useSession, organization } from "@/lib/auth-client"

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
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute("/settings/workspace")({
  component: WorkspaceSettingsPage,
})

interface Member {
  id: string
  userId: string
  role: string
  user: {
    name: string
    email: string
  }
}

interface Invitation {
  id: string
  email: string
  role: string
  status: string
}

interface ActiveOrganization {
  id: string
  name: string
  slug: string
  members: Member[]
  invitations: Invitation[]
}

function WorkspaceSettingsPage() {
  const { data: session } = useSession()
  const [activeOrg, setActiveOrg] = useState<ActiveOrganization | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [workspaceName, setWorkspaceName] = useState("")

  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member")
  const [isInviting, setIsInviting] = useState(false)

  // Fetch active organization data
  useEffect(() => {
    async function fetchOrg() {
      if (!session?.session.activeOrganizationId) {
        setIsLoading(false)
        return
      }

      try {
        const result = await organization.getFullOrganization()
        if (result.data) {
          setActiveOrg(result.data as ActiveOrganization)
          setWorkspaceName(result.data.name || "")
        }
      } catch (error) {
        console.error("Failed to fetch organization:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrg()
  }, [session])

  // Get members and invitations from active organization
  const members = activeOrg?.members || []
  const invitations = (activeOrg?.invitations || []).filter(
    (inv) => inv.status === "pending"
  )

  const handleUpdateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeOrg) return

    setIsUpdating(true)
    try {
      await organization.update({
        organizationId: activeOrg.id,
        data: { name: workspaceName },
      })
      toast.success("Workspace updated")
      // Refresh org data
      const result = await organization.getFullOrganization()
      if (result.data) {
        setActiveOrg(result.data as ActiveOrganization)
      }
    } catch {
      toast.error("Failed to update workspace")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeOrg || !inviteEmail) return

    setIsInviting(true)
    try {
      await organization.inviteMember({
        organizationId: activeOrg.id,
        email: inviteEmail,
        role: inviteRole,
      })
      toast.success(`Invitation sent to ${inviteEmail}`)
      setInviteEmail("")
      // Refresh org data
      const result = await organization.getFullOrganization()
      if (result.data) {
        setActiveOrg(result.data as ActiveOrganization)
      }
    } catch {
      toast.error("Failed to send invitation")
    } finally {
      setIsInviting(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!activeOrg) return

    try {
      await organization.removeMember({
        organizationId: activeOrg.id,
        memberIdOrEmail: memberId,
      })
      toast.success("Member removed")
      // Refresh org data
      const result = await organization.getFullOrganization()
      if (result.data) {
        setActiveOrg(result.data as ActiveOrganization)
      }
    } catch {
      toast.error("Failed to remove member")
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await organization.cancelInvitation({
        invitationId,
      })
      toast.success("Invitation cancelled")
      // Refresh org data
      const result = await organization.getFullOrganization()
      if (result.data) {
        setActiveOrg(result.data as ActiveOrganization)
      }
    } catch {
      toast.error("Failed to cancel invitation")
    }
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

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!activeOrg) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">No active workspace</p>
      </div>
    )
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
                        <p className="font-medium">{member.user?.name || "Unknown"}</p>
                        <p className="text-sm text-muted-foreground">{member.user?.email || ""}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(member.role)}>
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {member.role !== "owner" && member.userId !== session?.user.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <HugeiconsIcon icon={Delete02Icon} className="h-4 w-4" strokeWidth={2} />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pending Invitations</CardTitle>
              <CardDescription>Invitations waiting to be accepted</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell>{invitation.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{invitation.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{invitation.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelInvitation(invitation.id)}
                        >
                          <HugeiconsIcon icon={Delete02Icon} className="h-4 w-4" strokeWidth={2} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
