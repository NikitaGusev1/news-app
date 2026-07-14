import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'

import DigestScreen from '../app/(app)/digest'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('../constants/api', () => ({ API_BASE: 'http://localhost:8000' }))

const STORIES = [
  {
    title: 'Ceasefire talks resume after overnight negotiations',
    sources: ['NPR', 'Al Jazeera', 'DW'],
    urls: [
      'https://www.npr.org/2026/07/14/ceasefire-talks',
      'https://www.aljazeera.com/news/2026/7/14/ceasefire-talks',
      'https://www.dw.com/en/ceasefire-talks/a-123',
    ],
  },
  {
    title: 'Parliament approves the revised climate package',
    sources: ['Reuters', 'BBC'],
    urls: [
      'https://www.reuters.com/world/climate-package-2026-07-14/',
      'https://www.bbc.com/news/articles/climate-package',
    ],
  },
]

function responseWith(stories: typeof STORIES | []) {
  return Promise.resolve({
    ok: true,
    json: async () => stories,
  })
}

beforeEach(() => {
  global.fetch = jest.fn()
  mockPush.mockClear()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('digest home', () => {
  it('shows a first-load indicator while the digest request is pending', () => {
    ;(global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}))

    const { getByTestId } = render(<DigestScreen />)

    expect(getByTestId('digest-loading')).toBeTruthy()
  })

  it('renders story titles and their sources', async () => {
    ;(global.fetch as jest.Mock).mockReturnValue(responseWith(STORIES))

    const { getByText } = render(<DigestScreen />)

    await waitFor(() => expect(getByText(STORIES[0].title)).toBeTruthy())
    expect(getByText(STORIES[1].title)).toBeTruthy()
    expect(getByText('NPR · Al Jazeera · DW')).toBeTruthy()
    expect(getByText('Reuters · BBC')).toBeTruthy()
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/digest',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('shows an empty state when the digest has no stories', async () => {
    ;(global.fetch as jest.Mock).mockReturnValue(responseWith([]))

    const { getByText } = render(<DigestScreen />)

    await waitFor(() =>
      expect(getByText('No stories in your digest yet.')).toBeTruthy()
    )
  })

  it('shows an error and retries the digest request', async () => {
    ;(global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockReturnValueOnce(responseWith(STORIES))

    const { getByText } = render(<DigestScreen />)

    await waitFor(() =>
      expect(getByText('Unable to load your digest')).toBeTruthy()
    )
    fireEvent.press(getByText('Retry'))

    await waitFor(() => expect(getByText(STORIES[0].title)).toBeTruthy())
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('refreshes the digest without replacing its content with first-load UI', async () => {
    let finishRefresh!: (value: {
      ok: boolean
      json: () => Promise<typeof STORIES>
    }) => void
    const refreshResponse = new Promise<{
      ok: boolean
      json: () => Promise<typeof STORIES>
    }>((resolve) => {
      finishRefresh = resolve
    })

    ;(global.fetch as jest.Mock)
      .mockReturnValueOnce(responseWith(STORIES))
      .mockReturnValueOnce(refreshResponse)

    const { getByTestId, getByText, queryByTestId } = render(<DigestScreen />)
    await waitFor(() => expect(getByText(STORIES[0].title)).toBeTruthy())

    act(() => {
      getByTestId('digest-list').props.refreshControl.props.onRefresh()
    })

    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(getByText(STORIES[0].title)).toBeTruthy()
    expect(queryByTestId('digest-loading')).toBeNull()

    await act(async () => {
      finishRefresh({ ok: true, json: async () => STORIES })
      await refreshResponse
    })
  })

  it('cancels an in-flight digest request when the screen unmounts', () => {
    ;(global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}))

    const { unmount } = render(<DigestScreen />)
    const request = (global.fetch as jest.Mock).mock.calls[0]
    const signal = request[1].signal as AbortSignal

    expect(signal.aborted).toBe(false)
    unmount()
    expect(signal.aborted).toBe(true)
  })

  it('opens results with the full, ordered URL list for the story', async () => {
    ;(global.fetch as jest.Mock).mockReturnValue(responseWith(STORIES))

    const { getByText } = render(<DigestScreen />)
    await waitFor(() => expect(getByText(STORIES[0].title)).toBeTruthy())

    fireEvent.press(getByText(STORIES[0].title))

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(app)/results',
      params: { urls: JSON.stringify(STORIES[0].urls) },
    })
  })

  it('does not expose search, manual URL input, or Analyze controls', async () => {
    ;(global.fetch as jest.Mock).mockReturnValue(responseWith(STORIES))

    const { getByText, queryByTestId, queryByText } = render(<DigestScreen />)
    await waitFor(() => expect(getByText(STORIES[0].title)).toBeTruthy())

    expect(queryByTestId('search-input')).toBeNull()
    expect(queryByTestId('url-input')).toBeNull()
    expect(queryByTestId('analyze-button')).toBeNull()
    expect(queryByText('Analyze')).toBeNull()
  })
})
