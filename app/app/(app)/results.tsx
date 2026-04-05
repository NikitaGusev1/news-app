import React, { useState, useEffect, useCallback, useMemo } from 'react'
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

  const urls = useMemo<string[]>(() => {
    try {
      return JSON.parse(urlsParam ?? '[]')
    } catch {
      return [] // malformed param — backend will return 400
    }
  }, [urlsParam])

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AnalysisData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<SectionKey>('WHAT ALL SOURCES AGREE ON')

  const fetchAnalysis = useCallback(async () => {
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
  }, [urls])

  useEffect(() => {
    fetchAnalysis()
  }, [fetchAnalysis])

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

  if (!data) return null

  return (
    <View style={styles.container}>
      {data.meta.sources_fetched < data.meta.sources_requested && (
        <Text style={styles.warning}>
          Only {data.meta.sources_fetched} of {data.meta.sources_requested} sources could be fetched
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
        <Text style={styles.sectionText}>{data.sections[activeTab]}</Text>
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
