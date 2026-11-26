/**
 * Tests for BrandLogo — static markup: link target, brand name, tagline.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import BrandLogo from '../../components/BrandLogo'

describe('BrandLogo', () => {
  it('renders a link pointing to /', () => {
    render(<BrandLogo />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/')
  })

  it('link has the brand class', () => {
    render(<BrandLogo />)
    expect(screen.getByRole('link')).toHaveClass('brand')
  })

  it('renders the ContribIQ brand name', () => {
    render(<BrandLogo />)
    expect(screen.getByText('ContribIQ')).toBeInTheDocument()
  })

  it('renders the Open-Source Onboarding tagline', () => {
    render(<BrandLogo />)
    expect(screen.getByText('Open-Source Onboarding')).toBeInTheDocument()
  })
})
