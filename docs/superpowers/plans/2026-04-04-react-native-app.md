# React Native App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Expo React Native app at `app/` that collects 2–3 article URLs, calls the FastAPI backend, and displays a 4-tab analysis results screen.

**Architecture:** Expo Router file-based navigation with a root redirect and two screens. URL input screen collects URLs via controlled TextInputs and pushes to a results screen via Expo Router search params. Results screen fetches `POST /analyze` in a useEffect, holds state locally, and renders tabs with ScrollView. No global state, no external state library.

**Tech Stack:** Expo SDK, Expo Router, React Native, TypeScript, Jest (jest-expo preset), React Native Testing Library v12

---

## File Map

| File | Purpose |
|---|---|
| `app/app/_layout.tsx` | Root Stack navigator — wraps all screens |
| `app/app/index.tsx` | Root redirect → `/(app)/url-input` |
| `app/app/(app)/url-input.tsx` | URL input screen: 2–3 TextInputs, Analyze button |
| `app/app/(app)/results.tsx` | Results screen: fetch /analyze, 4 tabs, Share button |
| `app/constants/api.ts` | `API_BASE` constant |
| `app/__tests__/url-input.test.tsx` | Unit tests for url-input screen |
| `app/__tests__/results.test.tsx` | Unit tests for results screen |
| `app/package.json` | Expo project config + jest config |
| `app/app.json` | Expo app config with scheme and expo-router plugin |

---

## Task 1: Scaffold Expo Project

**Files:**
- Create: `app/` (via create-expo-app)
- Modify: `app/package.json`
- Modify: `app/app.json`
- Delete: `app/App.tsx`

- [ ] **Step 1: Scaffold blank TypeScript Expo project**

Run from repo root (`/Users/nikita/Desktop/repos/news-app`):

```bash
npx create-expo-app@latest app --template blank-typescript
```

Expected: directory `app/` created with `App.tsx`, `package.json`, `app.json`, `tsconfig.json`, `babel.config.js`.

- [ ] **Step 2: Install Expo Router and its peer dependencies**

```bash
cd app && npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
```

Expected: packages added to `app/node_modules`, `package.json` dependencies updated.

- [ ] **Step 3: Update `app/package.json` — set entry point and jest config**

In `app/package.json`, change the `"main"` field to `"expo-router/entry"`, and add a `"jest"` block. The final relevant sections should look like this (merge with whatever create-expo-app generated — do not remove existing fields):

```json
{
  "main": "expo-router/entry",
  "jest": {
    "preset": "jest-expo",
    "setupFilesAfterEnv": ["@testing-library/react-native/extend-expect"],
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)"
    ]
  }
}
```

- [ ] **Step 4: Update `app/app.json` — add scheme and expo-router plugin**

Replace the contents of `app/app.json` with:

```json
{
  "expo": {
    "name": "news-debias",
    "slug": "news-debias",
    "version": "1.0.0",
    "scheme": "news-debias",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "userInterfaceStyle": "automatic",
    "web": {
      "bundler": "metro",
      "output": "static",
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      "expo-router"
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

Note: the `icon` and `favicon` paths come from what create-expo-app generates — adjust them to match whatever assets exist in the project. The key additions are `"scheme"`, `"plugins": ["expo-router"]`, and `"web": { "bundler": "metro" }`.

- [ ] **Step 5: Delete `app/App.tsx`**

```bash
rm app/App.tsx
```

Expo Router uses `"expo-router/entry"` as the entry point, so `App.tsx` is no longer needed and will cause a conflict if left.

- [ ] **Step 6: Install test dependencies**

```bash
cd app && npm install --save-dev @testing-library/react-native jest-expo
```

- [ ] **Step 7: Verify the project structure**

```bash
ls app/
```

Expected output includes: `app.json  assets  babel.config.js  constants  node_modules  package.json  tsconfig.json`
(No `App.tsx`)

- [ ] **Step 8: Commit**

```bash
cd /Users/nikita/Desktop/repos/news-app
git add app/
git commit -m "chore: scaffold Expo project with expo-router"
```

---

## Task 2: App Shell — Layout, Redirect, and Constants

**Files:**
- Create: `app/app/_layout.tsx`
- Create: `app/app/index.tsx`
- Create: `app/constants/api.ts`
- Create: `app/app/(app)/` (directory — will be populated in later tasks)

- [ ] **Step 1: Create `app/constants/api.ts`**

```ts
export const API_BASE = 'http://localhost:8000'
```

- [ ] **Step 2: Create `app/app/_layout.tsx`**

```tsx
import { Stack } from 'expo-router'

export default function RootLayout() {
  return <Stack />
}
```

- [ ] **Step 3: Create `app/app/index.tsx`**

```tsx
import { Redirect } from 'expo-router'

export default function Index() {
  return <Redirect href="/(app)/url-input" />
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/nikita/Desktop/repos/news-app
git add app/app/ app/constants/
git commit -m "chore: add root layout, redirect, and API constant"
```

---

## Task 3: URL Input Screen (TDD)

**Files:**
- Create: `app/__tests__/url-input.test.tsx`
- Create: `app/app/(app)/url-input.tsx`

- [ ] **Step 1: Write failing tests**

Create `app/__tests__/url-input.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd app && npx jest __tests__/url-input.test.tsx --no-coverage
```

Expected: `Cannot find module '../app/(app)/url-input'`

- [ ] **Step 3: Create `app/app/(app)/url-input.tsx`**

```tsx
import React, { useState } from 'react'
import { View, TextInput, Pressable, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'

export default function UrlInputScreen() {
  const router = useRouter()
  const [urls, setUrls] = useState<string[]>(['', ''])

  const updateUrl = (index: number, value: string) => {
    const next = [...urls]
    next[index] = value
    setUrls(next)
  }

  const filledCount = urls.filter(u => u.trim().length > 0).length
  const canAnalyze = filledCount >= 2

  const handleAnalyze = () => {
    const nonEmpty = urls.filter(u => u.trim().length > 0)
    router.push({ pathname: '/(app)/results', params: { urls: JSON.stringify(nonEmpty) } })
  }

  return (
    <View style={styles.container}>
      {urls.map((url, i) => (
        <TextInput
          key={i}
          testID={`url-input-${i}`}
          value={url}
          onChangeText={v => updateUrl(i, v)}
          placeholder={`Article URL ${i + 1}`}
          autoCapitalize="none"
          keyboardType="url"
          style={styles.input}
        />
      ))}
      {urls.length < 3 && (
        <Pressable
          testID="add-source-button"
          onPress={() => setUrls([...urls, ''])}
        >
          <Text style={styles.addSource}>+ Add source</Text>
        </Pressable>
      )}
      <Pressable
        testID="analyze-button"
        disabled={!canAnalyze}
        accessibilityState={{ disabled: !canAnalyze }}
        onPress={handleAnalyze}
        style={[styles.button, !canAnalyze && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>Analyze</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 15,
  },
  addSource: { color: '#007AFF', marginBottom: 16, fontSize: 15 },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { backgroundColor: '#ccc' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd app && npx jest __tests__/url-input.test.tsx --no-coverage
```

Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
cd /Users/nikita/Desktop/repos/news-app
git add app/app/\(app\)/url-input.tsx app/__tests__/url-input.test.tsx
git commit -m "feat: add URL input screen with tests"
```

---

## Task 4: Results Screen (TDD)

**Files:**
- Create: `app/__tests__/results.test.tsx`
- Create: `app/app/(app)/results.tsx`

- [ ] **Step 1: Write failing tests**

Create `app/__tests__/results.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd app && npx jest __tests__/results.test.tsx --no-coverage
```

Expected: `Cannot find module '../app/(app)/results'`

- [ ] **Step 3: Create `app/app/(app)/results.tsx`**

```tsx
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
} from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { API_BASE } from '../../constants/api'

type Sections = {
  'WHAT ALL SOURCES AGREE ON': string
  'HOW EACH SOURCE FRAMED IT': string
  'LANGUAGE WORTH NOTICING': string
  'FACTS ONLY ONE SOURCE REPORTED': string
}

type AnalysisData = {
  sections: Sections
  meta: { sources_fetched: number; sources_requested: number; tokens_used: number }
}

const TABS = [
  { key: 'WHAT ALL SOURCES AGREE ON' as const, label: 'Agreed', testID: 'tab-agreed' },
  { key: 'HOW EACH SOURCE FRAMED IT' as const, label: 'Framing', testID: 'tab-framing' },
  { key: 'LANGUAGE WORTH NOTICING' as const, label: 'Language', testID: 'tab-language' },
  { key: 'FACTS ONLY ONE SOURCE REPORTED' as const, label: 'Unique', testID: 'tab-unique' },
]

type SectionKey = (typeof TABS)[number]['key']

export default function ResultsScreen() {
  const { urls: urlsParam } = useLocalSearchParams<{ urls: string }>()
  const urls: string[] = JSON.parse(urlsParam ?? '[]')

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AnalysisData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<SectionKey>('WHAT ALL SOURCES AGREE ON')

  const fetchAnalysis = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.detail ?? 'Analysis failed')
      }
      setData(await res.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalysis()
  }, [])

  const handleShare = () => {
    if (!data) return
    const message = TABS.map(({ key, label }) => `${label}\n${data.sections[key]}`).join('\n\n')
    Share.share({ message })
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator testID="loading-indicator" size="large" color="#007AFF" />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <Pressable onPress={fetchAnalysis} style={styles.button}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {data!.meta.sources_fetched < data!.meta.sources_requested && (
        <Text style={styles.warning}>
          Only {data!.meta.sources_fetched} of {data!.meta.sources_requested} sources could be fetched
        </Text>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map(({ key, label, testID }) => (
          <Pressable
            key={key}
            testID={testID}
            onPress={() => setActiveTab(key)}
            style={[styles.tab, activeTab === key && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView style={styles.content}>
        <Text style={styles.sectionText}>{data!.sections[activeTab]}</Text>
      </ScrollView>
      <Pressable testID="share-button" onPress={handleShare} style={styles.shareButton}>
        <Text style={styles.shareText}>Share</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  warning: {
    backgroundColor: '#FFF3CD',
    color: '#856404',
    padding: 12,
    textAlign: 'center',
    fontSize: 14,
  },
  tabBar: { flexGrow: 0, borderBottomWidth: 1, borderColor: '#eee' },
  tabBarContent: { paddingHorizontal: 4 },
  tab: { paddingHorizontal: 20, paddingVertical: 14 },
  tabActive: { borderBottomWidth: 2, borderColor: '#007AFF' },
  tabText: { color: '#666', fontSize: 15 },
  tabTextActive: { color: '#007AFF', fontWeight: '600' },
  content: { flex: 1, padding: 20 },
  sectionText: { fontSize: 16, lineHeight: 26, color: '#111' },
  error: { fontSize: 16, color: '#c00', marginBottom: 16, textAlign: 'center' },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  shareButton: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#eee',
  },
  shareText: { color: '#007AFF', fontSize: 15, fontWeight: '600' },
})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd app && npx jest __tests__/results.test.tsx --no-coverage
```

Expected: 6 passed

- [ ] **Step 5: Run all app tests**

```bash
cd app && npx jest --no-coverage
```

Expected: 11 passed (5 url-input + 6 results)

- [ ] **Step 6: Commit**

```bash
cd /Users/nikita/Desktop/repos/news-app
git add app/app/\(app\)/results.tsx app/__tests__/results.test.tsx
git commit -m "feat: add results screen with tests"
```

---

## Task 5: Manual Smoke Test

- [ ] **Step 1: Start the backend (in a separate terminal)**

```bash
cd /Users/nikita/Desktop/repos/news-app/backend
ANTHROPIC_API_KEY=<your_key> uvicorn main:app --reload --port 8000
```

Expected: `INFO: Uvicorn running on http://127.0.0.1:8000`

- [ ] **Step 2: Start the Expo app**

```bash
cd /Users/nikita/Desktop/repos/news-app/app
npx expo start
```

Press `i` for iOS simulator or `a` for Android.

- [ ] **Step 3: Verify URL input screen**

- App loads on the url-input screen (redirect from index worked)
- Two URL inputs visible, Analyze button greyed out
- Type a URL in first input → button still grey
- Type a URL in second input → button turns blue
- Press "+ Add source" → third input appears, button disappears

- [ ] **Step 4: Verify results screen**

- Press Analyze with 2 valid article URLs → loading spinner appears
- After ~5–10s → 4 tabs appear, Agreed tab is active, content shown
- Tap Framing, Language, Unique tabs → content switches
- Press Share → native share sheet appears with all 4 sections in the message

- [ ] **Step 5: Verify error state**

- Go back, enter 2 invalid URLs (e.g. `https://thisdomaindoesnotexist99999.com/a`)
- Press Analyze → loading spinner, then error message "Need at least 2 sources to compare, only got 0."
- Press "Try again" → re-fetches (same error expected with invalid URLs)

- [ ] **Step 6: Final commit**

```bash
cd /Users/nikita/Desktop/repos/news-app
git add .
git commit -m "feat: React Native app complete"
```
