import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { Share } from 'react-native'
import ResultsScreen from '../app/(app)/results'
import { API_BASE } from '../constants/api'

let mockUrlsParam: unknown = JSON.stringify([
  'https://bbc.com/article',
  'https://cnn.com/article',
])

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ urls: mockUrlsParam }),
}))

const URLS = ['https://bbc.com/article', 'https://cnn.com/article']

const MOCK_RESPONSE = {
  sections: {
    'WHAT ALL SOURCES AGREE ON': 'Agreed content here.',
    'HOW EACH SOURCE FRAMED IT': 'Framing content here.',
    'LANGUAGE WORTH NOTICING': 'Language content here.',
    'FACTS ONLY ONE SOURCE REPORTED': 'Unique content here.',
  },
  meta: { sources_fetched: 2, sources_requested: 2, tokens_used: 300 },
}

beforeEach(() => {
  global.fetch = jest.fn()
  mockUrlsParam = JSON.stringify(URLS)
  process.env.EXPO_PUBLIC_API_SECRET = 'test-secret'
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('ResultsScreen', () => {
  it('shows loading indicator before fetch completes', () => {
    ;(global.fetch as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // never resolves
    )
    const { getByTestId } = render(<ResultsScreen />)
    expect(getByTestId('loading-indicator')).toBeTruthy()
  })

  it('shows Agreed tab content after successful fetch', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_RESPONSE,
    })
    const { getByText } = render(<ResultsScreen />)
    await waitFor(() => expect(getByText('Agreed content here.')).toBeTruthy())
    expect(global.fetch).toHaveBeenCalledWith(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-secret',
      },
      body: JSON.stringify({ urls: URLS }),
      signal: expect.any(AbortSignal),
    })
  })

  it('keeps all four tab labels and switches their content', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_RESPONSE,
    })
    const { getByText, getByTestId } = render(<ResultsScreen />)
    await waitFor(() => getByText('Agreed content here.'))
    const tabs = [
      ['tab-agreed', 'Agreed', 'Agreed content here.'],
      ['tab-framing', 'Framing', 'Framing content here.'],
      ['tab-language', 'Language', 'Language content here.'],
      ['tab-unique', 'Unique', 'Unique content here.'],
    ]
    for (const [testID, label, content] of tabs) {
      expect(getByText(label)).toBeTruthy()
      fireEvent.press(getByTestId(testID))
      expect(getByText(content)).toBeTruthy()
    }
  })

  it.each([
    ['malformed JSON', '{not-json'],
    ['a non-array value', JSON.stringify({ url: URLS[0] })],
    ['an array with a non-string URL', JSON.stringify([URLS[0], 42])],
  ])('shows Invalid story and does not fetch for %s', (_label, param) => {
    mockUrlsParam = param
    const { getByText } = render(<ResultsScreen />)
    expect(getByText('Invalid story')).toBeTruthy()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it.each([
    [400, 'Need at least 2 sources'],
    [500, 'Analysis service unavailable'],
  ])('shows a readable retryable error for HTTP %s', async (status, detail) => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status,
      json: async () => ({ detail }),
    })
    const { getByText } = render(<ResultsScreen />)
    await waitFor(() => expect(getByText(detail)).toBeTruthy())
    expect(getByText('Try again')).toBeTruthy()
  })

  it('shows a retryable error when response JSON is invalid', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token')
      },
    })
    const { getByText } = render(<ResultsScreen />)
    await waitFor(() => expect(getByText('Invalid response from server')).toBeTruthy())
    expect(getByText('Try again')).toBeTruthy()
  })

  it('shows a retryable error for a network failure', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new TypeError('Network request failed'))
    const { getByText } = render(<ResultsScreen />)
    await waitFor(() => expect(getByText('Network request failed')).toBeTruthy())
    expect(getByText('Try again')).toBeTruthy()
  })

  it('re-fetches the same URLs and keeps a partial-source warning visible after retry', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Need at least 2 sources' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...MOCK_RESPONSE,
          meta: { sources_fetched: 1, sources_requested: 2, tokens_used: 200 },
        }),
      })
    const { getByText } = render(<ResultsScreen />)
    await waitFor(() => getByText('Try again'))
    fireEvent.press(getByText('Try again'))
    await waitFor(() => expect(getByText('Agreed content here.')).toBeTruthy())
    expect(getByText('Only 1 of 2 sources could be fetched')).toBeTruthy()
    expect(global.fetch).toHaveBeenCalledTimes(2)
    for (const call of (global.fetch as jest.Mock).mock.calls) {
      expect(call[1].body).toBe(JSON.stringify({ urls: URLS }))
    }
  })

  it('renders every tab safely when section keys and meta are missing', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sections: {} }),
    })
    const { getByText, getByTestId } = render(<ResultsScreen />)
    await waitFor(() => expect(getByText('No information available.')).toBeTruthy())
    for (const testID of ['tab-agreed', 'tab-framing', 'tab-language', 'tab-unique']) {
      fireEvent.press(getByTestId(testID))
      expect(getByText('No information available.')).toBeTruthy()
    }
  })

  it('aborts the analyze request when unmounted', () => {
    ;(global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}))
    const { unmount } = render(<ResultsScreen />)
    const signal = (global.fetch as jest.Mock).mock.calls[0][1].signal as AbortSignal
    expect(signal.aborted).toBe(false)
    unmount()
    expect(signal.aborted).toBe(true)
  })

  it('shows warning banner when sources_fetched < sources_requested', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...MOCK_RESPONSE,
        meta: { sources_fetched: 2, sources_requested: 3, tokens_used: 200 },
      }),
    })
    const { getByText } = render(<ResultsScreen />)
    await waitFor(() =>
      expect(getByText('Only 2 of 3 sources could be fetched')).toBeTruthy()
    )
  })

  it('calls Share.share with all 4 sections when Share is pressed', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValueOnce({ action: 'sharedAction' })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_RESPONSE,
    })
    const { getByTestId } = render(<ResultsScreen />)
    await waitFor(() => getByTestId('share-button'))
    fireEvent.press(getByTestId('share-button'))
    expect(shareSpy).toHaveBeenCalledWith({
      message: [
        'Agreed\nAgreed content here.',
        'Framing\nFraming content here.',
        'Language\nLanguage content here.',
        'Unique\nUnique content here.',
      ].join('\n\n'),
    })
  })
})
