import React from 'react'
import { render, fireEvent, act, waitFor } from '@testing-library/react-native'
import UrlInputScreen from '../app/(app)/url-input'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('../constants/api', () => ({ API_BASE: 'http://localhost:8000' }))

const SEARCH_RESULTS = [
  {
    title: 'Iran war enters week 6',
    url: 'https://www.npr.org/2026/04/04/iran-war',
    source: 'NPR',
  },
  {
    title: 'Iran: 48 hours ultimatum',
    url: 'https://www.aljazeera.com/news/2026/4/4/iran',
    source: 'Al Jazeera',
  },
  {
    title: 'Iraq drawn into Iran war',
    url: 'https://www.dw.com/en/iraq-iran/a-123',
    source: 'DW',
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

// Renders component, triggers a search, and waits for results to appear.
async function renderWithResults() {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => SEARCH_RESULTS,
  })
  const utils = render(<UrlInputScreen />)
  fireEvent.changeText(utils.getByTestId('search-input'), 'iran')
  act(() => {
    jest.advanceTimersByTime(400)
  })
  await waitFor(() =>
    utils.getByTestId(`result-${SEARCH_RESULTS[0].url}`)
  )
  return utils
}

describe('initial state', () => {
  it('shows only search bar and disabled Analyze button', () => {
    const { getByTestId, queryByTestId } = render(<UrlInputScreen />)
    expect(getByTestId('search-input')).toBeTruthy()
    expect(getByTestId('analyze-button').props.accessibilityState.disabled).toBe(true)
    expect(queryByTestId(`result-${SEARCH_RESULTS[0].url}`)).toBeNull()
  })
})

describe('debounce', () => {
  it('does not call search API before 400ms', () => {
    const { getByTestId } = render(<UrlInputScreen />)
    fireEvent.changeText(getByTestId('search-input'), 'iran')
    jest.advanceTimersByTime(399)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('calls search API with encoded query after 400ms', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })
    const { getByTestId } = render(<UrlInputScreen />)
    fireEvent.changeText(getByTestId('search-input'), 'iran')
    act(() => {
      jest.advanceTimersByTime(400)
    })
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/search?q=iran',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    )
  })

  it('does not call search API for blank input', () => {
    const { getByTestId } = render(<UrlInputScreen />)
    fireEvent.changeText(getByTestId('search-input'), '   ')
    act(() => {
      jest.advanceTimersByTime(400)
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

describe('results list', () => {
  it('renders title and source badge for each result', async () => {
    const { getByText } = await renderWithResults()
    expect(getByText('Iran war enters week 6')).toBeTruthy()
    expect(getByText('NPR')).toBeTruthy()
    expect(getByText('Iran: 48 hours ultimatum')).toBeTruthy()
    expect(getByText('Al Jazeera')).toBeTruthy()
  })

  it('shows no-results message when API returns empty array', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })
    const { getByTestId, getByText } = render(<UrlInputScreen />)
    fireEvent.changeText(getByTestId('search-input'), 'xyzzy')
    act(() => {
      jest.advanceTimersByTime(400)
    })
    await waitFor(() => expect(getByText('No results for xyzzy')).toBeTruthy())
  })

  it('shows search unavailable on network error', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network'))
    const { getByTestId, getByText } = render(<UrlInputScreen />)
    fireEvent.changeText(getByTestId('search-input'), 'iran')
    act(() => {
      jest.advanceTimersByTime(400)
    })
    await waitFor(() => expect(getByText('Search unavailable')).toBeTruthy())
  })
})

describe('article selection', () => {
  it('tapping a result adds it as a chip', async () => {
    const { getByTestId } = await renderWithResults()
    fireEvent.press(getByTestId(`result-${SEARCH_RESULTS[0].url}`))
    expect(getByTestId(`chip-${SEARCH_RESULTS[0].url}`)).toBeTruthy()
  })

  it('selected result is disabled', async () => {
    const { getByTestId } = await renderWithResults()
    fireEvent.press(getByTestId(`result-${SEARCH_RESULTS[0].url}`))
    const resultEl = getByTestId(`result-${SEARCH_RESULTS[0].url}`)
    expect(resultEl.props.accessibilityState.disabled).toBe(true)
  })

  it('tapping chip × removes article from selection', async () => {
    const { getByTestId, queryByTestId } = await renderWithResults()
    fireEvent.press(getByTestId(`result-${SEARCH_RESULTS[0].url}`))
    fireEvent.press(getByTestId(`chip-remove-${SEARCH_RESULTS[0].url}`))
    expect(queryByTestId(`chip-${SEARCH_RESULTS[0].url}`)).toBeNull()
  })
})

describe('analyze button', () => {
  it('is disabled with 1 article selected', async () => {
    const { getByTestId } = await renderWithResults()
    fireEvent.press(getByTestId(`result-${SEARCH_RESULTS[0].url}`))
    expect(getByTestId('analyze-button').props.accessibilityState.disabled).toBe(true)
  })

  it('is enabled with 2 articles selected', async () => {
    const { getByTestId } = await renderWithResults()
    fireEvent.press(getByTestId(`result-${SEARCH_RESULTS[0].url}`))
    fireEvent.press(getByTestId(`result-${SEARCH_RESULTS[1].url}`))
    expect(getByTestId('analyze-button').props.accessibilityState.disabled).toBe(false)
  })

  it('navigates to results screen with selected article URLs', async () => {
    const { getByTestId } = await renderWithResults()
    fireEvent.press(getByTestId(`result-${SEARCH_RESULTS[0].url}`))
    fireEvent.press(getByTestId(`result-${SEARCH_RESULTS[1].url}`))
    fireEvent.press(getByTestId('analyze-button'))
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(app)/results',
      params: {
        urls: JSON.stringify([
          SEARCH_RESULTS[0].url,
          SEARCH_RESULTS[1].url,
        ]),
      },
    })
  })
})
