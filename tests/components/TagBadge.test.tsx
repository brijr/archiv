import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TagBadge } from '@/components/TagBadge'
import { createTag } from '../fixtures/tags'

describe('TagBadge', () => {
  it('should render tag name', () => {
    const tag = createTag({ name: 'Featured' })
    render(<TagBadge tag={tag} />)

    expect(screen.getByText('Featured')).toBeInTheDocument()
  })

  it('should render color dot', () => {
    const tag = createTag({ color: '#ef4444' })
    render(<TagBadge tag={tag} />)

    // The color dot should be present
    const dot = document.querySelector('.rounded-full')
    expect(dot).toBeInTheDocument()
    expect(dot).toHaveStyle({ backgroundColor: '#ef4444' })
  })

  it('should apply inline color styles', () => {
    const tag = createTag({ color: '#3b82f6' })
    render(<TagBadge tag={tag} />)

    const badge = screen.getByText(tag.name).closest('[class*="cursor"]')
    expect(badge).toHaveStyle({
      backgroundColor: '#3b82f620',
      borderColor: '#3b82f6',
      color: '#3b82f6',
    })
  })

  it('should call onClick when clicked', () => {
    const tag = createTag()
    const handleClick = vi.fn()

    render(<TagBadge tag={tag} onClick={handleClick} />)

    fireEvent.click(screen.getByText(tag.name))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('should have cursor-pointer class when onClick is provided', () => {
    const tag = createTag()
    render(<TagBadge tag={tag} onClick={() => {}} />)

    const badge = screen.getByText(tag.name).closest('[class*="cursor"]')
    expect(badge).toHaveClass('cursor-pointer')
  })

  it('should show remove button when onRemove is provided', () => {
    const tag = createTag()
    const handleRemove = vi.fn()

    render(<TagBadge tag={tag} onRemove={handleRemove} />)

    const removeButton = screen.getByRole('button')
    expect(removeButton).toBeInTheDocument()
  })

  it('should not show remove button when onRemove is not provided', () => {
    const tag = createTag()

    render(<TagBadge tag={tag} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('should call onRemove when remove button is clicked', () => {
    const tag = createTag()
    const handleRemove = vi.fn()

    render(<TagBadge tag={tag} onRemove={handleRemove} />)

    fireEvent.click(screen.getByRole('button'))
    expect(handleRemove).toHaveBeenCalledTimes(1)
  })

  it('should stop propagation when remove button is clicked', () => {
    const tag = createTag()
    const handleClick = vi.fn()
    const handleRemove = vi.fn()

    render(<TagBadge tag={tag} onClick={handleClick} onRemove={handleRemove} />)

    fireEvent.click(screen.getByRole('button'))

    expect(handleRemove).toHaveBeenCalledTimes(1)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('should apply custom className', () => {
    const tag = createTag()

    render(<TagBadge tag={tag} className="custom-class" />)

    const badge = screen.getByText(tag.name).closest('[class*="cursor"]')
    expect(badge).toHaveClass('custom-class')
  })

  it('should use default color when tag has no color', () => {
    const tag = createTag({ color: undefined })
    render(<TagBadge tag={tag} />)

    // The color dot should use the default gray color
    const dot = document.querySelector('.rounded-full')
    expect(dot).toHaveStyle({ backgroundColor: '#6b7280' })
  })
})
