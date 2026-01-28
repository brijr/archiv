import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { AssetGrid } from '@/components/AssetGrid'
import { createAssetWithUrl } from '../fixtures/assets'
import { renderWithRouter } from '../utils/render'
import type { PaginatedResponse, Asset } from '@/lib/types'

// Mock sonner for CopyButton inside AssetCard
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

function createPaginatedAssets(
  count: number,
  pagination: Partial<PaginatedResponse<Asset>['pagination']> = {}
): PaginatedResponse<Asset & { url: string }> {
  return {
    data: Array.from({ length: count }, () => createAssetWithUrl()),
    pagination: {
      page: 1,
      limit: 50,
      total: count,
      totalPages: 1,
      ...pagination,
    },
  }
}

describe('AssetGrid', () => {
  it('should show loading skeleton when loading with no assets', () => {
    renderWithRouter(<AssetGrid assets={null} isLoading={true} />)

    // Should show 12 skeleton items
    const skeletons = document.querySelectorAll('.aspect-square')
    expect(skeletons.length).toBe(12)
  })

  it('should show empty state when no assets', () => {
    const emptyResponse = createPaginatedAssets(0)
    renderWithRouter(<AssetGrid assets={emptyResponse} />)

    expect(screen.getByText('No assets found')).toBeInTheDocument()
    expect(
      screen.getByText(/Upload some assets to get started/)
    ).toBeInTheDocument()
  })

  it('should show empty state when assets is null', () => {
    renderWithRouter(<AssetGrid assets={null} />)

    expect(screen.getByText('No assets found')).toBeInTheDocument()
  })

  it('should render asset cards', () => {
    const assets = createPaginatedAssets(3)
    renderWithRouter(<AssetGrid assets={assets} />)

    // Each asset should have its filename displayed
    assets.data.forEach((asset) => {
      expect(screen.getByText(asset.filename)).toBeInTheDocument()
    })
  })

  it('should show asset count stats', () => {
    const assets = createPaginatedAssets(10, { total: 25 })
    renderWithRouter(<AssetGrid assets={assets} />)

    expect(screen.getByText('Showing 10 of 25 assets')).toBeInTheDocument()
  })

  it('should show Load More button when more pages exist', () => {
    const assets = createPaginatedAssets(10, { page: 1, totalPages: 3, total: 30 })
    renderWithRouter(<AssetGrid assets={assets} onLoadMore={() => {}} />)

    expect(screen.getByText('Load More')).toBeInTheDocument()
  })

  it('should not show Load More button on last page', () => {
    const assets = createPaginatedAssets(10, { page: 3, totalPages: 3, total: 30 })
    renderWithRouter(<AssetGrid assets={assets} onLoadMore={() => {}} />)

    expect(screen.queryByText('Load More')).not.toBeInTheDocument()
  })

  it('should not show Load More button when no onLoadMore handler', () => {
    const assets = createPaginatedAssets(10, { page: 1, totalPages: 3, total: 30 })
    renderWithRouter(<AssetGrid assets={assets} />)

    expect(screen.queryByText('Load More')).not.toBeInTheDocument()
  })

  it('should call onLoadMore when Load More button is clicked', () => {
    const onLoadMore = vi.fn()
    const assets = createPaginatedAssets(10, { page: 1, totalPages: 3, total: 30 })
    renderWithRouter(<AssetGrid assets={assets} onLoadMore={onLoadMore} />)

    fireEvent.click(screen.getByText('Load More'))
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('should disable Load More button when loading', () => {
    const assets = createPaginatedAssets(10, { page: 1, totalPages: 3, total: 30 })
    renderWithRouter(
      <AssetGrid assets={assets} isLoading={true} onLoadMore={() => {}} />
    )

    const button = screen.getByText('Loading...')
    expect(button).toBeDisabled()
  })

  it('should pass selection props to AssetCard', () => {
    const assets = createPaginatedAssets(2)
    const selectedIds = new Set([assets.data[0].id])
    const onSelect = vi.fn()

    renderWithRouter(
      <AssetGrid
        assets={assets}
        selectedIds={selectedIds}
        onSelect={onSelect}
        selectionMode={true}
      />
    )

    // Both assets should have checkboxes in selection mode
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.length).toBe(2)

    // First one should be checked
    expect(checkboxes[0]).toBeChecked()
    expect(checkboxes[1]).not.toBeChecked()
  })

  it('should show assets even when loading if assets exist', () => {
    const assets = createPaginatedAssets(5)
    renderWithRouter(<AssetGrid assets={assets} isLoading={true} />)

    // Should show assets, not skeletons
    assets.data.forEach((asset) => {
      expect(screen.getByText(asset.filename)).toBeInTheDocument()
    })
  })
})
