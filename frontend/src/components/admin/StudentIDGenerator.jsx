import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { studentApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCheck, Sparkles, Download, Copy, Check, FileText, UploadCloud, ShieldAlert, Key, Users, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function StudentIDGenerator({ departments = [], onStudentCreated }) {
  const { currentOrg } = useAuth();
  const [mode, setMode] = useState('single'); // 'single' | 'mass'

  // Single mode state
  const [singleForm, setSingleForm] = useState({
    admissionNo: '',
    fullName: '',
    departmentId: '',
    teamId: '',
  });
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleResult, setSingleResult] = useState(null);
  const [copied, setCopied] = useState(false);

  // Mass mode state
  const [csvFile, setCsvFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [massLoading, setMassLoading] = useState(false);
  const [massResults, setMassResults] = useState(null);

  // Filter teams based on selected department (returns empty if no department selected)
  const selectedDeptObj = departments.find((d) => d.id === singleForm.departmentId);
  const availableTeams = selectedDeptObj ? selectedDeptObj.teams || [] : [];

  const isSingleFormValid = Boolean(
    singleForm.admissionNo.trim() &&
    singleForm.fullName.trim() &&
    singleForm.departmentId &&
    singleForm.teamId
  );

  const handleSingleGenerate = async (e) => {
    e.preventDefault();
    if (!singleForm.admissionNo.trim()) {
      toast.error('Please enter Student Admission Number');
      return;
    }
    if (!singleForm.fullName.trim()) {
      toast.error('Please enter Student Full Name');
      return;
    }
    if (!currentOrg?.id) return;

    setSingleLoading(true);
    setSingleResult(null);
    try {
      const res = await studentApi.generateSingle(currentOrg.id, {
        admissionNo: singleForm.admissionNo,
        fullName: singleForm.fullName,
        departmentId: singleForm.departmentId || undefined,
        teamId: singleForm.teamId || undefined,
      });
      setSingleResult(res);
      toast.success(`Student ID generated & enrolled into ${res.className}!`);
      if (onStudentCreated) onStudentCreated();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to generate student ID');
    } finally {
      setSingleLoading(false);
    }
  };

  const copyCredentials = () => {
    if (!singleResult) return;
    const text = `Student Credentials:
Name: ${singleResult.fullName}
Student ID: ${singleResult.studentId}
Email: ${singleResult.email}
Temp Password: ${singleResult.tempPassword}
Class Section: ${singleResult.className}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Credentials copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadSingleCSV = () => {
    if (!singleResult) return;
    const headers = 'Full Name,Admission No,Student ID,Email,Temporary Password,Department,Class Section\n';
    const row = `"${singleResult.fullName}","${singleResult.admissionNo}","${singleResult.studentId}","${singleResult.email}","${singleResult.tempPassword}","${singleResult.departmentName}","${singleResult.className}"\n`;
    const blob = new Blob([headers + row], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Student_Credentials_${singleResult.studentId}.csv`;
    link.click();
  };

  // CSV Parsing for Mass Generator
  const handleFileChange = (file) => {
    if (!file) return;
    setCsvFile(file);
    setMassResults(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        toast.error('CSV file appears empty or missing data rows');
        setParsedRows([]);
        return;
      }

      // Parse headers
      const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
      const nameIdx = headers.findIndex((h) => h.includes('name') || h.includes('student'));
      const admIdx = headers.findIndex((h) => h.includes('adm') || h.includes('id') || h.includes('roll'));
      const deptIdx = headers.findIndex((h) => h.includes('dept') || h.includes('wing') || h.includes('department'));
      const classIdx = headers.findIndex((h) => h.includes('class') || h.includes('section') || h.includes('team'));

      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
        if (!cols[0]) continue;

        const fullName = nameIdx !== -1 ? cols[nameIdx] : cols[0];
        const admissionNo = admIdx !== -1 ? cols[admIdx] : cols[1] || '';
        const departmentName = deptIdx !== -1 ? cols[deptIdx] : cols[2] || '';
        const className = classIdx !== -1 ? cols[classIdx] : cols[3] || '';

        if (fullName) {
          rows.push({ fullName, admissionNo, departmentName, className });
        }
      }

      setParsedRows(rows);
      toast.success(`Parsed ${rows.length} student records from CSV!`);
    };
    reader.readAsText(file);
  };

  const downloadSampleTemplate = () => {
    const template = `FullName,AdmissionNo,DepartmentName,ClassName
John Smith,ADM-2026-001,High School,Grade 10 - Sec A
Emily Davis,ADM-2026-002,High School,Grade 10 - Sec A
Michael Brown,ADM-2026-003,Middle School,Grade 8 - Sec B
`;
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Sample_Student_Import_Template.csv';
    link.click();
  };

  const handleMassGenerate = async () => {
    if (!parsedRows.length || !currentOrg?.id) return;

    setMassLoading(true);
    setMassResults(null);
    try {
      const res = await studentApi.generateMass(currentOrg.id, { students: parsedRows });
      setMassResults(res);
      toast.success(`Successfully generated ${res.count} student accounts & credentials!`);
      if (onStudentCreated) onStudentCreated();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to mass generate student IDs');
    } finally {
      setMassLoading(false);
    }
  };

  const downloadMassResultsCSV = () => {
    if (!massResults || !massResults.students?.length) return;

    let csv = 'Full Name,Admission No,Student ID,Student Email,Temporary Password,Department,Class Section\n';
    massResults.students.forEach((s) => {
      csv += `"${s.fullName}","${s.admissionNo}","${s.studentId}","${s.email}","${s.tempPassword}","${s.departmentName}","${s.className}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Generated_Students_Credentials_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <Card className="border-amber-500/30 bg-card/60 backdrop-blur-sm shadow-xl">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                Student ID & Credentials Generator
                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30">
                  Admin Exclusive
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Generate unique Student IDs, passwords, and auto-enrol into database, class channels, and projects.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                mode === 'single' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <UserCheck className="h-3.5 w-3.5 text-amber-400" />
              <span>Single Student</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('mass')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                mode === 'mass' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="h-3.5 w-3.5 text-blue-400" />
              <span>Mass File Generator</span>
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {mode === 'single' ? (
          <div className="space-y-6">
            <form onSubmit={handleSingleGenerate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Admission Number *</Label>
                <Input
                  required
                  placeholder="e.g. ADM-2026-101"
                  value={singleForm.admissionNo}
                  onChange={(e) => setSingleForm({ ...singleForm, admissionNo: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Student Full Name *</Label>
                <Input
                  required
                  placeholder="e.g. Sarah Jenkins"
                  value={singleForm.fullName}
                  onChange={(e) => setSingleForm({ ...singleForm, fullName: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">School Wing / Department *</Label>
                <Select
                  value={singleForm.departmentId}
                  onValueChange={(val) => setSingleForm({ ...singleForm, departmentId: val, teamId: '' })}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Select Wing / Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Class & Section *</Label>
                <Select
                  disabled={!singleForm.departmentId}
                  value={singleForm.teamId}
                  onValueChange={(val) => setSingleForm({ ...singleForm, teamId: val })}
                >
                  <SelectTrigger className={`text-xs ${!singleForm.departmentId ? 'opacity-60 bg-muted/30 cursor-not-allowed' : ''}`}>
                    <SelectValue
                      placeholder={
                        singleForm.departmentId
                          ? "Select Class & Section"
                          : "⚠️ Select School Wing / Department first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTeams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                    {availableTeams.length === 0 && (
                      <div className="p-2.5 text-xs text-muted-foreground text-center">
                        No class sections found for this wing
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2 pt-2">
                <Button
                  type="submit"
                  disabled={singleLoading || !isSingleFormValid}
                  className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-2 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-amber-600"
                >
                  {singleLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {singleLoading ? 'Generating & Enrolling Student…' : 'Generate Student ID & Credentials'}
                </Button>
                {!isSingleFormValid && (
                  <p className="text-[11px] text-muted-foreground mt-2 italic">
                    * Fill Admission Number, Full Name, Department, and Class & Section to enable generation button.
                  </p>
                )}
              </div>
            </form>

            {/* Generated Output Card */}
            {singleResult && (
              <div className="p-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 space-y-3 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-amber-300">
                    <Check className="h-4 w-4" /> Student Created & Enrolled
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={copyCredentials} className="h-7 text-xs gap-1 border-amber-500/30">
                      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                    <Button size="sm" onClick={downloadSingleCSV} className="h-7 text-xs gap-1 bg-amber-600 hover:bg-amber-700 text-white">
                      <Download className="h-3 w-3" /> Download CSV
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="bg-background/80 p-2.5 rounded-xl border border-border">
                    <div className="text-muted-foreground text-[10px]">Student Name</div>
                    <div className="font-bold text-foreground mt-0.5">{singleResult.fullName}</div>
                  </div>
                  <div className="bg-background/80 p-2.5 rounded-xl border border-border">
                    <div className="text-muted-foreground text-[10px]">Generated Student ID</div>
                    <div className="font-mono font-bold text-amber-400 mt-0.5">{singleResult.studentId}</div>
                  </div>
                  <div className="bg-background/80 p-2.5 rounded-xl border border-border">
                    <div className="text-muted-foreground text-[10px]">Student Login Email</div>
                    <div className="font-mono text-foreground truncate mt-0.5" title={singleResult.email}>{singleResult.email}</div>
                  </div>
                  <div className="bg-background/80 p-2.5 rounded-xl border border-border">
                    <div className="text-muted-foreground text-[10px]">Temp Password</div>
                    <div className="font-mono font-bold text-emerald-400 mt-0.5">{singleResult.tempPassword}</div>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground flex items-center gap-2 pt-1">
                  <span>Enrolled in: <strong className="text-foreground">{singleResult.departmentName} • {singleResult.className}</strong></span>
                  <span>•</span>
                  <span className="text-emerald-400">Added to Database, Class Channels, and Projects</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Mass File Mode */
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-blue-500/10 p-3.5 rounded-xl border border-blue-500/20 flex-wrap gap-2">
              <div className="text-xs text-blue-300">
                Upload a CSV file containing columns: <span className="font-mono font-semibold">FullName, AdmissionNo, DepartmentName, ClassName</span>.
              </div>
              <Button size="sm" variant="outline" onClick={downloadSampleTemplate} className="h-8 text-xs gap-1.5 border-blue-500/40 text-blue-300 hover:bg-blue-500/20">
                <Download className="h-3.5 w-3.5" /> Sample CSV Template
              </Button>
            </div>

            <div className="border-2 border-dashed border-border hover:border-amber-500/50 rounded-2xl p-6 text-center space-y-3 transition-colors bg-muted/20">
              <UploadCloud className="h-10 w-10 text-amber-500 mx-auto" />
              <div>
                <div className="text-sm font-bold text-foreground">Select or Drag CSV File of Student Records</div>
                <div className="text-xs text-muted-foreground">The system will parse all students and generate unique IDs & passwords</div>
              </div>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={(e) => handleFileChange(e.target.files?.[0])}
                className="mx-auto block text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-600 file:text-white hover:file:bg-amber-700 cursor-pointer"
              />
            </div>

            {parsedRows.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4 text-amber-400" />
                    <span>Parsed {parsedRows.length} Student Records</span>
                  </div>
                  <Button
                    onClick={handleMassGenerate}
                    disabled={massLoading}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-2 shadow-lg"
                  >
                    {massLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {massLoading ? 'Mass Generating IDs & Enrolling…' : `Generate All ${parsedRows.length} Accounts`}
                  </Button>
                </div>

                <div className="max-h-60 overflow-auto border border-border rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/40 border-b border-border text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Full Name</th>
                        <th className="px-3 py-2">Admission No</th>
                        <th className="px-3 py-2">Wing / Dept</th>
                        <th className="px-3 py-2">Class Section</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {parsedRows.map((r, i) => (
                        <tr key={i} className="hover:bg-muted/30">
                          <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-1.5 font-semibold text-foreground">{r.fullName}</td>
                          <td className="px-3 py-1.5 font-mono text-muted-foreground">{r.admissionNo || 'Auto'}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.departmentName || 'Default'}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.className || 'Default'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Mass Results Output */}
            {massResults && massResults.students?.length > 0 && (
              <div className="p-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-emerald-500/20 pb-3">
                  <div>
                    <div className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                      <Check className="h-4 w-4" /> Successfully Generated {massResults.count} Student Accounts!
                    </div>
                    <div className="text-xs text-muted-foreground">All students were enrolled into their database records, class channels, and projects.</div>
                  </div>
                  <Button onClick={downloadMassResultsCSV} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2 shadow-lg">
                    <Download className="h-4 w-4" /> Download Generated Credentials CSV
                  </Button>
                </div>

                <div className="max-h-64 overflow-auto border border-emerald-500/30 rounded-xl bg-background/80">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/40 border-b border-border text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Student ID</th>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Temp Password</th>
                        <th className="px-3 py-2">Class Section</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-mono">
                      {massResults.students.map((s, idx) => (
                        <tr key={idx} className="hover:bg-muted/30">
                          <td className="px-3 py-1.5 font-sans font-semibold text-foreground">{s.fullName}</td>
                          <td className="px-3 py-1.5 font-bold text-amber-400">{s.studentId}</td>
                          <td className="px-3 py-1.5 text-foreground">{s.email}</td>
                          <td className="px-3 py-1.5 font-bold text-emerald-400">{s.tempPassword}</td>
                          <td className="px-3 py-1.5 font-sans text-muted-foreground">{s.className}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
