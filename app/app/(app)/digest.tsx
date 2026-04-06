import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  TextInput,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import { API_BASE } from '../../constants/api'

type Story = {
  title: string
  sources: string[]
  urls: string[]
}

type DigestState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'done'; stories: Story[] }

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'done'; stories: Story[] }

export default function DigestScreen() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [digest, setDigest] = useState<DigestState>({ status: 'loading' })
  const [search, setSearch] = useState<SearchState>({ status: 'idle' })
  const [refreshing, setRefreshing] = useState(false)

  const fetchDigest = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/digest`)
      const data: Story[] = await res.json()
      setDigest({ status: 'done', stories: data })
    } catch {
      setDigest({ status: 'error' })
    }
  }, [])

  useEffect(() => {
    fetchDigest()
  }, [fetchDigest])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchDigest()
    setRefreshing(false)
  }

  useEffect(() => {
    if (!query.trim()) {
      setSearch({ status: 'idle' })
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setSearch({ status: 'loading' })
      try {
        const res = await fetch(
          `${API_BASE}/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal }
        )
        const data: Story[] = await res.json()
        setSearch({ status: 'done', stories: data })
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setSearch({ status: 'error' })
      }
    }, 400)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const handleStoryPress = (story: Story) => {
    router.push({
      pathname: '/(app)/results',
      params: { urls: JSON.stringify(story.urls) },
    })
  }

  const renderStory = ({ item }: { item: Story }) => (
    <Pressable
      testID={`story-${item.title}`}
      onPress={() => handleStoryPress(item)}
      style={styles.card}
    >
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text testID={`badges-${item.title}`} style={styles.cardBadges}>
        {item.sources.join(' · ')}
      </Text>
    </Pressable>
  )

  const isSearchMode = query.trim().length > 0

  let listData: Story[] = []
  let showDigestLoading = false
  let showDigestError = false
  let showSearchLoading = false
  let showSearchError = false
  let showNoResults = false

  if (isSearchMode) {
    if (search.status === 'loading') showSearchLoading = true
    else if (search.status === 'error') showSearchError = true
    else if (search.status === 'done') {
      listData = search.stories
      if (listData.length === 0) showNoResults = true
    }
  } else {
    if (digest.status === 'loading') showDigestLoading = true
    else if (digest.status === 'error') showDigestError = true
    else if (digest.status === 'done') listData = digest.stories
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
        {showSearchLoading && (
          <ActivityIndicator testID="search-spinner" style={styles.spinner} size="small" />
        )}
      </View>

      {showSearchError && (
        <Text testID="search-error" style={styles.feedbackText}>
          Search unavailable
        </Text>
      )}

      {showNoResults && (
        <Text testID="no-results" style={styles.feedbackText}>
          No results for {query.trim()}
        </Text>
      )}

      {showDigestLoading && (
        <View style={styles.center}>
          <ActivityIndicator testID="digest-loading" size="large" color="#007AFF" />
        </View>
      )}

      {showDigestError && (
        <View style={styles.center}>
          <Text testID="digest-error" style={styles.errorText}>
            Couldn't load digest
          </Text>
          <Pressable testID="retry-button" onPress={fetchDigest} style={styles.button}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      )}

      {!showDigestLoading && !showDigestError && (
        <FlatList
          testID="story-list"
          data={listData}
          keyExtractor={item => item.title}
          renderItem={renderStory}
          onRefresh={isSearchMode ? undefined : handleRefresh}
          refreshing={isSearchMode ? false : refreshing}
        />
      )}
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
  feedbackText: { color: '#888', fontSize: 13, marginBottom: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#c00', marginBottom: 16, textAlign: 'center' },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  card: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cardTitle: { fontSize: 15, color: '#111', marginBottom: 4 },
  cardBadges: { fontSize: 12, color: '#007AFF', fontWeight: '600' },
})
