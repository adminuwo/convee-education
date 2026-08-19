import React, { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Printer,
  GraduationCap,
  Award,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Building,
  Upload,
  PenTool,
  ShieldCheck,
  Image as ImageIcon,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { examApi } from '@/lib/api';

// Realistic Default Mock Signatures & Institutional Seal
export const SAMPLE_SIGNATURES = {
  teacher: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="60" viewBox="0 0 160 60"><path d="M10,42 C25,18 35,15 45,30 C55,45 60,10 75,35 C85,48 95,20 110,38 C120,48 135,15 145,35" fill="none" stroke="%231e3a8a" stroke-width="2.5" stroke-linecap="round"/><text x="15" y="55" font-family="cursive, sans-serif" font-size="10" fill="%234b5563">K. Kapoor (Class Teacher)</text></svg>`,
  hod: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="60" viewBox="0 0 160 60"><path d="M12,38 C28,12 40,40 55,20 C70,2 80,48 100,22 C115,5 125,40 148,25" fill="none" stroke="%230f766e" stroke-width="2.5" stroke-linecap="round"/><text x="15" y="55" font-family="cursive, sans-serif" font-size="10" fill="%234b5563">Dr. C. Oswald (HOD)</text></svg>`,
  principal: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="60" viewBox="0 0 160 60"><path d="M15,40 C30,10 42,50 65,15 C85,38 105,8 125,32 C135,42 145,18 152,30" fill="none" stroke="%23701a75" stroke-width="2.5" stroke-linecap="round"/><text x="15" y="55" font-family="cursive, sans-serif" font-size="10" fill="%234b5563">Dr. A. Vance (Principal)</text></svg>`,
  stamp: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" fill="none" stroke="%23dc2626" stroke-width="3" stroke-dasharray="4,2"/><circle cx="60" cy="60" r="46" fill="none" stroke="%23dc2626" stroke-width="1.5"/><path id="textPath" d="M 60,60 m -36,0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0" fill="none"/><text fill="%23dc2626" font-size="8.5" font-family="Arial, sans-serif" font-weight="bold" letter-spacing="1.5"><textPath href="%23textPath" startOffset="50%" text-anchor="middle">DEMO ACADEMY • OFFICIAL SEAL</textPath></text><polygon points="60,38 65,48 76,49 68,57 70,68 60,62 50,68 52,57 44,49 55,48" fill="%23dc2626" opacity="0.85"/><text x="60" y="82" fill="%23dc2626" font-size="7.5" font-family="Arial, sans-serif" font-weight="bold" text-anchor="middle">VERIFIED</text></svg>`,
};

export default function StudentReportCardModal({ open, onOpenChange, reportCard, currentOrg, onReportCardUpdated }) {
  const printRef = useRef(null);
  const [showConfig, setShowConfig] = useState(false);
  const [savingSignatures, setSavingSignatures] = useState(false);

  const [teacherSign, setTeacherSign] = useState(reportCard?.classTeacherSignUrl || '');
  const [hodSign, setHodSign] = useState(reportCard?.hodSignUrl || '');
  const [principalSign, setPrincipalSign] = useState(reportCard?.principalSignUrl || '');
  const [stamp, setStamp] = useState(reportCard?.stampUrl || '');
  const [applyToAll, setApplyToAll] = useState(true);

  if (!reportCard) return null;

  const subjects = Array.isArray(reportCard.subjectsJson) ? reportCard.subjectsJson : [];
  const attendance = reportCard.attendanceStats || { totalDays: 0, daysPresent: 0, percentage: 100 };
  const isPassed = reportCard.resultStatus === 'PASSED';
  const isAbsent = reportCard.resultStatus === 'ABSENT';

  const handlePrint = () => {
    window.print();
  };

  const handleApplyPreset = (type) => {
    if (type === 'teacher') setTeacherSign(SAMPLE_SIGNATURES.teacher);
    if (type === 'hod') setHodSign(SAMPLE_SIGNATURES.hod);
    if (type === 'principal') setPrincipalSign(SAMPLE_SIGNATURES.principal);
    if (type === 'stamp') setStamp(SAMPLE_SIGNATURES.stamp);
    if (type === 'all') {
      setTeacherSign(SAMPLE_SIGNATURES.teacher);
      setHodSign(SAMPLE_SIGNATURES.hod);
      setPrincipalSign(SAMPLE_SIGNATURES.principal);
      setStamp(SAMPLE_SIGNATURES.stamp);
    }
  };

  const handleFileUpload = (e, targetSetter) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      targetSetter(uploadEvent.target?.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSignatures = async () => {
    setSavingSignatures(true);
    try {
      const res = await examApi.updateReportCardSignatures(reportCard.id, {
        classTeacherSignUrl: teacherSign,
        hodSignUrl: hodSign,
        principalSignUrl: principalSign,
        stampUrl: stamp,
        applyToAllForExam: applyToAll,
      });

      if (res?.reportCard && onReportCardUpdated) {
        onReportCardUpdated(res.reportCard);
      }
      setShowConfig(false);
    } catch (err) {
      console.error('Failed to save signatures', err);
    } finally {
      setSavingSignatures(false);
    }
  };

  const effectiveTeacherSign = teacherSign || reportCard.classTeacherSignUrl;
  const effectiveHodSign = hodSign || reportCard.hodSignUrl;
  const effectivePrincipalSign = principalSign || reportCard.principalSignUrl;
  const effectiveStamp = stamp || reportCard.stampUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-border text-foreground p-0">
        {/* Top Utility Bar for Signatures & Stamp Configuration */}
        <div className="bg-muted/60 px-6 py-2.5 border-b border-border flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>Official Institutional Verification Status:</span>
            <span className="font-semibold text-foreground">
              {effectiveStamp || effectiveTeacherSign ? 'Digitally Verified' : 'Physical Signatures Required'}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowConfig(!showConfig)}
            className="h-7 text-xs gap-1.5 font-medium"
          >
            <PenTool className="h-3.5 w-3.5" />
            {showConfig ? 'Hide Signature Settings' : 'Upload / Customize Signatures & Stamp'}
            {showConfig ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>

        {/* Expandable Configuration Drawer */}
        {showConfig && (
          <div className="bg-muted/40 border-b border-border p-5 space-y-4 text-xs animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <PenTool className="h-4 w-4 text-primary" /> Digital Signatures & Institutional Seal Setup
                </h4>
                <p className="text-muted-foreground text-[11px]">
                  Upload high-resolution PNG/SVG signatures and the official school stamp to appear on all printed and generated report cards.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleApplyPreset('all')}
                className="gap-1 text-xs border-primary/40 text-primary hover:bg-primary/10"
              >
                <Sparkles className="h-3.5 w-3.5" /> Apply Verified Sample Mock Signatures & Seal
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Class Teacher Signature */}
              <div className="p-3 rounded-lg bg-card border border-border space-y-2">
                <span className="font-bold text-foreground block">Class Teacher Signature</span>
                {teacherSign ? (
                  <div className="h-14 bg-white/90 dark:bg-zinc-900 rounded flex items-center justify-center p-1 border">
                    <img src={teacherSign} alt="Teacher Signature" className="max-h-12 object-contain" />
                  </div>
                ) : (
                  <div className="h-14 border border-dashed border-border rounded flex items-center justify-center text-muted-foreground text-[10px]">
                    No Signature Set
                  </div>
                )}
                <div className="flex gap-1.5">
                  <label className="flex-1 cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, setTeacherSign)} />
                    <Button variant="outline" size="sm" className="w-full text-[11px] h-7 gap-1" asChild>
                      <span><Upload className="h-3 w-3" /> Upload</span>
                    </Button>
                  </label>
                  <Button variant="ghost" size="sm" className="text-[11px] h-7 px-2" onClick={() => handleApplyPreset('teacher')}>
                    Preset
                  </Button>
                </div>
              </div>

              {/* HOD Signature */}
              <div className="p-3 rounded-lg bg-card border border-border space-y-2">
                <span className="font-bold text-foreground block">HOD / Dean Signature</span>
                {hodSign ? (
                  <div className="h-14 bg-white/90 dark:bg-zinc-900 rounded flex items-center justify-center p-1 border">
                    <img src={hodSign} alt="HOD Signature" className="max-h-12 object-contain" />
                  </div>
                ) : (
                  <div className="h-14 border border-dashed border-border rounded flex items-center justify-center text-muted-foreground text-[10px]">
                    No Signature Set
                  </div>
                )}
                <div className="flex gap-1.5">
                  <label className="flex-1 cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, setHodSign)} />
                    <Button variant="outline" size="sm" className="w-full text-[11px] h-7 gap-1" asChild>
                      <span><Upload className="h-3 w-3" /> Upload</span>
                    </Button>
                  </label>
                  <Button variant="ghost" size="sm" className="text-[11px] h-7 px-2" onClick={() => handleApplyPreset('hod')}>
                    Preset
                  </Button>
                </div>
              </div>

              {/* Principal Signature */}
              <div className="p-3 rounded-lg bg-card border border-border space-y-2">
                <span className="font-bold text-foreground block">Principal Signature</span>
                {principalSign ? (
                  <div className="h-14 bg-white/90 dark:bg-zinc-900 rounded flex items-center justify-center p-1 border">
                    <img src={principalSign} alt="Principal Signature" className="max-h-12 object-contain" />
                  </div>
                ) : (
                  <div className="h-14 border border-dashed border-border rounded flex items-center justify-center text-muted-foreground text-[10px]">
                    No Signature Set
                  </div>
                )}
                <div className="flex gap-1.5">
                  <label className="flex-1 cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, setPrincipalSign)} />
                    <Button variant="outline" size="sm" className="w-full text-[11px] h-7 gap-1" asChild>
                      <span><Upload className="h-3 w-3" /> Upload</span>
                    </Button>
                  </label>
                  <Button variant="ghost" size="sm" className="text-[11px] h-7 px-2" onClick={() => handleApplyPreset('principal')}>
                    Preset
                  </Button>
                </div>
              </div>

              {/* Official Seal / Stamp */}
              <div className="p-3 rounded-lg bg-card border border-border space-y-2">
                <span className="font-bold text-foreground block">Institution Stamp / Seal</span>
                {stamp ? (
                  <div className="h-14 bg-white/90 dark:bg-zinc-900 rounded flex items-center justify-center p-1 border">
                    <img src={stamp} alt="Institution Stamp" className="max-h-12 object-contain" />
                  </div>
                ) : (
                  <div className="h-14 border border-dashed border-border rounded flex items-center justify-center text-muted-foreground text-[10px]">
                    No Stamp Set
                  </div>
                )}
                <div className="flex gap-1.5">
                  <label className="flex-1 cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, setStamp)} />
                    <Button variant="outline" size="sm" className="w-full text-[11px] h-7 gap-1" asChild>
                      <span><Upload className="h-3 w-3" /> Upload</span>
                    </Button>
                  </label>
                  <Button variant="ghost" size="sm" className="text-[11px] h-7 px-2" onClick={() => handleApplyPreset('stamp')}>
                    Preset
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-muted-foreground">
                <input
                  type="checkbox"
                  checked={applyToAll}
                  onChange={(e) => setApplyToAll(e.target.checked)}
                  className="rounded border-border"
                />
                Apply signatures & official stamp to all report cards in this examination
              </label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowConfig(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveSignatures}
                  disabled={savingSignatures}
                  className="bg-primary text-primary-foreground gap-1.5"
                >
                  <Check className="h-3.5 w-3.5" />
                  {savingSignatures ? 'Saving...' : 'Save & Apply to Report Cards'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Printable Container */}
        <div ref={printRef} className="p-6 sm:p-8 space-y-6 print:p-0 print:text-black">
          {/* Header Banner */}
          <div className="flex items-center justify-between border-b pb-4 border-border">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xl">
                <GraduationCap className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">{currentOrg?.name || 'Academic Institution'}</h2>
                <p className="text-xs text-muted-foreground">Official Student Academic Performance & Report Card</p>
              </div>
            </div>
            <div className="text-right">
              <Badge variant="outline" className="text-xs font-mono font-semibold px-2.5 py-0.5">
                Session {reportCard.academicSession || '2026-2027'}
              </Badge>
              <div className="text-[11px] text-muted-foreground mt-1">{reportCard.term || 'Term 1'} Evaluation</div>
            </div>
          </div>

          {/* Student & Performance Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/40 p-4 rounded-xl border border-border/60">
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Result Status</span>
              <Badge
                variant={isPassed ? 'default' : isAbsent ? 'outline' : 'destructive'}
                className="mt-1 font-bold"
              >
                {isPassed ? 'PASSED' : isAbsent ? 'ABSENT' : 'FAILED / REMEDIAL'}
              </Badge>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Overall Grade</span>
              <span className="text-lg font-bold text-foreground">{reportCard.overallGrade || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Total Percentage</span>
              <span className="text-lg font-bold text-primary">{reportCard.percentage}%</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Attendance</span>
              <span className="text-sm font-semibold text-foreground">
                {attendance.percentage}% <span className="text-[11px] text-muted-foreground">({attendance.daysPresent}/{attendance.totalDays} days)</span>
              </span>
            </div>
          </div>

          {/* Subject Breakdown Table */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
              Subject Assessment & Marks Breakdown
            </h4>
            <div className="border border-border/80 rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/80 text-muted-foreground font-semibold border-b border-border/80">
                  <tr>
                    <th className="p-2.5">Subject / Lab Component</th>
                    <th className="p-2.5 text-center">Max Marks</th>
                    <th className="p-2.5 text-center">Passing</th>
                    <th className="p-2.5 text-center">Marks Obtained</th>
                    <th className="p-2.5 text-center">Grade</th>
                    <th className="p-2.5 text-center">Status</th>
                    <th className="p-2.5">Faculty Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {subjects.map((sub, idx) => (
                    <tr key={idx} className="hover:bg-muted/30">
                      <td className="p-2.5 font-medium flex items-center gap-1.5">
                        {sub.subjectName}
                        {sub.isLabOrPractical && (
                          <Badge variant="secondary" className="text-[9px] h-4 px-1">Lab</Badge>
                        )}
                      </td>
                      <td className="p-2.5 text-center">{sub.maxMarks}</td>
                      <td className="p-2.5 text-center text-muted-foreground">{sub.passingMarks}</td>
                      <td className="p-2.5 text-center font-bold">
                        {sub.isAbsent ? (
                          <span className="text-amber-500 font-semibold">Absent</span>
                        ) : (
                          sub.marksObtained ?? '-'
                        )}
                      </td>
                      <td className="p-2.5 text-center font-bold">{sub.grade || '-'}</td>
                      <td className="p-2.5 text-center">
                        {sub.isAbsent ? (
                          <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">Absent</Badge>
                        ) : sub.isPassed ? (
                          <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30">Pass</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">Fail</Badge>
                        )}
                      </td>
                      <td className="p-2.5 text-muted-foreground italic text-[11px]">
                        {sub.remarks || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/50 font-bold border-t border-border">
                  <tr>
                    <td className="p-2.5">Aggregate Total</td>
                    <td className="p-2.5 text-center">{reportCard.totalMaxMarks}</td>
                    <td className="p-2.5 text-center">-</td>
                    <td className="p-2.5 text-center text-primary">{reportCard.totalMarksObtained}</td>
                    <td className="p-2.5 text-center">{reportCard.overallGrade}</td>
                    <td className="p-2.5 text-center" colSpan={2}>
                      <span className={isPassed ? 'text-emerald-500' : 'text-rose-500'}>
                        {reportCard.percentage}% Overall
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* AI Qualitative Feedback & Teacher Remarks */}
          <div className="space-y-3">
            {reportCard.aiRemarks && (
              <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-purple-600 dark:text-purple-400">
                  <Sparkles className="h-3.5 w-3.5" /> AI Academic Performance Synthesis
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  {reportCard.aiRemarks}
                </p>
              </div>
            )}

            {reportCard.teacherRemarks && (
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-xs space-y-1">
                <div className="font-bold text-foreground">Class Teacher Observations</div>
                <p className="text-muted-foreground">{reportCard.teacherRemarks}</p>
              </div>
            )}
          </div>

          {/* Official Signatures & Seal Block */}
          <div className="pt-8 border-t border-border relative">
            <div className="grid grid-cols-3 gap-6 items-end text-xs text-muted-foreground">
              {/* Class Teacher */}
              <div className="text-center flex flex-col items-center">
                {effectiveTeacherSign ? (
                  <div className="h-12 flex items-center justify-center mb-1">
                    <img src={effectiveTeacherSign} alt="Class Teacher Signature" className="max-h-12 object-contain" />
                  </div>
                ) : (
                  <div className="h-8" />
                )}
                <div className="w-36 border-b border-muted-foreground/40 mb-1" />
                <span className="font-medium text-foreground">Class Teacher Signature</span>
                <span className="text-[10px] text-muted-foreground">Grade Evaluator</span>
              </div>

              {/* Head of Department */}
              <div className="text-center flex flex-col items-center">
                {effectiveHodSign ? (
                  <div className="h-12 flex items-center justify-center mb-1">
                    <img src={effectiveHodSign} alt="HOD Signature" className="max-h-12 object-contain" />
                  </div>
                ) : (
                  <div className="h-8" />
                )}
                <div className="w-36 border-b border-muted-foreground/40 mb-1" />
                <span className="font-medium text-foreground">Head of Department / Dean</span>
                <span className="text-[10px] text-muted-foreground">Academic Board Signoff</span>
              </div>

              {/* Principal & Official Stamp */}
              <div className="text-center flex flex-col items-center relative">
                {/* Stamp placed authentic diagonal offset */}
                {effectiveStamp && (
                  <div className="absolute -top-7 right-4 opacity-85 pointer-events-none transform -rotate-12">
                    <img src={effectiveStamp} alt="Official Seal" className="w-16 h-16 object-contain" />
                  </div>
                )}
                {effectivePrincipalSign ? (
                  <div className="h-12 flex items-center justify-center mb-1">
                    <img src={effectivePrincipalSign} alt="Principal Signature" className="max-h-12 object-contain" />
                  </div>
                ) : (
                  <div className="h-8" />
                )}
                <div className="w-36 border-b border-muted-foreground/40 mb-1" />
                <span className="font-medium text-foreground">Principal / Institution Seal</span>
                <span className="text-[10px] text-muted-foreground">Certified Authentic</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <DialogFooter className="p-4 bg-muted/30 border-t border-border flex sm:justify-between items-center">
          <span className="text-[11px] text-muted-foreground">
            Generated on {new Date(reportCard.createdAt || Date.now()).toLocaleDateString('en-GB')}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button size="sm" onClick={handlePrint} className="gap-1.5 bg-primary text-primary-foreground">
              <Printer className="h-3.5 w-3.5" /> Print / Save PDF
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

