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

const TABS = [
  { key: 'WHAT ALL SOURCES AGREE ON' as const, label: 'Agreed', testID: 'tab-agreed' },
  { key: 'HOW EACH SOURCE FRAMED IT' as const, label: 'Framing', testID: 'tab-framing' },
  { key: 'LANGUAGE WORTH NOTICING' as const, label: 'Language', testID: 'tab-language' },
  { key: 'FACTS ONLY ONE SOURCE REPORTED' as const, label: 'Unique', testID: 'tab-unique' },
]

type SectionKey = (typeof TABS)[number]['key']
type Sections = Partial<Record<SectionKey, string>>

type AnalysisData = {
  sections: Sections
  meta?: { sources_fetched?: number; sources_requested?: number; tokens_used?: number }
}

const MISSING_SECTION_TEXT = 'No information available.'

function parseUrls(urlsParam: string | string[] | undefined): string[] | null {
  if (typeof urlsParam !== 'string') return null

  try {
    const parsed: unknown = JSON.parse(urlsParam)
    return Array.isArray(parsed) && parsed.every(url => typeof url === 'string')
      ? parsed
      : null
  } catch {
    return null
  }
}

function isAnalysisData(value: unknown): value is AnalysisData {
  if (!value || typeof value !== 'object') return false
  const sections = (value as { sections?: unknown }).sections
  if (!sections || typeof sections !== 'object' || Array.isArray(sections)) return false
  return TABS.every(({ key }) => {
    const section = (sections as Record<string, unknown>)[key]
    return section === undefined || typeof section === 'string'
  })
}

export default function ResultsScreen() {
  const { urls: urlsParam } = useLocalSearchParams<{ urls: string }>()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AnalysisData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<SectionKey>(TABS[0].key)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const urls = parseUrls(urlsParam)
    if (!urls) {
      setData(null)
      setLoading(false)
      setError('Invalid story')
      return
    }

    const controller = new AbortController()
    let active = true
    setLoading(true)
    setError(null)
    setData(null)

    const analyze = async () => {
      try {
        const response = await fetch(`${API_BASE}/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.EXPO_PUBLIC_API_SECRET ?? '',
          },
          body: JSON.stringify({ urls }),
          signal: controller.signal,
        })

        if (!response.ok) {
          let detail: string | undefined
          try {
            const body: unknown = await response.json()
            if (
              body &&
              typeof body === 'object' &&
              typeof (body as { detail?: unknown }).detail === 'string'
            ) {
              detail = (body as { detail: string }).detail
            }
          } catch {
            // The HTTP status still provides a useful error when the body is not JSON.
          }
          const status = typeof response.status === 'number' ? ` (${response.status})` : ''
          throw new Error(detail ?? `Analysis failed${status}`)
        }

        let result: unknown
        try {
          result = await response.json()
        } catch {
          throw new Error('Invalid response from server')
        }
        if (!isAnalysisData(result)) {
          throw new Error('Invalid response from server')
        }

        if (active) setData(result)
      } catch (caught) {
        if (active && (caught as Error)?.name !== 'AbortError') {
          setError(caught instanceof Error ? caught.message : 'Something went wrong')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void analyze()

    return () => {
      active = false
      controller.abort()
    }
  }, [urlsParam, retryCount])

  const handleShare = () => {
    if (!data) return
    const message = TABS.map(
      ({ key, label }) => `${label}\n${data.sections[key] ?? MISSING_SECTION_TEXT}`
    ).join('\n\n')
    void Share.share({ message }).catch(() => undefined)
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
        <Pressable onPress={() => setRetryCount(c => c + 1)} style={styles.button}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {typeof data?.meta?.sources_fetched === 'number' &&
        typeof data.meta.sources_requested === 'number' &&
        data.meta.sources_fetched < data.meta.sources_requested && (
          <Text style={styles.warning}>
            {`Only ${data.meta.sources_fetched} of ${data.meta.sources_requested} sources could be fetched`}
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
        <Text style={styles.sectionText}>
          {data?.sections?.[activeTab] ?? MISSING_SECTION_TEXT}
        </Text>
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
