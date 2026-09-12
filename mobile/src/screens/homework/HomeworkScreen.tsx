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
  Linking,
  Alert,
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
  X,
  ChevronRight,
  ExternalLink,
  FileText,
  CheckCheck,
} from 'lucide-react-native';

export default function HomeworkScreen() {
  const { user, currentOrg } = useAuth();
  const { colors } = useTheme();

  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'all' | 'todo' | 'review' | 'completed'>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Detail Modal
  const [selectedDetailTask, setSelectedDetailTask] = useState<any>(null);
  const [taskSubmissions, setTaskSubmissions] = useState<any[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);

  // Student submit modal
  const [submitModal, setSubmitModal] = useState(false);
  const [selectedTaskForSubmit, setSelectedTaskForSubmit] = useState<any>(null);
  const [solutionText, setSolutionText] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Teacher rubric grading modal
  const [gradingModal, setGradingModal] = useState(false);
  const [selectedTaskForGrading, setSelectedTaskForGrading] = useState<any>(null);
  const [targetSubmissionId, setTargetSubmissionId] = useState<string>('default-sub');
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
      const params: Record<string, any> = { isHomework: 'true' };
      if (isStudent) {
        params.assignee = 'me';
      }
      const res = await homeworkApi.tasks(currentOrg.id, params);
      setTasks(res || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentOrg?.id, isStudent]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const openTaskDetail = async (task: any) => {
    setSelectedDetailTask(task);
    setSubmissionsLoading(true);
    setTaskSubmissions([]);
    try {
      const subs = await homeworkApi.getSubmissions(task.id);
      setTaskSubmissions(Array.isArray(subs) ? subs : []);
    } catch {
      setTaskSubmissions([]);
    } finally {
      setSubmissionsLoading(false);
    }
  };

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
      if (selectedDetailTask?.id === selectedTaskForSubmit.id) {
        openTaskDetail(selectedTaskForSubmit);
      }
      loadTasks();
    } catch {
      Alert.alert('Error', 'Failed to submit homework. Please check your network connection.');
    } finally {
      setSubmitting(false);
    }
  };

  const openGradingForTask = (task: any, submission?: any) => {
    setSelectedTaskForGrading(task);
    setTargetSubmissionId(submission?.id || 'default-sub');
    if (submission?.rubricScores) {
      setAccuracy(String(submission.rubricScores.accuracy ?? 25));
      setCompleteness(String(submission.rubricScores.completeness ?? 25));
      setFormatting(String(submission.rubricScores.formatting ?? 25));
      setEffort(String(submission.rubricScores.effort ?? 25));
    } else {
      setAccuracy('25');
      setCompleteness('25');
      setFormatting('25');
      setEffort('25');
    }
    setFeedbackNotes(submission?.feedbackNotes || '');
    setGradingModal(true);
  };

  const handleTeacherGrade = async () => {
    if (!selectedTaskForGrading) return;
    setGrading(true);
    try {
      const calculatedScore = Number(accuracy) + Number(completeness) + Number(formatting) + Number(effort);
      await homeworkApi.gradeSubmission(selectedTaskForGrading.id, targetSubmissionId, {
        gradeScore: calculatedScore,
        gradeMax: 100,
        rubricScores: { accuracy, completeness, formatting, effort },
        feedbackNotes,
      });
      setGradingModal(false);
      setSelectedTaskForGrading(null);
      setFeedbackNotes('');
      if (selectedDetailTask?.id === selectedTaskForGrading.id) {
        openTaskDetail(selectedTaskForGrading);
      }
      loadTasks();
    } catch {
      Alert.alert('Error', 'Failed to save rubric grade. Please try again.');
    } finally {
      setGrading(false);
    }
  };

  const openLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Unable to open link', url);
      }
    } catch {
      Alert.alert('Unable to open link', url);
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
      {/* Header Filter Tabs */}
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadTasks();
            }}
            tintColor={colors.primary}
          />
        }
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
              <TouchableOpacity
                key={t.id}
                onPress={() => openTaskDetail(t)}
                activeOpacity={0.7}
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

                  {/* Contextual Action Button or View Rubric Indicator */}
                  {isStudent && t.status === 'TODO' ? (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        setSelectedTaskForSubmit(t);
                        setSubmitModal(true);
                      }}
                      style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                    >
                      <Send size={13} color="#ffffff" style={{ marginRight: 4 }} />
                      <Text style={styles.actionBtnText}>Submit</Text>
                    </TouchableOpacity>
                  ) : !isStudent && isReview ? (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        openGradingForTask(t);
                      }}
                      style={[styles.actionBtn, { backgroundColor: colors.emerald }]}
                    >
                      <Award size={13} color="#ffffff" style={{ marginRight: 4 }} />
                      <Text style={styles.actionBtnText}>Grade Rubric</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.viewDetailsRow}>
                      <Text style={[styles.viewDetailsText, { color: colors.primary }]}>
                        {isDone ? 'View Score' : 'Details'}
                      </Text>
                      <ChevronRight size={14} color={colors.primary} />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Interactive Homework Details & Rubric Modal */}
      <Modal
        visible={!!selectedDetailTask}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedDetailTask(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border, maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedDetailTask?.title}</Text>
                <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                  Due: {selectedDetailTask?.dueDate ? new Date(selectedDetailTask.dueDate).toLocaleDateString() : 'Next Class'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedDetailTask(null)} style={styles.closeBtn}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Status Badge */}
              <View style={styles.detailStatusRow}>
                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor:
                        selectedDetailTask?.status === 'COMPLETED'
                          ? colors.emeraldLight
                          : selectedDetailTask?.status === 'REVIEW'
                          ? colors.amberLight
                          : colors.primaryLight,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      {
                        color:
                          selectedDetailTask?.status === 'COMPLETED'
                            ? colors.emerald
                            : selectedDetailTask?.status === 'REVIEW'
                            ? colors.amber
                            : colors.primary,
                      },
                    ]}
                  >
                    STATUS: {selectedDetailTask?.status}
                  </Text>
                </View>
              </View>

              {/* Instructions / Description */}
              <Text style={[styles.detailSectionLabel, { color: colors.textSecondary }]}>Instructions & Details</Text>
              <View style={[styles.detailBox, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                <Text style={[styles.detailDesc, { color: colors.text }]}>
                  {selectedDetailTask?.description || 'No additional instructions provided for this assignment.'}
                </Text>
              </View>

              {/* Submissions & Rubric Breakdown */}
              <Text style={[styles.detailSectionLabel, { color: colors.textSecondary, marginTop: 16 }]}>
                Submissions & Rubrics
              </Text>

              {submissionsLoading ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 16 }} />
              ) : taskSubmissions.length === 0 ? (
                <View style={[styles.emptySubBox, { backgroundColor: colors.cardSecondary }]}>
                  <FileText size={24} color={colors.textMuted} />
                  <Text style={[styles.emptySubText, { color: colors.textMuted }]}>
                    No student submissions recorded yet.
                  </Text>
                </View>
              ) : (
                taskSubmissions.map((sub, index) => (
                  <View
                    key={sub.id || index}
                    style={[styles.submissionCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                  >
                    <View style={styles.subCardHeader}>
                      <View>
                        <Text style={[styles.subStudentName, { color: colors.text }]}>
                          {sub.student?.fullName || sub.student?.email || 'Student Submission'}
                        </Text>
                        <Text style={[styles.subDate, { color: colors.textMuted }]}>
                          Submitted: {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'Recent'}
                        </Text>
                      </View>
                      {sub.gradeScore !== undefined && sub.gradeScore !== null ? (
                        <View style={[styles.scoreBadge, { backgroundColor: colors.emeraldLight }]}>
                          <Award size={14} color={colors.emerald} style={{ marginRight: 4 }} />
                          <Text style={[styles.scoreBadgeText, { color: colors.emerald }]}>
                            {sub.gradeScore} / {sub.gradeMax || 100}
                          </Text>
                        </View>
                      ) : (
                        <View style={[styles.scoreBadge, { backgroundColor: colors.amberLight }]}>
                          <Text style={[styles.scoreBadgeText, { color: colors.amber }]}>Pending Grade</Text>
                        </View>
                      )}
                    </View>

                    {/* Submission content */}
                    {sub.content ? (
                      <View style={styles.subContentBox}>
                        <Text style={[styles.subContentLabel, { color: colors.textMuted }]}>Submitted Solution:</Text>
                        <Text style={[styles.subContentText, { color: colors.text }]}>{sub.content}</Text>
                      </View>
                    ) : null}

                    {/* Attachment link */}
                    {sub.attachmentUrl ? (
                      <TouchableOpacity
                        onPress={() => openLink(sub.attachmentUrl)}
                        style={[styles.attachmentBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                      >
                        <Paperclip size={14} color={colors.primary} />
                        <Text style={[styles.attachmentText, { color: colors.primary }]} numberOfLines={1}>
                          View Attachment: {sub.attachmentUrl}
                        </Text>
                        <ExternalLink size={12} color={colors.primary} />
                      </TouchableOpacity>
                    ) : null}

                    {/* Rubric Breakdown */}
                    {sub.rubricScores ? (
                      <View style={[styles.rubricGrid, { borderColor: colors.border }]}>
                        <View style={styles.rubricGridItem}>
                          <Text style={[styles.rubricGridLabel, { color: colors.textMuted }]}>Accuracy</Text>
                          <Text style={[styles.rubricGridVal, { color: colors.text }]}>
                            {sub.rubricScores.accuracy ?? 25} / 25
                          </Text>
                        </View>
                        <View style={styles.rubricGridItem}>
                          <Text style={[styles.rubricGridLabel, { color: colors.textMuted }]}>Completeness</Text>
                          <Text style={[styles.rubricGridVal, { color: colors.text }]}>
                            {sub.rubricScores.completeness ?? 25} / 25
                          </Text>
                        </View>
                        <View style={styles.rubricGridItem}>
                          <Text style={[styles.rubricGridLabel, { color: colors.textMuted }]}>Formatting</Text>
                          <Text style={[styles.rubricGridVal, { color: colors.text }]}>
                            {sub.rubricScores.formatting ?? 25} / 25
                          </Text>
                        </View>
                        <View style={styles.rubricGridItem}>
                          <Text style={[styles.rubricGridLabel, { color: colors.textMuted }]}>Effort</Text>
                          <Text style={[styles.rubricGridVal, { color: colors.text }]}>
                            {sub.rubricScores.effort ?? 25} / 25
                          </Text>
                        </View>
                      </View>
                    ) : null}

                    {/* Teacher Feedback Notes */}
                    {sub.feedbackNotes ? (
                      <View style={[styles.feedbackBox, { backgroundColor: colors.card }]}>
                        <Text style={[styles.feedbackLabel, { color: colors.textMuted }]}>Teacher Feedback:</Text>
                        <Text style={[styles.feedbackText, { color: colors.text }]}>"{sub.feedbackNotes}"</Text>
                      </View>
                    ) : null}

                    {/* Teacher can re-grade from detail */}
                    {!isStudent ? (
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedDetailTask(null);
                          openGradingForTask(selectedDetailTask, sub);
                        }}
                        style={[styles.miniActionBtn, { backgroundColor: colors.emerald, marginTop: 10 }]}
                      >
                        <Award size={13} color="#ffffff" style={{ marginRight: 4 }} />
                        <Text style={styles.miniActionBtnText}>
                          {sub.gradeScore !== undefined ? 'Update Rubric Grade' : 'Grade Submission'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))
              )}

              {/* Detail Action Buttons */}
              <View style={styles.detailActionArea}>
                {isStudent && selectedDetailTask?.status === 'TODO' ? (
                  <TouchableOpacity
                    onPress={() => {
                      const taskToSubmit = selectedDetailTask;
                      setSelectedDetailTask(null);
                      setSelectedTaskForSubmit(taskToSubmit);
                      setSubmitModal(true);
                    }}
                    style={[styles.modalSubmitBtn, { backgroundColor: colors.primary }]}
                  >
                    <Send size={15} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.modalSubmitBtnText}>Submit My Solution</Text>
                  </TouchableOpacity>
                ) : !isStudent && taskSubmissions.length === 0 ? (
                  <TouchableOpacity
                    onPress={() => {
                      const t = selectedDetailTask;
                      setSelectedDetailTask(null);
                      openGradingForTask(t);
                    }}
                    style={[styles.modalSubmitBtn, { backgroundColor: colors.emerald }]}
                  >
                    <Award size={15} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.modalSubmitBtnText}>Grade with Rubric</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
  cardTitle: { fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  statusPillText: { fontSize: 10, fontWeight: '800' },
  cardDesc: { fontSize: 12, marginTop: 6, lineHeight: 17 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 11 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  actionBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  viewDetailsRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewDetailsText: { fontSize: 12, fontWeight: '700' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalCard: { borderRadius: 16, borderWidth: 1, padding: 18 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  modalSub: { fontSize: 11, marginTop: 2 },
  closeBtn: { padding: 4 },
  modalLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  modalInput: { borderRadius: 8, padding: 10, fontSize: 13 },
  modalSubmitBtn: { height: 44, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  modalSubmitBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },

  // Detail Modal specific
  detailStatusRow: { flexDirection: 'row', marginBottom: 12 },
  detailSectionLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  detailBox: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 6 },
  detailDesc: { fontSize: 13, lineHeight: 19 },
  emptySubBox: { borderRadius: 10, padding: 16, alignItems: 'center', gap: 6, marginVertical: 8 },
  emptySubText: { fontSize: 12, fontWeight: '500' },
  submissionCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 10 },
  subCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  subStudentName: { fontSize: 13, fontWeight: '700' },
  subDate: { fontSize: 10, marginTop: 2 },
  scoreBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  scoreBadgeText: { fontSize: 11, fontWeight: '800' },
  subContentBox: { marginTop: 6, marginBottom: 6 },
  subContentLabel: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  subContentText: { fontSize: 12, lineHeight: 17 },
  attachmentBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderRadius: 8, borderWidth: 1, marginVertical: 6 },
  attachmentText: { fontSize: 11, fontWeight: '600', flex: 1 },
  rubricGrid: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 8, marginTop: 8 },
  rubricGridItem: { flex: 1, alignItems: 'center' },
  rubricGridLabel: { fontSize: 9, fontWeight: '600' },
  rubricGridVal: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  feedbackBox: { padding: 8, borderRadius: 8, marginTop: 8 },
  feedbackLabel: { fontSize: 10, fontWeight: '600' },
  feedbackText: { fontSize: 12, fontStyle: 'italic', marginTop: 2 },
  miniActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, borderRadius: 8 },
  miniActionBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  detailActionArea: { marginTop: 10 },

  // Rubric Form
  rubricSub: { fontSize: 12, marginBottom: 12 },
  rubricRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  rubricCol: { flex: 1 },
  rubricLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  rubricInput: { borderRadius: 8, padding: 8, fontSize: 13, textAlign: 'center', fontWeight: '700' },
  totalScoreRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, borderRadius: 8, marginTop: 4 },
  totalScoreLabel: { fontSize: 12, fontWeight: '700' },
  totalScoreValue: { fontSize: 14, fontWeight: '800' },
});
