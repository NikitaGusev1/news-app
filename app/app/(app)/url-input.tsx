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
