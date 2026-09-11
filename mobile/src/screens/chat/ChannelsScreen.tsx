import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { channelApi } from '../../lib/api';
import { Hash, MessageSquare, Users, ChevronRight, Lock } from 'lucide-react-native';

export default function ChannelsScreen({ navigation }: any) {
  const { currentOrg } = useAuth();
  const { colors } = useTheme();

  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'channels' | 'dms'>('all');

  const loadChannels = useCallback(async () => {
    if (!currentOrg?.id) return;
    try {
      setLoading(true);
      const res = await channelApi.list(currentOrg.id);
      setChannels(res || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentOrg?.id]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  const filtered = channels.filter((c) => {
    if (filterTab === 'channels') return c.type !== 'DIRECT';
    if (filterTab === 'dms') return c.type === 'DIRECT';
    return true;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Filter Tabs */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {(['all', 'channels', 'dms'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setFilterTab(tab)}
            style={[
              styles.tabItem,
              filterTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
            ]}
          >
            <Text
              style={[
                styles.tabItemText,
                { color: filterTab === tab ? colors.primary : colors.textSecondary },
              ]}
            >
              {tab === 'all' ? 'ALL CHATS' : tab === 'channels' ? 'CHANNELS' : 'DIRECT MESSAGES'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadChannels(); }} tintColor={colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyView}>
            <MessageSquare size={38} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No channels or chats found</Text>
          </View>
        ) : (
          filtered.map((c) => {
            const isDirect = c.type === 'DIRECT';
            return (
              <TouchableOpacity
                key={c.id}
                onPress={() => navigation.navigate('ChatRoom', { channelId: c.id, channelName: c.name || 'Chat' })}
                style={[styles.channelCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[styles.channelIcon, { backgroundColor: isDirect ? colors.purpleLight : colors.primaryLight }]}>
                  {isDirect ? (
                    <MessageSquare size={18} color={colors.purple} />
                  ) : (
                    <Hash size={18} color={colors.primary} />
                  )}
                </View>

                <View style={styles.channelDetails}>
                  <Text style={[styles.channelName, { color: colors.text }]}>{c.name || 'General'}</Text>
                  <Text style={[styles.channelDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                    {c.description || (isDirect ? 'Direct conversation' : 'Class discussion stream')}
                  </Text>
                </View>

                <ChevronRight size={18} color={colors.textMuted} />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabItem: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabItemText: { fontSize: 11, fontWeight: '700' },
  list: { padding: 16 },
  emptyView: { alignItems: 'center', marginTop: 60, gap: 10 },
  emptyText: { fontSize: 13 },
  channelCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  channelIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  channelDetails: { flex: 1 },
  channelName: { fontSize: 14, fontWeight: '700' },
  channelDesc: { fontSize: 11, marginTop: 2 },
});
