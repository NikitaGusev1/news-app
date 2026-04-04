import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { Share } from 'react-native'
import ResultsScreen from '../app/(app)/results'

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({
    urls: JSON.stringify(['https://bbc.com/article', 'https://cnn.com/article']),
  }),
}))

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
  })

  it('switches tab content when a different tab is pressed', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_RESPONSE,
    })
    const { getByText, getByTestId } = render(<ResultsScreen />)
    await waitFor(() => getByText('Agreed content here.'))
    fireEvent.press(getByTestId('tab-framing'))
    expect(getByText('Framing content here.')).toBeTruthy()
  })

  it('shows error message and Try again button on failed fetch', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: 'Need at least 2 sources' }),
    })
    const { getByText } = render(<ResultsScreen />)
    await waitFor(() => expect(getByText('Need at least 2 sources')).toBeTruthy())
    expect(getByText('Try again')).toBeTruthy()
  })

  it('re-fetches when Try again is pressed', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: 'Need at least 2 sources' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_RESPONSE,
      })
    const { getByText } = render(<ResultsScreen />)
    await waitFor(() => getByText('Try again'))
    fireEvent.press(getByText('Try again'))
    await waitFor(() => expect(getByText('Agreed content here.')).toBeTruthy())
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
    expect(shareSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Agreed content here.') })
    )
  })
})
