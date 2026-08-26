import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { studentQuizApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sparkles,
  Flame,
  Zap,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  BookOpen,
  Award,
  TrendingUp,
  Clock,
  History,
  Play
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import FormattedMarkdown from '@/components/FormattedMarkdown';

export default function DailyHomeQuiz({ onNavigateToChat }) {
  const { currentOrg } = useAuth();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [quizStatus, setQuizStatus] = useState(null);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [quizResults, setQuizResults] = useState(null);
  const [showHint, setShowHint] = useState({});
  const [activeTab, setActiveTab] = useState('quiz'); // 'quiz' | 'history'
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      const data = await studentQuizApi.getDailyStatus(currentOrg?.id);
      setQuizStatus(data);

      if (data?.todayQuiz) {
        if (data.todayQuiz.isCompleted) {
          // Reconstruct results
          const questions = data.todayQuiz.questions || [];
          const answers = data.todayQuiz.answers || [];
          const breakdown = questions.map((q, idx) => ({
            id: q.id || idx + 1,
            question: q.question,
            options: q.options,
            selectedIndex: answers[idx] ?? null,
            correctIndex: q.correctIndex,
            isCorrect: answers[idx] === q.correctIndex,
            explanation: q.explanation,
            hint: q.hint,
          }));

          setQuizResults({
            quizId: data.todayQuiz.id,
            score: data.todayQuiz.score,
            totalQuestions: data.todayQuiz.totalQuestions,
            scorePercentage: Math.round(((data.todayQuiz.score || 0) / (data.todayQuiz.totalQuestions || 5)) * 100),
            newSkillScore: data.skillScore,
            skillTier: data.skillTier,
            skillTitle: data.skillTitle,
            skillLevel: data.skillLevel,
            streakDays: data.streakDays,
            feedback: data.todayQuiz.feedback,
            breakdown,
          });
        } else {
          setActiveQuiz(data.todayQuiz);
        }
      }
    } catch (e) {
      console.error('Failed to load daily quiz status:', e);
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id]);

  const loadHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const data = await studentQuizApi.getHistory(currentOrg?.id);
      setHistory(data.history || []);
    } catch (e) {
      console.error('Failed to load quiz history:', e);
    } finally {
      setLoadingHistory(false);
    }
  }, [currentOrg?.id]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  const handleStartQuiz = async () => {
    try {
      setGenerating(true);
      const res = await studentQuizApi.generateDailyQuiz({ orgId: currentOrg?.id });
      setActiveQuiz(res.quiz);
      setCurrentQuestionIdx(0);
      setSelectedAnswers({});
      setQuizResults(null);
      setShowHint({});
      toast.success('🎯 Today’s custom quiz is ready!');
    } catch (e) {
      toast.error('Failed to generate daily quiz. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectOption = (questionIdx, optionIdx) => {
    if (quizResults) return; // Read-only if completed
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionIdx]: optionIdx,
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!activeQuiz) return;
    const questions = activeQuiz.questions || [];
    const totalQ = questions.length;
    const answeredCount = Object.keys(selectedAnswers).length;

    if (answeredCount < totalQ) {
      const confirmSubmit = window.confirm(
        `You have answered ${answeredCount} of ${totalQ} questions. Submit anyway?`
      );
      if (!confirmSubmit) return;
    }

    try {
      setSubmitting(true);
      const answersArray = questions.map((_, idx) => (selectedAnswers[idx] !== undefined ? selectedAnswers[idx] : -1));
      const res = await studentQuizApi.submitDailyQuiz(activeQuiz.id, { answers: answersArray });

      setQuizResults(res);
      toast.success('🎉 Daily Quiz completed! Skill mastery updated.');
      loadStatus();
    } catch (e) {
      toast.error('Failed to submit quiz. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const questions = activeQuiz?.questions || [];
  const currentQuestion = questions[currentQuestionIdx];
  const totalQuestions = questions.length || 5;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Skill Level & Daily Streak Banner */}
      <Card className="border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-background rounded-2xl overflow-hidden shadow-xs">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/30 font-semibold px-2.5 py-0.5 border border-emerald-500/30">
                  <Zap className="h-3.5 w-3.5 mr-1" />
                  {quizStatus?.skillTitle || 'Developing (Level 2)'}
                </Badge>
                <Badge variant="outline" className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30">
                  <Flame className="h-3.5 w-3.5 mr-1 text-orange-500" />
                  {quizStatus?.streakDays || 0} Day Streak 🔥
                </Badge>
              </div>

              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                Daily Adaptive Home Quiz
              </h2>
              <p className="text-xs text-muted-foreground">
                Calibrated for <span className="font-semibold text-foreground">{quizStatus?.classInfo?.className || 'Class Grade'}</span> ({quizStatus?.classInfo?.departmentName || 'Curriculum Wing'}). Questions adapt as you take quizzes.
              </p>
            </div>

            {/* Skill Mastery Meter */}
            <div className="bg-background/80 backdrop-blur-xs border border-border/80 rounded-xl p-3 sm:p-4 min-w-[200px] w-full sm:w-auto text-center sm:text-right space-y-1.5">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between sm:justify-end gap-2">
                <span>Mastery Score</span>
                <span className="text-emerald-500 font-bold text-sm tabular-nums">
                  {quizStatus?.skillScore || 50}/100
                </span>
              </div>
              <Progress value={quizStatus?.skillScore || 50} className="h-2 bg-muted [&>div]:bg-emerald-500" />
              <div className="text-[10px] text-muted-foreground text-left sm:text-right">
                {quizStatus?.totalQuizzes || 0} quizzes completed
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mode Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === 'quiz' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('quiz')}
            className={`gap-1.5 text-xs font-semibold rounded-lg ${activeTab === 'quiz' ? 'bg-primary text-primary-foreground shadow-xs' : ''}`}
          >
            <Play className="h-3.5 w-3.5" /> Practice Quiz
          </Button>
          <Button
            variant={activeTab === 'history' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('history')}
            className={`gap-1.5 text-xs font-semibold rounded-lg ${activeTab === 'history' ? 'bg-primary text-primary-foreground shadow-xs' : ''}`}
          >
            <History className="h-3.5 w-3.5" /> Quiz History & Progress
          </Button>
        </div>

        {onNavigateToChat && (
          <Button
            variant="outline"
            size="sm"
            onClick={onNavigateToChat}
            className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Ask Study Buddy
          </Button>
        )}
      </div>

      {/* Tab: Quiz History */}
      {activeTab === 'history' && (
        <Card className="border border-border shadow-xs rounded-2xl">
          <CardHeader className="p-4 sm:p-5 border-b border-border">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" /> Past Daily Quiz History
            </CardTitle>
            <CardDescription className="text-xs">
              Review your previous home practice sessions and skill progression.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loadingHistory ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : history.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-xs space-y-3">
                <BookOpen className="h-8 w-8 mx-auto opacity-40 text-emerald-500" />
                <p>No completed daily quizzes recorded yet. Take your first quiz today!</p>
                <Button size="sm" onClick={() => setActiveTab('quiz')} className="text-xs font-semibold">
                  Start Today's Quiz
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border text-xs">
                {history.map((h) => {
                  const scorePct = Math.round(((h.score || 0) / (h.totalQuestions || 5)) * 100);
                  const isPerfect = scorePct === 100;
                  return (
                    <div key={h.id} className="p-4 flex items-center justify-between hover:bg-muted/40 transition-colors">
                      <div className="space-y-1">
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          <span>{h.topic || h.subject || 'Curriculum Quiz'}</span>
                          {isPerfect && <Badge className="bg-amber-500/20 text-amber-500 text-[10px] py-0 px-1.5">🌟 100%</Badge>}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(h.completedAt || h.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span>•</span>
                          <span className="font-medium text-foreground">Skill Tier: {h.skillLevel}</span>
                        </div>
                      </div>

                      <div className="text-right space-y-0.5">
                        <div className="font-bold text-sm tabular-nums text-foreground">
                          {h.score} / {h.totalQuestions}
                        </div>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          Score: {h.skillScore}/100
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Active Quiz or Results */}
      {activeTab === 'quiz' && (
        <>
          {/* STATE 1: RESULTS VIEW */}
          {quizResults && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <Card className="border border-border bg-card shadow-sm rounded-2xl overflow-hidden">
                <div className="p-6 sm:p-8 text-center space-y-4 bg-gradient-to-b from-primary/5 to-transparent">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-xs">
                    <Award className="h-8 w-8" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-2xl font-bold text-foreground">
                      Quiz Completed!
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      {quizResults.feedback}
                    </p>
                  </div>

                  {/* Score Highlights */}
                  <div className="grid grid-cols-3 gap-3 max-w-md mx-auto pt-2">
                    <div className="p-3 bg-background border border-border rounded-xl">
                      <div className="text-[10px] uppercase text-muted-foreground font-semibold">Score</div>
                      <div className="text-xl font-bold text-foreground tabular-nums">
                        {quizResults.score} / {quizResults.totalQuestions}
                      </div>
                    </div>
                    <div className="p-3 bg-background border border-border rounded-xl">
                      <div className="text-[10px] uppercase text-muted-foreground font-semibold">Accuracy</div>
                      <div className="text-xl font-bold text-emerald-500 tabular-nums">
                        {quizResults.scorePercentage}%
                      </div>
                    </div>
                    <div className="p-3 bg-background border border-border rounded-xl">
                      <div className="text-[10px] uppercase text-muted-foreground font-semibold">Skill Mastery</div>
                      <div className="text-xl font-bold text-primary tabular-nums">
                        {quizResults.newSkillScore}/100
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                    <Button
                      onClick={handleStartQuiz}
                      disabled={generating}
                      size="sm"
                      className="text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Practice Another Topic
                    </Button>
                    {onNavigateToChat && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onNavigateToChat}
                        className="text-xs font-semibold gap-1.5"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-primary" /> Ask Study Buddy for Help
                      </Button>
                    )}
                  </div>
                </div>

                {/* Step-by-Step Question Breakdown */}
                <div className="p-5 sm:p-6 border-t border-border space-y-4">
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" /> Detailed Question Review & Step-by-Step Solutions
                  </h4>

                  <div className="space-y-4">
                    {quizResults.breakdown?.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border transition-all ${
                          item.isCorrect
                            ? 'bg-emerald-500/5 border-emerald-500/20'
                            : 'bg-destructive/5 border-destructive/20'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                            <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                              {idx + 1}
                            </span>
                            <span>{item.question}</span>
                          </div>
                          {item.isCorrect ? (
                            <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] shrink-0">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Correct
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px] shrink-0">
                              <XCircle className="h-3 w-3 mr-1" /> Incorrect
                            </Badge>
                          )}
                        </div>

                        {/* Options List */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                          {item.options?.map((opt, optIdx) => {
                            const isSelected = item.selectedIndex === optIdx;
                            const isCorrectOpt = item.correctIndex === optIdx;

                            let optStyle = 'border-border/60 bg-background text-muted-foreground';
                            if (isCorrectOpt) {
                              optStyle = 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold';
                            } else if (isSelected && !isCorrectOpt) {
                              optStyle = 'border-destructive bg-destructive/10 text-destructive font-semibold';
                            }

                            return (
                              <div
                                key={optIdx}
                                className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 ${optStyle}`}
                              >
                                <span>{opt}</span>
                                {isCorrectOpt && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                                {isSelected && !isCorrectOpt && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                              </div>
                            );
                          })}
                        </div>

                        {/* Explanation Box */}
                        {item.explanation && (
                          <div className="p-3 rounded-lg bg-background/80 border border-border text-[11px] text-muted-foreground space-y-1">
                            <span className="font-semibold text-foreground flex items-center gap-1">
                              💡 Step-by-Step Explanation:
                            </span>
                            <FormattedMarkdown content={item.explanation} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* STATE 2: ACTIVE QUIZ VIEW */}
          {activeQuiz && !quizResults && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Question Card */}
              <Card className="border border-border shadow-md rounded-2xl overflow-hidden">
                {/* Progress Header */}
                <div className="p-4 bg-muted/40 border-b border-border flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">
                      Question {currentQuestionIdx + 1} of {totalQuestions}
                    </span>
                    {currentQuestion?.difficulty && (
                      <Badge variant="outline" className="text-[10px]">
                        {currentQuestion.difficulty}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      Answered: {Object.keys(selectedAnswers).length}/{totalQuestions}
                    </span>
                  </div>
                </div>

                <CardContent className="p-5 sm:p-7 space-y-6">
                  {/* Question Text */}
                  <div className="text-base sm:text-lg font-semibold text-foreground leading-relaxed">
                    {currentQuestion?.question}
                  </div>

                  {/* Options List */}
                  <div className="space-y-3">
                    {currentQuestion?.options?.map((option, optIdx) => {
                      const isSelected = selectedAnswers[currentQuestionIdx] === optIdx;
                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => handleSelectOption(currentQuestionIdx, optIdx)}
                          className={`w-full text-left p-4 rounded-xl border text-sm transition-all flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'border-primary bg-primary/10 text-foreground font-semibold shadow-xs ring-1 ring-primary'
                              : 'border-border bg-card hover:bg-muted/50 hover:border-border text-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                isSelected
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span>{option}</span>
                          </div>
                          {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Hint Toggle */}
                  {currentQuestion?.hint && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() =>
                          setShowHint((prev) => ({
                            ...prev,
                            [currentQuestionIdx]: !prev[currentQuestionIdx],
                          }))
                        }
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 font-medium transition-colors"
                      >
                        <HelpCircle className="h-3.5 w-3.5 text-amber-500" />
                        {showHint[currentQuestionIdx] ? 'Hide Concept Hint' : 'Need a Hint?'}
                      </button>

                      {showHint[currentQuestionIdx] && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-300"
                        >
                          💡 <span className="font-semibold">Hint:</span> {currentQuestion.hint}
                        </motion.div>
                      )}
                    </div>
                  )}

                  {/* Navigation Buttons */}
                  <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentQuestionIdx === 0}
                      onClick={() => setCurrentQuestionIdx((p) => p - 1)}
                      className="text-xs font-semibold gap-1.5"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Previous
                    </Button>

                    <div className="flex items-center gap-1">
                      {questions.map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setCurrentQuestionIdx(idx)}
                          className={`h-2.5 w-2.5 rounded-full transition-all ${
                            currentQuestionIdx === idx
                              ? 'bg-primary scale-125'
                              : selectedAnswers[idx] !== undefined
                              ? 'bg-emerald-500'
                              : 'bg-muted'
                          }`}
                          title={`Question ${idx + 1}`}
                        />
                      ))}
                    </div>

                    {currentQuestionIdx < totalQuestions - 1 ? (
                      <Button
                        size="sm"
                        onClick={() => setCurrentQuestionIdx((p) => p + 1)}
                        className="text-xs font-semibold gap-1.5 bg-primary text-primary-foreground"
                      >
                        Next <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={submitting}
                        onClick={handleSubmitQuiz}
                        className="text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
                      >
                        {submitting ? 'Submitting...' : 'Submit Daily Quiz 🎯'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* STATE 3: READY TO START QUIZ */}
          {!activeQuiz && !quizResults && (
            <Card className="border border-border bg-card shadow-sm rounded-2xl text-center p-8 sm:p-12 space-y-6">
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-xs">
                <Sparkles className="h-10 w-10" />
              </div>

              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-2xl font-bold text-foreground">
                  Ready for Today's Quick Quiz?
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  5 simple questions strictly tailored to your grade curriculum in <span className="font-semibold text-foreground">{quizStatus?.classInfo?.className || 'Class'}</span> and current mastery level. Takes only 3–5 minutes at home!
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Button
                  size="lg"
                  disabled={generating}
                  onClick={handleStartQuiz}
                  className="gap-2 font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 px-8 py-5 rounded-xl"
                >
                  <Play className="h-4 w-4 fill-white" />
                  {generating ? 'Generating Custom Quiz...' : "Start Today's Quiz"}
                </Button>
              </div>

              <div className="pt-6 border-t border-border max-w-sm mx-auto flex items-center justify-around text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Class Aligned
                </span>
                <span className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-500" /> Adaptive Difficulty
                </span>
                <span className="flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-orange-500" /> Daily Streak
                </span>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
