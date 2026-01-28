import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router"
import { useState, useEffect, useCallback } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, Loading03Icon } from "@hugeicons/core-free-icons"

import { searchAssets } from "@/lib/server/search"

import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { AssetGrid } from "@/components/AssetGrid"
import type { Asset, PaginatedResponse } from "@/lib/types"

export const Route = createFileRoute("/search")({
  component: SearchPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      q: (search.q as string) || "",
    }
  },
})

function SearchPage() {
  const { q } = Route.useSearch()
  const navigate = useNavigate()
  const [query, setQuery] = useState(q)
  const [results, setResults] = useState<(Asset & { url: string })[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      setHasSearched(false)
      return
    }

    setIsSearching(true)
    try {
      const searchResults = await searchAssets({ data: { query: searchQuery, limit: 100 } })
      setResults(searchResults)
      setHasSearched(true)
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Search when query param changes
  useEffect(() => {
    if (q) {
      setQuery(q)
      performSearch(q)
    }
  }, [q, performSearch])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      navigate({ to: "/search", search: { q: query.trim() } })
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
  }

  // Debounced search as user types
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim() && query !== q) {
        navigate({ to: "/search", search: { q: query.trim() }, replace: true })
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, q, navigate])

  // Convert to PaginatedResponse format for AssetGrid
  const assetsResponse: PaginatedResponse<Asset & { url: string }> | null = hasSearched
    ? {
        data: results,
        pagination: {
          page: 1,
          limit: results.length,
          total: results.length,
          totalPages: 1,
        },
      }
    : null

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Search</h1>
        <p className="text-muted-foreground mt-1">
          Search for assets by filename, alt text, or description
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-8">
        <div className="relative max-w-xl">
          <HugeiconsIcon
            icon={isSearching ? Loading03Icon : Search01Icon}
            className={`absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground ${
              isSearching ? "animate-spin" : ""
            }`}
            strokeWidth={2}
          />
          <Input
            value={query}
            onChange={handleInputChange}
            placeholder="Search assets..."
            className="pl-10 h-12 text-lg"
            autoFocus
          />
        </div>
      </form>

      {hasSearched ? (
        results.length > 0 ? (
          <>
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                Found {results.length} {results.length === 1 ? "result" : "results"} for "{q}"
              </p>
            </div>
            <AssetGrid assets={assetsResponse} />
          </>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="rounded-full bg-muted p-4 mb-4">
                <HugeiconsIcon icon={Search01Icon} className="h-8 w-8 text-muted-foreground" strokeWidth={2} />
              </div>
              <CardTitle className="mb-2">No results found</CardTitle>
              <CardDescription className="text-center mb-4 max-w-sm">
                No assets match "{q}". Try a different search term.
              </CardDescription>
            </CardContent>
          </Card>
        )
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-muted p-4 mb-4">
              <HugeiconsIcon icon={Search01Icon} className="h-8 w-8 text-muted-foreground" strokeWidth={2} />
            </div>
            <CardTitle className="mb-2">Start searching</CardTitle>
            <CardDescription className="text-center mb-4 max-w-sm">
              Enter a search term to find assets by filename, alt text, or description.
            </CardDescription>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
