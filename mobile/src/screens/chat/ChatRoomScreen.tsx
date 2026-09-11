import React, { useEffect, useState, useRef } from 'react';
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
import { channelApi } from '../../lib/api';
import { Send, ArrowLeft } from 'lucide-react-native';

export default function ChatRoomScreen({ route, navigation }: any) {
  const { channelId, channelName } = route.params;
  const { user } = useAuth();
  const { colors } = useTheme();

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    navigation.setOptions({
      title: `# ${channelName}`,
      headerStyle: { backgroundColor: colors.card },
      headerTintColor: colors.text,
    });
  }, [channelName, colors, navigation]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const res = await channelApi.getMessages(channelId);
      setMessages(res || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [channelId]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText('');
    setSending(true);
    try {
      const res = await channelApi.sendMessage(channelId, text);
      setMessages((prev) => [...prev, res]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {messages.map((m) => {
            const isMe = m.senderId === user?.id || m.sender?.id === user?.id;

            return (
              <View
                key={m.id}
                style={[
                  styles.bubbleContainer,
                  isMe ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' },
                ]}
              >
                {!isMe && (
                  <Text style={[styles.senderName, { color: colors.textMuted }]}>
                    {m.sender?.fullName || m.sender?.email || 'User'}
                  </Text>
                )}
                <View
                  style={[
                    styles.bubble,
                    isMe
                      ? { backgroundColor: colors.primary }
                      : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
                  ]}
                >
                  <Text style={[styles.bubbleText, { color: isMe ? '#ffffff' : colors.text }]}>
                    {m.content}
                  </Text>
                </View>
                <Text style={[styles.msgTime, { color: colors.textMuted }]}>
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Input Field Bar */}
      <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          placeholderTextColor={colors.textMuted}
          style={[styles.textInput, { backgroundColor: colors.cardSecondary, color: colors.text }]}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={sending || !inputText.trim()}
          style={[styles.sendButton, { backgroundColor: colors.primary }]}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Send size={16} color="#ffffff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  messageList: { padding: 16, paddingBottom: 20 },
  bubbleContainer: { marginBottom: 12, maxWidth: '80%' },
  senderName: { fontSize: 11, marginBottom: 2, marginLeft: 4 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  bubbleText: { fontSize: 13, lineHeight: 18 },
  msgTime: { fontSize: 9, marginTop: 2, marginHorizontal: 4 },
  inputBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, gap: 10 },
  textInput: { flex: 1, height: 42, borderRadius: 20, paddingHorizontal: 16, fontSize: 13 },
  sendButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});
