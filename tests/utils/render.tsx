import { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'

interface WrapperOptions {
  route?: string
}

// Custom render that wraps with necessary providers
// Router Link is mocked globally in tests/setup.ts
export function renderWithRouter(
  ui: ReactElement,
  options: RenderOptions & WrapperOptions = {}
) {
  const { route, ...renderOptions } = options
  return render(ui, renderOptions)
}

// Re-export everything from testing-library
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
