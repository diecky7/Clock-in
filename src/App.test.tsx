import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders_home_landmark', () => {
    render(<App />)
    expect(screen.getByRole('main', { name: 'Time clock' })).toBeInTheDocument()
  })
})
