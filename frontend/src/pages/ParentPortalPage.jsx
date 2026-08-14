import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { parentApi, channelApi, financeApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserCheck, CalendarCheck, BookOpen, MessageSquare, AlertTriangle, CheckCircle, Clock, Award, Shield, Sparkles, GraduationCap, Building, IndianRupee, CreditCard, Download, Printer, Receipt, Building2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

function initials(n) {
  return (n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
}

export default function ParentPortalPage() {
  const navigate = useNavigate();
  const { currentOrg, user } = useAuth();
  const [childrenList, setChildrenList] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [report, setReport] = useState(null);
  const [feeData, setFeeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [printableReceipt, setPrintableReceipt] = useState(null);

  useEffect(() => {
    if (currentOrg?.role && currentOrg.role !== 'PARENT') {
      navigate('/app/home', { replace: true });
    }
  }, [currentOrg?.role, navigate]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const children = await parentApi.getMyChildren();
        const uniqueChildren = Array.from(
          new Map((children || []).map((c) => [c.userId || c.user?.id, c])).values()
        );
        setChildrenList(uniqueChildren);
        if (uniqueChildren?.length > 0) {
          const firstId = uniqueChildren[0].userId || uniqueChildren[0].user?.id;
          setSelectedStudentId(firstId);
          const r = await parentApi.getChildReport(firstId, currentOrg?.id);
          setReport(r);
        }

        // Fetch parent fees via financeApi
        const fData = await financeApi.getParentFees().catch(() => null);
        if (fData) {
          setFeeData(fData);
        }
      } catch (e) {
        toast.error('Failed to load parent portal data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentOrg?.id]);

  const handleSelectChild = async (studentId) => {
    setSelectedStudentId(studentId);
    setLoading(true);
    try {
      const r = await parentApi.getChildReport(studentId, currentOrg?.id);
      setReport(r);
    } catch (e) {
      toast.error('Failed to load child report');
    } finally {
      setLoading(false);
    }
  };

  const handleMessageFaculty = async (userId, roleName) => {
    if (!userId || !currentOrg?.id) return;
    try {
      const dmCh = await channelApi.dm(currentOrg.id, userId);
      navigate(`/app/channels/${dmCh.id}`);
    } catch (e) {
      toast.error(`Failed to open message channel with ${roleName || 'faculty'}`);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display tracking-tight flex items-center gap-2">
              Parent Portal Dashboard
            </h1>
            <p className="text-xs text-muted-foreground">
              Monitor your child's attendance statistics, graded homework, and connect with Class Teachers & HOD.
            </p>
          </div>
        </div>

        {childrenList.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Select Student:</span>
            <div className="flex gap-1">
              {childrenList.map((c) => {
                const uId = c.userId || c.user?.id;
                const isSelected = uId === selectedStudentId;
                return (
                  <Button
                    key={uId}
                    size="sm"
                    variant={isSelected ? 'default' : 'outline'}
                    onClick={() => handleSelectChild(uId)}
                    className="text-xs font-semibold"
                  >
                    {c.user?.fullName || 'Child'}
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {report && (
        <div className="space-y-6">
          {/* Child Card Header */}
          <div className="p-4 rounded-xl border border-border bg-card flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 border border-border">
                <AvatarImage src={report.student?.user?.avatarUrl} />
                <AvatarFallback className="text-sm bg-purple-500/10 text-purple-500 font-bold">
                  {initials(report.student?.user?.fullName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-lg font-bold text-foreground">{report.student?.user?.fullName}</h2>
                <div className="text-xs text-muted-foreground">
                  {report.student?.team?.name || 'Class Section'} · {report.student?.department?.name || 'School Wing'}
                </div>
              </div>
            </div>

            {/* Faculty Contact Cards (Class Teacher & HOD) */}
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              {report.classTeacher && (
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/40 border border-border shrink-0">
                  <Avatar className="h-8 w-8 border border-border">
                    <AvatarImage src={report.classTeacher.avatarUrl} />
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                      {initials(report.classTeacher.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-xs font-semibold text-foreground">{report.classTeacher.fullName}</div>
                    <div className="text-[10px] text-muted-foreground">Class Teacher</div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleMessageFaculty(report.classTeacher.id, 'Class Teacher')}
                    className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white font-bold ml-1.5"
                  >
                    <MessageSquare className="h-3.5 w-3.5 mr-1" /> Contact Teacher
                  </Button>
                </div>
              )}

              {report.hodUser && (
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/40 border border-border shrink-0">
                  <Avatar className="h-8 w-8 border border-border">
                    <AvatarImage src={report.hodUser.avatarUrl} />
                    <AvatarFallback className="text-[10px] bg-purple-500/10 text-purple-500 font-bold">
                      {initials(report.hodUser.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-xs font-semibold text-foreground">{report.hodUser.fullName}</div>
                    <div className="text-[10px] text-muted-foreground">Head of Department (HOD)</div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleMessageFaculty(report.hodUser.id, 'HOD')}
                    className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold ml-1.5"
                  >
                    <Building className="h-3.5 w-3.5 mr-1" /> Contact HOD
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Parent AI Assistance Banner Card */}
          <Card className="border border-purple-500/30 bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-transparent shadow-sm overflow-hidden">
            <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
                  <Sparkles className="h-4 w-4" /> Parent AI Academic Assistant
                  <Badge variant="outline" className="text-[10px] bg-purple-500/20 text-purple-300 border-purple-500/30">24/7 AI Helper</Badge>
                </div>
                <p className="text-xs text-muted-foreground max-w-xl">
                  Need help understanding your child's progress, explaining homework concepts, or drafting messages to Class Teachers & HOD? Use your personal Parent AI Companion.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto">
                <Button
                  size="sm"
                  onClick={() => navigate('/app/ai')}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs gap-1.5 shadow-md w-full sm:w-auto"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Launch Parent AI Assistant
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Stats Overview Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className={`border-border ${report.attendance?.isLowAttendance ? 'border-amber-500/40 bg-amber-500/5' : ''}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold shrink-0">
                  <CalendarCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold font-display">
                    {report.attendance?.percentage}%
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">Monthly Attendance Rate</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold shrink-0">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold font-display">
                    {report.homeworkReport?.filter(h => h.status === 'COMPLETED').length || 0} / {report.homeworkReport?.length || 0}
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">Completed Homework</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold shrink-0">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold font-display">
                    {report.homeworkReport?.filter(h => h.submission?.gradeScore).length || 0} Graded
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">Rubric Scores Released</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* School Fees & Outstanding Dues Card */}
          <Card className="border border-blue-500/30 bg-slate-900/60 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                    <IndianRupee className="h-4 w-4 text-emerald-400" /> School Fees & Payment Statement
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Synced from Institution Accounting Ledgers (Tally Prime / Busy Sync)
                  </CardDescription>
                </div>
                {feeData?.summary?.totalPending > 0 && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs font-bold">
                    Pending Dues: ₹{feeData.summary.totalPending.toLocaleString('en-IN')}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {feeData?.fees && feeData.fees.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {feeData.fees.map((fee) => (
                    <div key={fee.id} className="p-3.5 rounded-xl border border-border bg-card space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs font-mono text-muted-foreground">{fee.studentRollNo} • {fee.academicYear}</div>
                          <div className="text-sm font-bold text-foreground">{fee.feeHeader}</div>
                        </div>
                        <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
                          fee.status === 'PAID'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : fee.status === 'PARTIAL'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}>
                          {fee.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                        <div>
                          <span className="text-muted-foreground">Total Fee: </span>
                          <strong className="text-foreground">₹{fee.totalAmount.toLocaleString('en-IN')}</strong>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Paid: </span>
                          <strong className="text-emerald-400">₹{fee.paidAmount.toLocaleString('en-IN')}</strong>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Balance: </span>
                          <strong className="text-amber-400">₹{fee.pendingBalance.toLocaleString('en-IN')}</strong>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/40">
                        <span>Receipt: <code className="text-xs text-foreground font-mono">{fee.receiptNo}</code></span>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPrintableReceipt(fee)}
                            className="h-6 text-[11px] border-border text-emerald-400 hover:bg-emerald-500/10 px-2 py-0"
                          >
                            <Printer className="w-3 h-3 mr-1" /> Download Receipt
                          </Button>
                          {fee.status !== 'PAID' && (
                            <Button size="sm" className="h-6 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0">
                              <CreditCard className="w-3 h-3 mr-1" /> Pay Now
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground py-4 text-center">
                  No active fee records found for your linked student.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Graded Homework & Rubric Scores Section */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-500" /> Child's Homework & Rubric Progress
              </CardTitle>
              <CardDescription className="text-xs">
                View homework assignments, teacher feedback, and criterion-based rubric scores.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {report.homeworkReport?.map((h) => {
                const sub = h.submission;
                const isCompleted = h.status === 'COMPLETED';

                return (
                  <div key={h.id} className="p-3.5 rounded-xl border border-border bg-card space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-foreground">{h.title}</h4>
                        <div className="text-xs text-muted-foreground">Assigned by {h.createdBy?.fullName || 'Teacher'}</div>
                      </div>

                      {sub?.gradeScore !== undefined && sub?.gradeScore !== null ? (
                        <Badge variant="outline" className="text-xs font-bold bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                          Grade: {sub.gradeScore} / {sub.gradeMax || 100}
                        </Badge>
                      ) : isCompleted ? (
                        <Badge variant="outline" className="text-xs font-bold bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                          Grade: - / {sub?.gradeMax || 100}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs font-semibold bg-amber-500/10 text-amber-500 border-amber-500/30">
                          Pending Submission
                        </Badge>
                      )}
                    </div>

                    {sub?.feedbackNotes && (
                      <div className="p-2.5 rounded-lg bg-muted/40 text-xs text-foreground border border-border/60">
                        <strong className="text-muted-foreground">Teacher Feedback:</strong> "{sub.feedbackNotes}"
                      </div>
                    )}
                  </div>
                );
              })}

              {(!report.homeworkReport || report.homeworkReport.length === 0) && (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No homework assignments logged yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && !report && (
        <Card className="border-border shadow-sm p-8 text-center max-w-xl mx-auto space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold mx-auto">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">No Linked Children Found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              {user?.email?.includes('parent') || currentOrg?.role === 'PARENT'
                ? "Your parent account is not currently linked to any student profile. Please contact the school administration or enter your child's Student ID to link."
                : "You are currently viewing the Parent Portal as a Staff/Administrator. To test child progress tracking, log in with a Parent account or link a student account."}
            </p>
          </div>
        </Card>
      )}

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
        </div>
      )}

      {/* Modal: Official Student Fee Payment Receipt PDF View */}
      {printableReceipt && createPortal(
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-start justify-center p-4 sm:p-6 z-[9999] overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-6 shadow-2xl relative text-slate-100 my-4 sm:my-8">
            {/* Modal Header Actions */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-white">Student Fee Payment Receipt</h3>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  onClick={() => window.print()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" /> Print / Save as PDF
                </Button>
                <button
                  onClick={() => setPrintableReceipt(null)}
                  className="p-1.5 text-slate-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* PRINTABLE RECEIPT CARD CONTENT */}
            <div id="printable-receipt-content" className="bg-slate-950 border border-slate-800 rounded-xl p-6 space-y-6 text-slate-200">
              {/* Institution Letterhead Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl">
                    <Building2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-white tracking-tight">{currentOrg?.name || 'Demo International Academy'}</h2>
                    <p className="text-xs text-slate-400">Department of Finance & Accounts • Parent Portal</p>
                    <p className="text-[11px] text-slate-500">Official Fee Voucher & Tally Prime Ledger Receipt</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg inline-block">
                    {printableReceipt.receiptNo || `REC/2026-27/${printableReceipt.studentRollNo || '001'}`}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">Date: {new Date().toLocaleDateString('en-IN')}</div>
                </div>
              </div>

              {/* Voucher Title Banner */}
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg text-center">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                  Official Student Fee Payment Receipt
                </span>
              </div>

              {/* Metadata Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">Student Roll No</span>
                  <span className="font-mono text-slate-200">{printableReceipt.studentRollNo}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">Fee Header</span>
                  <span className="text-slate-200">{printableReceipt.feeHeader}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">Academic Year</span>
                  <span className="text-slate-200">{printableReceipt.academicYear || '2026-27'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">Payment Status</span>
                  <span className="text-emerald-400 font-semibold">{printableReceipt.status}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">Payment Method</span>
                  <span className="text-slate-200">{printableReceipt.paymentMethod || 'UPI / Online'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">Bank Account</span>
                  <span className="text-teal-300 font-mono">{printableReceipt.bankAccountName || 'HDFC Bank Main Account'}</span>
                </div>
              </div>

              {/* Itemized Table Breakdown */}
              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-semibold">
                    <tr>
                      <th className="p-3">Fee Item Breakdown</th>
                      <th className="p-3 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    <tr>
                      <td className="p-3 font-medium">Total Billed Fee Amount</td>
                      <td className="p-3 text-right font-mono font-bold text-white">₹{printableReceipt.totalAmount?.toLocaleString('en-IN')}</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-emerald-400">Total Payment Received</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-400">₹{printableReceipt.paidAmount?.toLocaleString('en-IN')}</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-amber-400">Balance Outstanding Dues</td>
                      <td className="p-3 text-right font-mono font-bold text-amber-400">₹{printableReceipt.pendingBalance?.toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Verification & Stamp */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verified & Synced with Tally Prime / Busy ERP</span>
                </div>

                <div className="text-right space-y-1">
                  <div className="text-xs font-bold text-slate-300">Finance & Accounts Department</div>
                  <div className="text-[10px] text-slate-500 italic">Authorized System Generated Receipt & Seal</div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </motion.div>
  );
}
