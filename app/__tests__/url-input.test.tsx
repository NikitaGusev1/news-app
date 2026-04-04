import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import UrlInputScreen from '../app/(app)/url-input'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

describe('UrlInputScreen', () => {
  it('renders 2 URL inputs by default', () => {
    const { getByTestId, queryByTestId } = render(<UrlInputScreen />)
    expect(getByTestId('url-input-0')).toBeTruthy()
    expect(getByTestId('url-input-1')).toBeTruthy()
    expect(queryByTestId('url-input-2')).toBeNull()
  })

  it('disables Analyze button when fewer than 2 URLs are filled', () => {
    const { getByTestId } = render(<UrlInputScreen />)
    expect(getByTestId('analyze-button').props.accessibilityState?.disabled).toBe(true)
  })

  it('enables Analyze button when 2 URLs are filled', () => {
    const { getByTestId } = render(<UrlInputScreen />)
    fireEvent.changeText(getByTestId('url-input-0'), 'https://bbc.com/article')
    fireEvent.changeText(getByTestId('url-input-1'), 'https://cnn.com/article')
    expect(getByTestId('analyze-button').props.accessibilityState?.disabled).toBe(false)
  })

  it('reveals third URL input after pressing "+ Add source"', () => {
    const { getByTestId, queryByTestId } = render(<UrlInputScreen />)
    expect(queryByTestId('url-input-2')).toBeNull()
    fireEvent.press(getByTestId('add-source-button'))
    expect(getByTestId('url-input-2')).toBeTruthy()
  })

  it('hides "+ Add source" button once three inputs are shown', () => {
    const { getByTestId, queryByTestId } = render(<UrlInputScreen />)
    fireEvent.press(getByTestId('add-source-button'))
    expect(queryByTestId('add-source-button')).toBeNull()
  })
})
