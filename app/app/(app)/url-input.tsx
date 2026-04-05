import React, { useState, useEffect } from 'react'
import {
  View,
  TextInput,
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { API_BASE } from '../../constants/api'

const MAX_SOURCES = 3

type SearchResult = {
  title: string
  url: string
  source: string
}

export default function UrlInputScreen() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedArticles, setSelectedArticles] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setSearchError(null)
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(
          `${API_BASE}/search?q=${encodeURIComponent(query.trim())}`
        )
        const data: SearchResult[] = await res.json()
        setResults(data)
        setSearchError(null)
      } catch {
        setSearchError('Search unavailable')
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [query])

  const isSelected = (url: string) =>
    selectedArticles.some(a => a.url === url)

  const toggleSelect = (article: SearchResult) => {
    if (isSelected(article.url) || selectedArticles.length >= MAX_SOURCES) return
    setSelectedArticles(prev => [...prev, article])
  }

  const removeSelected = (url: string) => {
    setSelectedArticles(prev => prev.filter(a => a.url !== url))
  }

  const canAnalyze = selectedArticles.length >= 2

  const handleAnalyze = () => {
    router.push({
      pathname: '/(app)/results',
      params: { urls: JSON.stringify(selectedArticles.map(a => a.url)) },
    })
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          testID="search-input"
          value={query}
          onChangeText={setQuery}
          placeholder="Search for a topic…"
          autoCapitalize="none"
          style={styles.searchInput}
        />
        {searching && (
          <ActivityIndicator style={styles.spinner} size="small" />
        )}
      </View>

      {selectedArticles.map(article => (
        <View
          key={article.url}
          testID={`chip-${article.url}`}
          style={styles.chip}
        >
          <Text style={styles.chipText} numberOfLines={1}>
            {article.source} — {article.title}
          </Text>
          <Pressable
            testID={`chip-remove-${article.url}`}
            onPress={() => removeSelected(article.url)}
          >
            <Text style={styles.chipClose}>×</Text>
          </Pressable>
        </View>
      ))}

      {searchError != null && (
        <Text testID="search-error" style={styles.feedbackText}>
          {searchError}
        </Text>
      )}

      {results.length === 0 &&
        query.trim().length > 0 &&
        !searching &&
        searchError == null && (
          <Text testID="no-results" style={styles.feedbackText}>
            No results for {query.trim()}
          </Text>
        )}

      {results.length > 0 && searchError == null && (
        <ScrollView testID="results-list">
          {results.map(item => {
            const selected = isSelected(item.url)
            const isDisabled = selected || selectedArticles.length >= MAX_SOURCES
            return (
              <Pressable
                key={item.url}
                testID={`result-${item.url}`}
                onPress={() => toggleSelect(item)}
                disabled={isDisabled}
                accessibilityState={{ disabled: isDisabled }}
                style={[styles.result, selected && styles.resultSelected]}
              >
                <Text style={styles.resultTitle}>{item.title}</Text>
                <Text style={styles.resultSource}>{item.source}</Text>
              </Pressable>
            )
          })}
        </ScrollView>
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  spinner: { marginLeft: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F0FE',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
  },
  chipText: { flex: 1, fontSize: 13, color: '#333' },
  chipClose: { fontSize: 18, color: '#666', marginLeft: 8 },
  feedbackText: { color: '#888', fontSize: 13, marginBottom: 8 },
  result: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  resultSelected: { opacity: 0.4 },
  resultTitle: { fontSize: 14, color: '#111', marginBottom: 2 },
  resultSource: { fontSize: 12, color: '#007AFF', fontWeight: '600' },
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
