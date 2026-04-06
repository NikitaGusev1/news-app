import React from 'react'
import { render, fireEvent, act, waitFor } from '@testing-library/react-native'
import DigestScreen from '../app/(app)/digest'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('../constants/api', () => ({ API_BASE: 'http://localhost:8000' }))

const DIGEST_STORIES = [
  {
    title: 'Iran war enters week 6',
    sources: ['NPR', 'Al Jazeera'],
    urls: ['https://www.npr.org/iran-war', 'https://www.aljazeera.com/iran'],
  },
  {
    title: 'Climate summit opens',
    sources: ['NPR', 'DW'],
    urls: ['https://www.npr.org/climate', 'https://www.dw.com/climate'],
  },
]

beforeEach(() => {
  jest.useFakeTimers()
  global.fetch = jest.fn()
  mockPush.mockClear()
})

afterEach(() => {
  jest.useRealTimers()
  jest.resetAllMocks()
})

describe('digest mode', () => {
  it('fetches /digest on mount', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => DIGEST_STORIES,
    })
    render(<DigestScreen />)
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/digest')
    )
  })

  it('renders story cards with title and source badges', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => DIGEST_STORIES,
    })
    const { getByText } = render(<DigestScreen />)
    await waitFor(() => getByText('Iran war enters week 6'))
    expect(getByText('NPR · Al Jazeera')).toBeTruthy()
    expect(getByText('Climate summit opens')).toBeTruthy()
    expect(getByText('NPR · DW')).toBeTruthy()
  })

  it('shows loading indicator while digest fetches', () => {
    ;(global.fetch as jest.Mock).mockReturnValueOnce(new Promise(() => {}))
    const { getByTestId } = render(<DigestScreen />)
    expect(getByTestId('digest-loading')).toBeTruthy()
  })

  it('shows error state on digest fetch failure', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network'))
    const { getByTestId, getByText } = render(<DigestScreen />)
    await waitFor(() => getByTestId('digest-error'))
    expect(getByText("Couldn't load digest")).toBeTruthy()
    expect(getByTestId('retry-button')).toBeTruthy()
  })

  it('re-fetches digest when retry button pressed', async () => {
    ;(global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Network'))
      .mockResolvedValueOnce({ ok: true, json: async () => DIGEST_STORIES })
    const { getByTestId, getByText } = render(<DigestScreen />)
    await waitFor(() => getByTestId('retry-button'))
    fireEvent.press(getByTestId('retry-button'))
    await waitFor(() => getByText('Iran war enters week 6'))
  })

  it.skip('re-fetches digest on pull-to-refresh', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => DIGEST_STORIES })
      .mockResolvedValueOnce({ ok: true, json: async () => DIGEST_STORIES })
    const { getByTestId } = render(<DigestScreen />)
    await waitFor(() => getByTestId('story-list'))
    fireEvent(getByTestId('story-list'), 'refresh')
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
  })

  it('navigates to results with story URLs when story tapped', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => DIGEST_STORIES,
    })
    const { getByTestId } = render(<DigestScreen />)
    await waitFor(() => getByTestId(`story-${DIGEST_STORIES[0].title}`))
    fireEvent.press(getByTestId(`story-${DIGEST_STORIES[0].title}`))
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(app)/results',
      params: { urls: JSON.stringify(DIGEST_STORIES[0].urls) },
    })
  })
})

describe('search mode', () => {
  async function renderWithDigest() {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => DIGEST_STORIES,
    })
    const utils = render(<DigestScreen />)
    await waitFor(() => utils.getByTestId('story-list'))
    return utils
  }

  it('does not call search API before 400ms debounce', async () => {
    const utils = await renderWithDigest()
    fireEvent.changeText(utils.getByTestId('search-input'), 'iran')
    act(() => { jest.advanceTimersByTime(399) })
    expect(global.fetch).toHaveBeenCalledTimes(1) // only the initial digest fetch
  })

  it('calls /search after 400ms debounce', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => DIGEST_STORIES,
    })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [DIGEST_STORIES[0]],
    })
    const utils = render(<DigestScreen />)
    await waitFor(() => utils.getByTestId('story-list'))
    fireEvent.changeText(utils.getByTestId('search-input'), 'iran')
    act(() => { jest.advanceTimersByTime(400) })
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/search?q=iran',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    )
  })

  it('shows no-results message when search returns empty', async () => {
    const utils = await renderWithDigest()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })
    fireEvent.changeText(utils.getByTestId('search-input'), 'xyzzy')
    act(() => { jest.advanceTimersByTime(400) })
    await waitFor(() => utils.getByText('No results for xyzzy'))
  })

  it('shows search unavailable on network error', async () => {
    const utils = await renderWithDigest()
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network'))
    fireEvent.changeText(utils.getByTestId('search-input'), 'iran')
    act(() => { jest.advanceTimersByTime(400) })
    await waitFor(() => utils.getByTestId('search-error'))
  })

  it('returns to digest without re-fetching when search bar cleared', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => DIGEST_STORIES })
      .mockResolvedValueOnce({ ok: true, json: async () => [DIGEST_STORIES[0]] })
    const { getByTestId, getByText } = render(<DigestScreen />)
    await waitFor(() => getByText('Iran war enters week 6'))
    fireEvent.changeText(getByTestId('search-input'), 'iran')
    act(() => { jest.advanceTimersByTime(400) })
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
    // Clear search — digest stories reappear, no new fetch
    fireEvent.changeText(getByTestId('search-input'), '')
    await waitFor(() => getByText('Climate summit opens'))
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })
})
