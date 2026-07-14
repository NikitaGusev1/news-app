import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { API_BASE } from '../../constants/api'

export type DigestStory = {
  title: string
  summary: string
  sources: string[]
  urls: string[]
}

export default function DigestScreen() {
  const router = useRouter()
  const controllerRef = useRef<AbortController | null>(null)
  const [stories, setStories] = useState<DigestStory[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDigest = useCallback(async (isRefresh = false) => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      const response = await fetch(`${API_BASE}/digest`, {
        signal: controller.signal,
      })
      if (response.ok === false) {
        throw new Error(`Digest request failed with ${response.status}`)
      }

      const data: DigestStory[] = await response.json()
      if (!controller.signal.aborted) {
        setStories(data)
      }
    } catch (requestError) {
      if (
        controller.signal.aborted ||
        (requestError as Error).name === 'AbortError'
      ) {
        return
      }
      setStories([])
      setError('Unable to load your digest')
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    fetchDigest()
    return () => controllerRef.current?.abort()
  }, [fetchDigest])

  const openStory = (story: DigestStory) => {
    router.push({
      pathname: '/(app)/results',
      params: { urls: JSON.stringify(story.urls) },
    })
  }

  if (loading) {
    return (
      <View testID="digest-loading" style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.statusText}>Loading your digest…</Text>
      </View>
    )
  }

  if (error != null) {
    return (
      <View testID="digest-error" style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable
          accessibilityRole="button"
          testID="digest-retry"
          onPress={() => fetchDigest()}
          style={styles.retryButton}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Your digest</Text>
      <FlatList
        testID="digest-list"
        data={stories}
        keyExtractor={(story, index) =>
          story.urls.join('|') || `${story.title}-${index}`
        }
        refreshing={refreshing}
        onRefresh={() => fetchDigest(true)}
        contentContainerStyle={
          stories.length === 0 ? styles.emptyList : styles.list
        }
        ListEmptyComponent={
          <Text testID="digest-empty" style={styles.statusText}>
            No stories in your digest yet.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            testID={`digest-story-${item.urls[0] ?? item.title}`}
            onPress={() => openStory(item)}
            style={({ pressed }) => [
              styles.story,
              pressed && styles.storyPressed,
            ]}
          >
            <Text style={styles.storyTitle}>{item.title}</Text>
            <Text style={styles.summary}>{item.summary}</Text>
            {item.sources.length > 0 && (
              <Text style={styles.sources}>{item.sources.join(' · ')}</Text>
            )}
          </Pressable>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 60,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  heading: {
    color: '#111',
    fontSize: 28,
    fontWeight: '700',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  emptyList: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  story: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    paddingVertical: 18,
  },
  storyPressed: { opacity: 0.6 },
  storyTitle: {
    color: '#111',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  summary: {
    color: '#3A3A3C',
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 10,
  },
  sources: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '600',
  },
  statusText: {
    color: '#636366',
    fontSize: 15,
    marginTop: 12,
    textAlign: 'center',
  },
  errorText: {
    color: '#C62828',
    fontSize: 15,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})
