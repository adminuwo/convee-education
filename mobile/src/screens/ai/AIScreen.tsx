import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { aiApi } from '../../lib/api';
import { Sparkles, Send, GraduationCap, BookOpen, MessageSquareText } from 'lucide-react-native';

export default function AIScreen() {
  const { currentOrg } = useAuth();
  const { colors } = useTheme();

  const [messages, setMessages] = useState<any[]>([
    {
      role: 'assistant',
      content: 'Hello! I am your Convee AI Academic Assistant. How can I help you today? You can ask me to generate quizzes, summarize campus updates, or check homework progress.',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const handleSend = async (customPrompt?: string) => {
    const text = (customPrompt || inputText).trim();
    if (!text) return;
    setInputText('');
    setLoading(true);

    const userMsg = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const res = await aiApi.chat(text, undefined, currentOrg?.id);
      const assistantMsg = { role: 'assistant', content: res.response || 'No response generated.' };
      setMessages((prev) => [...prev, assistantMsg]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Apologies, I encountered an issue connecting to the AI engine.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const PROMPTS = [
    { label: 'Generate 5 MCQs on Cell Biology 📝', prompt: 'Generate an Exam Question Bank with 5 MCQs and answer key on Cell Biology.' },
    { label: 'Check Homework Submissions 📚', prompt: 'Who has submitted homework and who is pending in my class?' },
    { label: 'Draft Parent Notice 📢', prompt: 'Draft a short announcement for parents regarding upcoming exam schedules.' },
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {/* Quick Prompts Carousel */}
        <View style={styles.presetsContainer}>
          <Text style={[styles.presetsTitle, { color: colors.textSecondary }]}>Suggested Prompts:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsRow}>
            {PROMPTS.map((p, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => handleSend(p.prompt)}
                style={[styles.presetChip, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Text style={[styles.presetText, { color: colors.text }]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Chat Messages */}
        {messages.map((m, idx) => {
          const isUser = m.role === 'user';
          return (
            <View
              key={idx}
              style={[
                styles.msgBubbleWrap,
                isUser ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' },
              ]}
            >
              <View
                style={[
                  styles.msgBubble,
                  isUser
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
                ]}
              >
                {!isUser && (
                  <View style={styles.aiLabelRow}>
                    <Sparkles size={12} color={colors.purple} />
                    <Text style={[styles.aiLabel, { color: colors.purple }]}>Convee AI</Text>
                  </View>
                )}
                <Text style={[styles.msgText, { color: isUser ? '#ffffff' : colors.text }]}>
                  {m.content}
                </Text>
              </View>
            </View>
          );
        })}

        {loading && (
          <View style={styles.loadingBubble}>
            <ActivityIndicator size="small" color={colors.purple} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Convee AI is thinking...</Text>
          </View>
        )}
      </ScrollView>

      {/* Input Bar */}
      <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask anything or request a quiz..."
          placeholderTextColor={colors.textMuted}
          style={[styles.textInput, { backgroundColor: colors.cardSecondary, color: colors.text }]}
        />
        <TouchableOpacity
          onPress={() => handleSend()}
          disabled={loading || !inputText.trim()}
          style={[styles.sendBtn, { backgroundColor: colors.purple }]}
        >
          <Send size={16} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  presetsContainer: { marginBottom: 14 },
  presetsTitle: { fontSize: 11, fontWeight: '600', marginBottom: 6 },
  presetsRow: { gap: 8 },
  presetChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  presetText: { fontSize: 11, fontWeight: '600' },
  msgBubbleWrap: { marginBottom: 14, maxWidth: '85%' },
  msgBubble: { padding: 14, borderRadius: 16 },
  aiLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  aiLabel: { fontSize: 10, fontWeight: '800' },
  msgText: { fontSize: 13, lineHeight: 19 },
  loadingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  loadingText: { fontSize: 12 },
  inputBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, gap: 10 },
  textInput: { flex: 1, height: 42, borderRadius: 20, paddingHorizontal: 16, fontSize: 13 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});
