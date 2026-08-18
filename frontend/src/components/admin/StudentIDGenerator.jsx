import React, { useState } from 'react';
import { read, utils } from 'xlsx';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgData } from '@/contexts/OrgDataContext';
import { studentApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCheck, Sparkles, Download, Copy, Check, FileText, Upload, ShieldAlert, Key, Users, RefreshCw, Sliders, Eye } from 'lucide-react';
import { toast } from 'sonner';

// Target System Fields for Auto-Mapping & Alias Synonyms
const SYSTEM_FIELDS = [
  { key: 'fullName', label: 'Student Full Name', required: true, aliases: ['name', 'student name', 'full name', 'fullname', 'child name', 'candidate name', 'student_name'] },
  { key: 'admissionNo', label: 'Admission / Roll Number', required: true, aliases: ['admission no', 'admissionno', 'adm no', 'admno', 'roll no', 'rollno', 'reg no', 'registration no', 'id', 'student id', 'enrollment no', 'adm_no'] },
  { key: 'departmentName', label: 'School Wing / Department', required: true, aliases: ['wing', 'school wing', 'department', 'dept', 'division', 'school_wing'] },
  { key: 'className', label: 'Class & Section', required: true, aliases: ['class', 'section', 'grade', 'standard', 'class/sec', 'team', 'class section', 'class_name'] },
  { key: 'parentFullName', label: 'Parent Full Name (Optional)', required: false, aliases: ['father name', 'mother name', 'guardian name', 'parent name', 'parentname', 'father', 'mother', 'guardian', 'parent_name'] },
];

export default function StudentIDGenerator({ departments = [], onStudentCreated }) {
  const { currentOrg } = useAuth();
  const { refreshOrgData } = useOrgData() || {};
  const [mode, setMode] = useState('single'); // 'single' | 'mass'

  // Single mode state
  const [singleForm, setSingleForm] = useState({
    admissionNo: '',
    fullName: '',
    departmentId: '',
    teamId: '',
    parentFullName: '',
  });
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleResult, setSingleResult] = useState(null);
  const [copied, setCopied] = useState(false);

  // Mass mode state
  const [file, setFile] = useState(null);
  const [rawHeaders, setRawHeaders] = useState([]);
  const [dataRows, setDataRows] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [isMappingConfirmed, setIsMappingConfirmed] = useState(false);
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
        parentFullName: singleForm.parentFullName || undefined,
      });
      setSingleResult(res);
      setSingleForm({
        admissionNo: '',
        fullName: '',
        departmentId: '',
        teamId: '',
        parentFullName: '',
      });
      toast.success(`Student ID generated & enrolled into ${res.className}!`);
      if (onStudentCreated) onStudentCreated();
      if (refreshOrgData) refreshOrgData();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to generate student ID');
    } finally {
      setSingleLoading(false);
    }
  };

  const copyCredentials = () => {
    if (!singleResult) return;
    const pName = singleResult.parentName || singleResult.parent?.fullName || 'N/A';
    const pEmail = (singleResult.parentEmail && singleResult.parentEmail !== 'N/A') ? singleResult.parentEmail : 'N/A';
    const sEmail = (singleResult.email && singleResult.email !== 'N/A') ? singleResult.email : 'N/A';
    const pPass = singleResult.parentPassword || singleResult.parent?.tempPassword || 'N/A';
    const pId = singleResult.parentId || singleResult.parent?.parentId || 'N/A';

    const text = `STUDENT CREDENTIALS:
Name: ${singleResult.fullName}
Student ID: ${singleResult.studentId}
Email: ${sEmail}
Temp Password: ${singleResult.tempPassword}
Class Section: ${singleResult.className}

PARENT CREDENTIALS (LINKED):
Parent Name: ${pName}
Parent ID: ${pId}
Parent Email: ${pEmail}
Parent Temp Password: ${pPass}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Student & Parent credentials copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadSingleCSV = () => {
    if (!singleResult) return;
    const pName = singleResult.parentName || singleResult.parent?.fullName || '';
    const pEmail = (singleResult.parentEmail && singleResult.parentEmail !== 'N/A') ? singleResult.parentEmail : 'N/A';
    const sEmail = (singleResult.email && singleResult.email !== 'N/A') ? singleResult.email : 'N/A';
    const pPass = singleResult.parentPassword || singleResult.parent?.tempPassword || '';
    const pId = singleResult.parentId || singleResult.parent?.parentId || '';

    const headers = 'Full Name,Admission No,Student ID,Student Email,Student Password,Parent Name,Parent ID,Parent Email,Parent Password,Department,Class Section\n';
    const row = `"${singleResult.fullName}","${singleResult.admissionNo}","${singleResult.studentId}","${sEmail}","${singleResult.tempPassword}","${pName}","${pId}","${pEmail}","${pPass}","${singleResult.departmentName}","${singleResult.className}"\n`;
    const blob = new Blob([headers + row], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Student_Credentials_${singleResult.studentId}.csv`;
    link.click();
  };

  // Auto-Detect Column Mappings based on Header Aliases
  const autoDetectMapping = (headers) => {
    const initialMapping = {};
    const normHeaders = headers.map((h) => String(h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''));

    SYSTEM_FIELDS.forEach((sysField) => {
      let matchedHeader = '';
      for (const alias of sysField.aliases) {
        const normAlias = alias.replace(/[^a-z0-9]/g, '');
        const foundIdx = normHeaders.findIndex((nh) => nh === normAlias || nh.includes(normAlias) || normAlias.includes(nh));
        if (foundIdx !== -1) {
          matchedHeader = headers[foundIdx];
          break;
        }
      }
      initialMapping[sysField.key] = matchedHeader || '__UNMAPPED__';
    });

    return initialMapping;
  };

  // Smart Spreadsheet Parser (.xlsx, .xls, .csv)
  const handleFileChange = (uploadedFile) => {
    if (!uploadedFile) return;
    setFile(uploadedFile);
    setMassResults(null);
    setIsMappingConfirmed(false);
    setParsedRows([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = read(data, { type: 'array' });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const matrix = utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (!matrix || matrix.length === 0) {
          toast.error('Spreadsheet appears empty');
          return;
        }

        // Find header row (first row with non-empty string cells)
        let headerRowIdx = matrix.findIndex((row) => row.some((cell) => String(cell).trim().length > 0));
        if (headerRowIdx === -1) {
          toast.error('No header columns found in file');
          return;
        }

        const headers = matrix[headerRowIdx].map((c) => String(c || '').trim()).filter((h) => h.length > 0);
        const rows = matrix.slice(headerRowIdx + 1).filter((r) => r.some((cell) => String(cell).trim().length > 0));

        setRawHeaders(headers);
        setDataRows(rows);

        const detectedMap = autoDetectMapping(headers);
        setColumnMapping(detectedMap);
        toast.success(`Loaded ${file ? file.name : 'spreadsheet'}: ${rows.length} rows detected!`);
      } catch (err) {
        console.error('File parsing error:', err);
        toast.error('Failed to parse file. Please upload a valid .xlsx, .xls, or .csv file.');
      }
    };
    reader.readAsArrayBuffer(uploadedFile);
  };

  // Confirm Column Mapping & Construct Structured Rows
  const confirmMapping = () => {
    if (!columnMapping.fullName || columnMapping.fullName === '__UNMAPPED__') {
      toast.error('Please map the required field "Student Full Name" to a file column');
      return;
    }
    if (!columnMapping.admissionNo || columnMapping.admissionNo === '__UNMAPPED__') {
      toast.error('Please map the required field "Admission / Roll Number" to a file column');
      return;
    }
    if (!columnMapping.departmentName || columnMapping.departmentName === '__UNMAPPED__') {
      toast.error('Please map the required field "School Wing / Department" to a file column');
      return;
    }
    if (!columnMapping.className || columnMapping.className === '__UNMAPPED__') {
      toast.error('Please map the required field "Class & Section" to a file column');
      return;
    }

    const rows = dataRows.map((row) => {
      const getVal = (sysKey) => {
        const mappedHeader = columnMapping[sysKey];
        if (!mappedHeader || mappedHeader === '__UNMAPPED__') return '';
        const colIdx = rawHeaders.indexOf(mappedHeader);
        return colIdx !== -1 ? String(row[colIdx] || '').trim() : '';
      };

      return {
        fullName: getVal('fullName'),
        admissionNo: getVal('admissionNo'),
        departmentName: getVal('departmentName'),
        className: getVal('className'),
        parentFullName: getVal('parentFullName'),
      };
    }).filter((r) => r.fullName.length > 0);

    if (rows.length === 0) {
      toast.error('No valid student rows found with the selected mapping.');
      return;
    }

    setParsedRows(rows);
    setIsMappingConfirmed(true);
    toast.success(`Successfully mapped ${rows.length} student records! Ready for generation.`);
  };

  const downloadSampleTemplate = () => {
    const template = `FullName,AdmissionNo,DepartmentName,ClassName,ParentFullName
John Smith,ADM-2026-001,High School,Grade 10 - Sec A,Robert Smith
Emily Davis,ADM-2026-002,High School,Grade 10 - Sec A,
Michael Brown,ADM-2026-003,Middle School,Grade 8 - Sec B,Sarah Brown
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
      toast.success(`Successfully generated ${res.count} student & parent accounts!`);
      if (onStudentCreated) onStudentCreated();
      if (refreshOrgData) refreshOrgData();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to mass generate student IDs');
    } finally {
      setMassLoading(false);
    }
  };

  const downloadMassResultsCSV = () => {
    if (!massResults || !massResults.students?.length) return;

    let csv = 'Student Full Name,Admission No,Student ID,Student Temp Password,Parent Name,Parent ID,Parent Temp Password,Department,Class Section\n';
    massResults.students.forEach((s) => {
      const pName = s.parentName || s.parent?.fullName || '';
      const pId = s.parentId || s.parent?.parentId || '';
      const pPass = s.parentPassword || s.parent?.tempPassword || '';
      csv += `"${s.fullName}","${s.admissionNo}","${s.studentId}","${s.tempPassword}","${pName}","${pId}","${pPass}","${s.departmentName}","${s.className}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Mass_Student_Credentials_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <Card className="border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg font-bold">Student ID & Credentials Generator</CardTitle>
                <Badge variant="outline" className="text-amber-500 border-amber-500/30 font-semibold text-[10px] tracking-wider uppercase">
                  Admin Exclusive
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Generate unique Student IDs, passwords, and auto-enrol into database, class channels, and projects.
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 bg-background/80 p-1 rounded-xl border border-border/60">
              <Button
                size="sm"
                variant={mode === 'single' ? 'default' : 'ghost'}
                onClick={() => setMode('single')}
                className="text-xs h-7 gap-1.5"
              >
                <UserCheck className="h-3.5 w-3.5" /> Single Student
              </Button>
              <Button
                size="sm"
                variant={mode === 'mass' ? 'default' : 'ghost'}
                onClick={() => setMode('mass')}
                className="text-xs h-7 gap-1.5"
              >
                <Users className="h-3.5 w-3.5" /> Mass File Generator
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Mode Content */}
      <Card>
        <CardContent className="p-6">
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

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold">Parent Full Name (Optional)</Label>
                <Input
                  placeholder="e.g. Robert Smith"
                  value={singleForm.parentFullName}
                  onChange={(e) => setSingleForm({ ...singleForm, parentFullName: e.target.value })}
                />
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
              <div className="p-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-amber-300">
                    <Check className="h-4 w-4" /> Student & Parent Accounts Created
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={copyCredentials} className="h-7 text-xs gap-1 border-amber-500/30">
                      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copied ? 'Copied All' : 'Copy All Credentials'}
                    </Button>
                    <Button size="sm" onClick={downloadSingleCSV} className="h-7 text-xs gap-1 bg-amber-600 hover:bg-amber-700 text-white">
                      <Download className="h-3 w-3" /> Download CSV
                    </Button>
                  </div>
                </div>

                {/* Student Credentials Block */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5" /> Student Account Credentials
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="bg-background/80 p-2.5 rounded-xl border border-border">
                      <div className="text-muted-foreground text-[10px]">Student Name</div>
                      <div className="font-bold text-foreground mt-0.5">{singleResult.fullName}</div>
                    </div>
                    <div className="bg-background/80 p-2.5 rounded-xl border border-border">
                      <div className="text-muted-foreground text-[10px]">Admission Number</div>
                      <div className="font-mono text-muted-foreground mt-0.5">{singleResult.admissionNo}</div>
                    </div>
                    <div className="bg-background/80 p-2.5 rounded-xl border border-border">
                      <div className="text-muted-foreground text-[10px]">Student ID (Login ID)</div>
                      <div className="font-mono font-bold text-amber-400 mt-0.5">{singleResult.studentId}</div>
                    </div>
                    <div className="bg-background/80 p-2.5 rounded-xl border border-border">
                      <div className="text-muted-foreground text-[10px]">Temp Password</div>
                      <div className="font-mono font-bold text-emerald-400 mt-0.5">{singleResult.tempPassword}</div>
                    </div>
                  </div>
                </div>

                {/* Parent Credentials Block */}
                <div className="space-y-2 pt-2 border-t border-amber-500/20">
                  <div className="flex items-center justify-between text-xs font-semibold text-blue-300">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-blue-400" /> Parent / Guardian Account Credentials (Auto-Linked)
                    </div>
                    {singleResult.emailVerificationSent ? (
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                        ✉️ Verification Email Sent
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-300 border-blue-500/30">
                        ✓ Auto-Created Parent ID
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-background/80 p-2.5 rounded-xl border border-border">
                      <div className="text-muted-foreground text-[10px]">Parent Name</div>
                      <div className="font-bold text-foreground mt-0.5">{singleResult.parentName || singleResult.parent?.fullName}</div>
                    </div>
                    <div className="bg-background/80 p-2.5 rounded-xl border border-border">
                      <div className="text-muted-foreground text-[10px]">Parent ID (Login ID)</div>
                      <div className="font-mono font-bold text-purple-400 truncate mt-0.5" title={singleResult.parentId || singleResult.parent?.parentId || singleResult.parentEmail}>
                        {singleResult.parentId || singleResult.parent?.parentId || singleResult.parentEmail}
                      </div>
                    </div>
                    <div className="bg-background/80 p-2.5 rounded-xl border border-border">
                      <div className="text-muted-foreground text-[10px]">Parent Temp Password</div>
                      <div className="font-mono font-bold text-emerald-400 mt-0.5">
                        {singleResult.parentPassword || singleResult.parent?.tempPassword}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground flex items-center gap-2 pt-1 flex-wrap">
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
                Upload raw Excel spreadsheets (<span className="font-mono font-semibold">.xlsx, .xls</span>) or <span className="font-mono font-semibold">.csv</span> files. The system auto-detects column names like <em>Student Name</em>, <em>Roll No</em>, <em>Class</em>, and <em>Parent Details</em>.
              </div>
              <Button size="sm" variant="outline" onClick={downloadSampleTemplate} className="h-8 text-xs gap-1.5 border-blue-500/40 text-blue-300 hover:bg-blue-500/20">
                <Download className="h-3.5 w-3.5" /> Sample CSV Template
              </Button>
            </div>

            {/* Step 1: File Dropzone */}
            <div className="border-2 border-dashed border-border hover:border-amber-500/50 rounded-2xl p-6 text-center space-y-3 transition-colors bg-muted/20">
              <Upload className="h-10 w-10 text-amber-500 mx-auto" />
              <div>
                <div className="text-sm font-bold text-foreground">Select or Drag Excel (.xlsx / .xls) or CSV File</div>
                <div className="text-xs text-muted-foreground">Any column layout is accepted. Smart Auto-Mapping will match your headers automatically.</div>
              </div>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                onChange={(e) => handleFileChange(e.target.files?.[0])}
                className="mx-auto block text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-600 file:text-white hover:file:bg-amber-700 cursor-pointer"
              />
              {file && (
                <div className="text-xs text-emerald-400 font-medium pt-1">
                  ✓ Selected File: <strong>{file.name}</strong> ({dataRows.length} rows loaded)
                </div>
              )}
            </div>

            {/* Step 2: Smart Column Auto-Mapping & Live Preview */}
            {rawHeaders.length > 0 && (
              <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-5 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-amber-500/20 pb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-amber-400" />
                    <span className="text-sm font-bold text-foreground">Smart Column Auto-Mapping</span>
                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30">
                      Auto-Matched
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Verify or adjust dropdowns if your file headers differ
                  </div>
                </div>

                {/* Mapping Controls Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {SYSTEM_FIELDS.map((sysField) => (
                    <div key={sysField.key} className="bg-background/80 p-3 rounded-xl border border-border space-y-1.5 shadow-sm">
                      <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                        <span>{sysField.label}</span>
                        {sysField.required ? (
                          <Badge variant="outline" className="text-[9px] bg-rose-500/10 text-rose-400 border-rose-500/30">Required</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] text-muted-foreground border-border">Optional</Badge>
                        )}
                      </div>
                      <Select
                        value={columnMapping[sysField.key] || '__UNMAPPED__'}
                        onValueChange={(val) => {
                          setColumnMapping({ ...columnMapping, [sysField.key]: val });
                          setIsMappingConfirmed(false);
                        }}
                      >
                        <SelectTrigger className="text-xs h-8 bg-card">
                          <SelectValue placeholder="Select Column" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__UNMAPPED__" className="text-muted-foreground italic">
                            -- Do Not Map --
                          </SelectItem>
                          {rawHeaders.map((header, idx) => (
                            <SelectItem key={idx} value={header}>
                              📄 {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                {/* Live 5-Row Data Preview Table */}
                <div className="space-y-2 pt-2 border-t border-amber-500/20">
                  <div className="flex items-center justify-between text-xs font-bold text-foreground">
                    <span className="flex items-center gap-1.5 text-amber-300">
                      <Eye className="h-3.5 w-3.5" /> Live Data Preview (First 5 Rows)
                    </span>
                    <span className="text-[11px] text-muted-foreground">Dynamically updates as dropdowns change</span>
                  </div>

                  <div className="max-h-48 overflow-auto border border-border rounded-xl bg-background/90">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/60 border-b border-border text-muted-foreground font-semibold">
                        <tr>
                          <th className="px-3 py-2">Full Name *</th>
                          <th className="px-3 py-2">Admission No</th>
                          <th className="px-3 py-2">Wing / Dept</th>
                          <th className="px-3 py-2">Class Section</th>
                          <th className="px-3 py-2">Student Email</th>
                          <th className="px-3 py-2">Parent Name</th>
                          <th className="px-3 py-2">Parent Email</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {dataRows.slice(0, 5).map((row, rIdx) => {
                          const getVal = (sysKey) => {
                            const mappedH = columnMapping[sysKey];
                            if (!mappedH || mappedH === '__UNMAPPED__') return '';
                            const colIdx = rawHeaders.indexOf(mappedH);
                            return colIdx !== -1 ? String(row[colIdx] || '').trim() : '';
                          };

                          return (
                            <tr key={rIdx} className="hover:bg-muted/30">
                              <td className="px-3 py-1.5 font-bold text-foreground">{getVal('fullName') || <span className="text-rose-400 italic">Missing</span>}</td>
                              <td className="px-3 py-1.5 font-mono text-muted-foreground">{getVal('admissionNo') || <span className="italic text-muted-foreground/60">Auto</span>}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{getVal('departmentName') || <span className="italic text-muted-foreground/60">Default</span>}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{getVal('className') || <span className="italic text-muted-foreground/60">Default</span>}</td>
                              <td className="px-3 py-1.5 font-mono text-blue-300">{getVal('studentEmail') || <span className="italic text-muted-foreground/60">None</span>}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{getVal('parentFullName') || <span className="italic text-muted-foreground/60">Auto</span>}</td>
                              <td className="px-3 py-1.5 font-mono text-purple-300">{getVal('parentEmail') || <span className="italic text-muted-foreground/60">None</span>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    onClick={confirmMapping}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs gap-2 shadow-md"
                  >
                    <Check className="h-4 w-4" /> Confirm Column Mapping & Parse Records
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Confirmed Parsed Rows & Generate Button */}
            {isMappingConfirmed && parsedRows.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-xs font-bold text-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4 text-emerald-400" />
                    <span>Mapped {parsedRows.length} Valid Student Records</span>
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Ready</Badge>
                  </div>
                  <Button
                    onClick={handleMassGenerate}
                    disabled={massLoading}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-2 shadow-lg"
                  >
                    {massLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {massLoading ? 'Generating Accounts & Enrolling…' : `Generate All ${parsedRows.length} Accounts`}
                  </Button>
                </div>

                <div className="max-h-60 overflow-auto border border-border rounded-xl bg-background/80">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/40 border-b border-border text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Full Name</th>
                        <th className="px-3 py-2">Admission No</th>
                        <th className="px-3 py-2">Wing / Dept</th>
                        <th className="px-3 py-2">Class Section</th>
                        <th className="px-3 py-2">Student Email</th>
                        <th className="px-3 py-2">Parent Name</th>
                        <th className="px-3 py-2">Parent Email</th>
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
                          <td className="px-3 py-1.5 font-mono text-blue-300">{r.studentEmail || 'None'}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.parentFullName || 'Auto'}</td>
                          <td className="px-3 py-1.5 font-mono text-purple-300">{r.parentEmail || 'None'}</td>
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
    </div>
  );
}
