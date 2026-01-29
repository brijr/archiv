import { createFileRoute } from "@tanstack/react-router"
import { useState, useEffect, useCallback } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, RefreshIcon, AlertCircleIcon, CheckmarkCircle01Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { getBackfillStatus, startBackfill, retryFailedEmbeddings } from "@/lib/server/backfill"
import type { BackfillStatus } from "@/lib/types"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute("/settings/search")({
  component: SearchSettingsPage,
})

function SearchSettingsPage() {
  const [status, setStatus] = useState<BackfillStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isBackfilling, setIsBackfilling] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const result = await getBackfillStatus()
      setStatus(result)
    } catch (error) {
      console.error("Failed to fetch backfill status:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Poll for status while backfilling
  useEffect(() => {
    if (!status) return
    const hasActiveWork = status.pending > 0 || status.processing > 0
    if (!hasActiveWork) return

    const interval = setInterval(fetchStatus, 3000)
    return () => clearInterval(interval)
  }, [status, fetchStatus])

  const handleStartBackfill = async () => {
    setIsBackfilling(true)
    try {
      const result = await startBackfill({ data: { batchSize: 50 } })
      toast.success(`Queued ${result.queued} assets for embedding`)
      await fetchStatus()
    } catch (error) {
      toast.error("Failed to start backfill")
      console.error(error)
    } finally {
      setIsBackfilling(false)
    }
  }

  const handleRetryFailed = async () => {
    setIsRetrying(true)
    try {
      await retryFailedEmbeddings()
      toast.success("Failed embeddings reset to pending")
      await fetchStatus()
    } catch (error) {
      toast.error("Failed to retry")
      console.error(error)
    } finally {
      setIsRetrying(false)
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

  const completedPercent = status && status.total > 0
    ? Math.round((status.completed / status.total) * 100)
    : 0

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Search Settings</h1>
        <p className="text-muted-foreground">Manage semantic search and AI embeddings</p>
      </div>

      <div className="space-y-8">
        {/* Embedding Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HugeiconsIcon icon={Search01Icon} className="h-5 w-5" strokeWidth={2} />
              Embedding Status
            </CardTitle>
            <CardDescription>
              Embeddings power semantic search. Assets need to be embedded before they appear in search results.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {status && (
              <>
                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{completedPercent}% complete</span>
                  </div>
                  <Progress value={completedPercent} className="h-2" />
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="rounded-lg border p-4">
                    <p className="text-2xl font-bold">{status.total}</p>
                    <p className="text-sm text-muted-foreground">Total Assets</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-2xl font-bold text-green-600">{status.completed}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-3 w-3" strokeWidth={2} />
                      Completed
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-2xl font-bold text-yellow-600">{status.pending + status.processing}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <HugeiconsIcon icon={RefreshIcon} className="h-3 w-3" strokeWidth={2} />
                      In Progress
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-2xl font-bold text-red-600">{status.failed}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <HugeiconsIcon icon={AlertCircleIcon} className="h-3 w-3" strokeWidth={2} />
                      Failed
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handleStartBackfill}
                    disabled={isBackfilling || status.pending === 0}
                  >
                    <HugeiconsIcon icon={RefreshIcon} className={`mr-2 h-4 w-4 ${isBackfilling ? "animate-spin" : ""}`} strokeWidth={2} />
                    {isBackfilling ? "Processing..." : `Process ${status.pending} Pending`}
                  </Button>

                  {status.failed > 0 && (
                    <Button
                      variant="outline"
                      onClick={handleRetryFailed}
                      disabled={isRetrying}
                    >
                      <HugeiconsIcon icon={AlertCircleIcon} className="mr-2 h-4 w-4" strokeWidth={2} />
                      {isRetrying ? "Retrying..." : `Retry ${status.failed} Failed`}
                    </Button>
                  )}

                  <Button variant="ghost" onClick={fetchStatus}>
                    <HugeiconsIcon icon={RefreshIcon} className="mr-2 h-4 w-4" strokeWidth={2} />
                    Refresh
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* How it Works */}
        <Card>
          <CardHeader>
            <CardTitle>How Semantic Search Works</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <strong>Embeddings</strong> are generated for each asset using AI, based on the filename,
                alt text, description, and tags.
              </li>
              <li>
                <strong>Semantic search</strong> finds assets by meaning, not just exact keyword matches.
                Search for "mountain landscape" and find images tagged "alpine scenery".
              </li>
              <li>
                <strong>Hybrid search</strong> combines semantic similarity with traditional keyword matching
                for the best results.
              </li>
              <li>
                New uploads are automatically queued for embedding. Existing assets need to be processed
                using the button above.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
