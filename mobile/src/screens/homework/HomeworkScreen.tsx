import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { homeworkApi } from '../../lib/api';
import {
  BookOpen,
  Send,
  Award,
  Clock,
  CheckCircle2,
  Paperclip,
  Plus,
  X,
  AlertCircle,
} from 'lucide-react-native';

export default function HomeworkScreen() {
  const { user, currentOrg } = useAuth();
  const { colors } = useTheme();

  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'all' | 'todo' | 'review' | 'completed'>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Student submit modal
  const [submitModal, setSubmitModal] = useState(false);
  const [selectedTaskForSubmit, setSelectedTaskForSubmit] = useState<any>(null);
  const [solutionText, setSolutionText] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Teacher rubric grading modal
  const [gradingModal, setGradingModal] = useState(false);
  const [selectedTaskForGrading, setSelectedTaskForGrading] = useState<any>(null);
  const [accuracy, setAccuracy] = useState('25');
  const [completeness, setCompleteness] = useState('25');
  const [formatting, setFormatting] = useState('25');
  const [effort, setEffort] = useState('25');
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [grading, setGrading] = useState(false);

  const isStudent = currentOrg?.role === 'STUDENT';

  const loadTasks = useCallback(async () => {
    if (!currentOrg?.id) return;
    try {
      setLoading(true);
      const res = await homeworkApi.tasks(currentOrg.id);
      setTasks(res || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentOrg?.id]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleStudentSubmit = async () => {
    if (!selectedTaskForSubmit) return;
    setSubmitting(true);
    try {
      await homeworkApi.submit(selectedTaskForSubmit.id, {
        content: solutionText,
        attachmentUrl: attachmentUrl || undefined,
      });
      setSubmitModal(false);
      setSolutionText('');
      setAttachmentUrl('');
      setSelectedTaskForSubmit(null);
      loadTasks();
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const handleTeacherGrade = async () => {
    if (!selectedTaskForGrading) return;
    setGrading(true);
    try {
      const calculatedScore = Number(accuracy) + Number(completeness) + Number(formatting) + Number(effort);
      await homeworkApi.gradeSubmission(selectedTaskForGrading.id, 'default-sub', {
        gradeScore: calculatedScore,
        gradeMax: 100,
        rubricScores: { accuracy, completeness, formatting, effort },
        feedbackNotes,
      });
      setGradingModal(false);
      setSelectedTaskForGrading(null);
      setFeedbackNotes('');
      loadTasks();
    } catch {
      // ignore
    } finally {
      setGrading(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filterTab === 'all') return true;
    if (filterTab === 'todo') return t.status === 'TODO';
    if (filterTab === 'review') return t.status === 'REVIEW';
    if (filterTab === 'completed') return t.status === 'COMPLETED';
    return true;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Tabs */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {(['all', 'todo', 'review', 'completed'] as const).map((tab) => (
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
              {tab.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTasks(); }} tintColor={colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : filteredTasks.length === 0 ? (
          <View style={styles.emptyView}>
            <BookOpen size={40} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No homework items in this section</Text>
          </View>
        ) : (
          filteredTasks.map((t) => {
            const isDone = t.status === 'COMPLETED';
            const isReview = t.status === 'REVIEW';

            return (
              <View
                key={t.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: isReview ? colors.amber : isDone ? colors.emerald : colors.border,
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{t.title}</Text>
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: isDone
                          ? colors.emeraldLight
                          : isReview
                          ? colors.amberLight
                          : colors.primaryLight,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        {
                          color: isDone ? colors.emerald : isReview ? colors.amber : colors.primary,
                        },
                      ]}
                    >
                      {t.status}
                    </Text>
                  </View>
                </View>

                {t.description ? (
                  <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                    {t.description}
                  </Text>
                ) : null}

                <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                  <View style={styles.metaRow}>
                    <Clock size={13} color={colors.textMuted} />
                    <Text style={[styles.metaText, { color: colors.textMuted }]}>
                      Due: {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'Next Class'}
                    </Text>
                  </View>

                  {/* Contextual Action Button */}
                  {isStudent && t.status === 'TODO' ? (
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedTaskForSubmit(t);
                        setSubmitModal(true);
                      }}
                      style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                    >
                      <Send size={13} color="#ffffff" style={{ marginRight: 4 }} />
                      <Text style={styles.actionBtnText}>Submit</Text>
                    </TouchableOpacity>
                  ) : null}

                  {!isStudent && isReview ? (
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedTaskForGrading(t);
                        setGradingModal(true);
                      }}
                      style={[styles.actionBtn, { backgroundColor: colors.emerald }]}
                    >
                      <Award size={13} color="#ffffff" style={{ marginRight: 4 }} />
                      <Text style={styles.actionBtnText}>Grade Rubric</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Student Submit Modal */}
      <Modal visible={submitModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Submit Homework Solution</Text>
              <TouchableOpacity onPress={() => setSubmitModal(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Your Solution / Answers</Text>
            <TextInput
              multiline
              numberOfLines={4}
              value={solutionText}
              onChangeText={setSolutionText}
              placeholder="Type your solution or answers here..."
              placeholderTextColor={colors.textMuted}
              style={[styles.modalInput, { backgroundColor: colors.cardSecondary, color: colors.text, height: 100 }]}
            />

            <Text style={[styles.modalLabel, { color: colors.textSecondary, marginTop: 12 }]}>
              Attachment Link / Google Drive URL (Optional)
            </Text>
            <TextInput
              value={attachmentUrl}
              onChangeText={setAttachmentUrl}
              placeholder="https://drive.google.com/file/d/..."
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              style={[styles.modalInput, { backgroundColor: colors.cardSecondary, color: colors.text }]}
            />

            <TouchableOpacity
              onPress={handleStudentSubmit}
              disabled={submitting}
              style={[styles.modalSubmitBtn, { backgroundColor: colors.primary }]}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Submit to Teacher</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Teacher Rubric Grading Modal */}
      <Modal visible={gradingModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Rubric Grading Portal</Text>
              <TouchableOpacity onPress={() => setGradingModal(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.rubricSub, { color: colors.textSecondary }]}>
              Grade student submission out of 100 points:
            </Text>

            <View style={styles.rubricRow}>
              <View style={styles.rubricCol}>
                <Text style={[styles.rubricLabel, { color: colors.textSecondary }]}>Accuracy (/25)</Text>
                <TextInput
                  keyboardType="numeric"
                  value={accuracy}
                  onChangeText={setAccuracy}
                  style={[styles.rubricInput, { backgroundColor: colors.cardSecondary, color: colors.text }]}
                />
              </View>
              <View style={styles.rubricCol}>
                <Text style={[styles.rubricLabel, { color: colors.textSecondary }]}>Completeness (/25)</Text>
                <TextInput
                  keyboardType="numeric"
                  value={completeness}
                  onChangeText={setCompleteness}
                  style={[styles.rubricInput, { backgroundColor: colors.cardSecondary, color: colors.text }]}
                />
              </View>
            </View>

            <View style={styles.rubricRow}>
              <View style={styles.rubricCol}>
                <Text style={[styles.rubricLabel, { color: colors.textSecondary }]}>Formatting (/25)</Text>
                <TextInput
                  keyboardType="numeric"
                  value={formatting}
                  onChangeText={setFormatting}
                  style={[styles.rubricInput, { backgroundColor: colors.cardSecondary, color: colors.text }]}
                />
              </View>
              <View style={styles.rubricCol}>
                <Text style={[styles.rubricLabel, { color: colors.textSecondary }]}>Effort (/25)</Text>
                <TextInput
                  keyboardType="numeric"
                  value={effort}
                  onChangeText={setEffort}
                  style={[styles.rubricInput, { backgroundColor: colors.cardSecondary, color: colors.text }]}
                />
              </View>
            </View>

            <View style={[styles.totalScoreRow, { backgroundColor: colors.emeraldLight }]}>
              <Text style={[styles.totalScoreLabel, { color: colors.emerald }]}>Total Rubric Score:</Text>
              <Text style={[styles.totalScoreValue, { color: colors.emerald }]}>
                {Number(accuracy) + Number(completeness) + Number(formatting) + Number(effort)} / 100
              </Text>
            </View>

            <Text style={[styles.modalLabel, { color: colors.textSecondary, marginTop: 10 }]}>Teacher Feedback</Text>
            <TextInput
              value={feedbackNotes}
              onChangeText={setFeedbackNotes}
              placeholder="Good effort! Clear steps shown."
              placeholderTextColor={colors.textMuted}
              style={[styles.modalInput, { backgroundColor: colors.cardSecondary, color: colors.text }]}
            />

            <TouchableOpacity
              onPress={handleTeacherGrade}
              disabled={grading}
              style={[styles.modalSubmitBtn, { backgroundColor: colors.emerald }]}
            >
              {grading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Approve & Save Grade</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  statusPillText: { fontSize: 10, fontWeight: '800' },
  cardDesc: { fontSize: 12, marginTop: 6, lineHeight: 17 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 11 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  actionBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalCard: { borderRadius: 16, borderWidth: 1, padding: 18 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  modalLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  modalInput: { borderRadius: 8, padding: 10, fontSize: 13 },
  modalSubmitBtn: { height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  modalSubmitBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  rubricSub: { fontSize: 12, marginBottom: 12 },
  rubricRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  rubricCol: { flex: 1 },
  rubricLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  rubricInput: { borderRadius: 8, padding: 8, fontSize: 13, textAlign: 'center', fontWeight: '700' },
  totalScoreRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, borderRadius: 8, marginTop: 4 },
  totalScoreLabel: { fontSize: 12, fontWeight: '700' },
  totalScoreValue: { fontSize: 14, fontWeight: '800' },
});
