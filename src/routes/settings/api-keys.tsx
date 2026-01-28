import { createFileRoute } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { Key01Icon } from "@hugeicons/core-free-icons"

import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/settings/api-keys")({
  component: ApiKeysPage,
})

function ApiKeysPage() {
  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
        <p className="text-muted-foreground mt-1">
          Manage API keys for programmatic access to your assets
        </p>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="rounded-full bg-muted p-4 mb-4">
            <HugeiconsIcon icon={Key01Icon} className="h-8 w-8 text-muted-foreground" strokeWidth={2} />
          </div>
          <CardTitle className="mb-2">No API keys</CardTitle>
          <CardDescription className="text-center mb-4 max-w-sm">
            Create API keys to access your assets programmatically from other applications.
          </CardDescription>
          <Button disabled>
            <HugeiconsIcon icon={Key01Icon} className="mr-2 h-4 w-4" strokeWidth={2} />
            Create API Key
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
