import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { authApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  GraduationCap,
  Scale,
  ShieldCheck,
  Lock,
  Check,
  Copy,
  AlertTriangle,
  User,
  Mail,
  KeyRound,
  Users,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function StudentRegistrationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [linkData, setLinkData] = useState(null);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    admissionNo: '',
    departmentId: '',
    teamId: '',
    parentFullName: '',
    password: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [registrationResult, setRegistrationResult] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  useEffect(() => {
    if (!token) {
      setError('Registration token is missing. You must use the complete private link provided by your institution.');
      setLoading(false);
      return;
    }

    async function verifyLink() {
      try {
        setLoading(true);
        const res = await authApi.verifyStudentJoinLink(token);
        if (res.valid) {
          setLinkData(res);
          setFormData((prev) => ({
            ...prev,
            departmentId: res.allowedDeptId || '',
            teamId: res.allowedTeamId || '',
          }));
        } else {
          setError(res.error || 'Invalid or expired registration link.');
        }
      } catch (err) {
        setError(
          err?.response?.data?.error ||
            'This registration link is invalid or has expired. Please request a new link from your institution administrator.'
        );
      } finally {
        setLoading(false);
      }
    }

    verifyLink();
  }, [token]);

  // Selected department teams
  const selectedDept = linkData?.departments?.find((d) => d.id === formData.departmentId);
  const availableTeams = selectedDept ? selectedDept.teams || [] : [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fullName.trim()) {
      toast.error('Please enter your full name');
      return;
    }
    if (!formData.email.trim()) {
      toast.error('Please enter your student email');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        token,
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        admissionNo: formData.admissionNo.trim() || undefined,
        departmentId: formData.departmentId || undefined,
        teamId: formData.teamId || undefined,
        parentFullName: formData.parentFullName.trim() || undefined,
        password: formData.password.trim() || undefined,
      };

      const result = await authApi.submitStudentJoin(payload);
      setRegistrationResult(result);
      toast.success('Registration completed successfully!');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Registration failed. Please check your details.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`${fieldName} copied to clipboard!`);
    setTimeout(() => setCopiedField(null), 2500);
  };

  // State 1: Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm font-medium text-muted-foreground">Verifying secure institutional link...</p>
        </div>
      </div>
    );
  }

  // State 2: Access Denied / Invalid Token
  if (error || !linkData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <Card className="border-border/80 shadow-xl overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-red-500 via-amber-500 to-red-500" />
            <CardHeader className="text-center p-6 sm:p-8 space-y-3">
              <div className="h-16 w-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto border border-red-500/20 shadow-inner">
                <Lock className="h-8 w-8" />
              </div>
              <CardTitle className="text-xl font-bold text-foreground">Access Restricted</CardTitle>
              <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                {error || 'This student registration portal is private. You must use an authorized, active link shared directly by your school.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              <div className="bg-muted/50 rounded-xl p-3.5 border border-border text-[11px] text-muted-foreground flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  Unauthorized manual access is blocked for student safety. Please contact your institution's director or administrator for an active registration link.
                </span>
              </div>
              <Button onClick={() => navigate('/login')} variant="outline" className="w-full text-xs">
                Return to Institutional Portal Login
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const { organization, departments = [] } = linkData;

  // State 3: Success Screen (Registration Result)
  if (registrationResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-xl w-full"
        >
          <Card className="border-emerald-500/30 shadow-2xl overflow-hidden bg-card/90 backdrop-blur-md">
            <div className="h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600" />
            <CardHeader className="p-6 sm:p-8 text-center space-y-3 pb-4">
              <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-500/30 shadow-inner">
                <ShieldCheck className="h-9 w-9" />
              </div>
              <div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] uppercase font-bold tracking-wider mb-2">
                  Account Verified & Provisioned
                </Badge>
                <CardTitle className="text-2xl font-black text-foreground">Welcome to {organization.name}!</CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-1">
                  Your Student ID and institutional access credentials have been securely generated.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="p-6 sm:p-8 pt-0 space-y-5">
              {/* AI-Legal Badge if enabled */}
              {registrationResult.aiLegal?.enabled && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 text-xs text-purple-700 dark:text-purple-300 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Scale className="h-4 w-4 mt-0.5 text-purple-600 shrink-0" />
                    <div>
                      <strong>AI-Legal™ Academic Suite Activated:</strong>
                      <p className="text-[11px] text-purple-600/90 dark:text-purple-400/90 mt-0.5">
                        Your account has been provisioned with the AI-Legal research platform on the <strong>Full Institutional Academic Suite (Active & Auto-Renewed Monthly)</strong>.
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-purple-500/20 text-purple-600 border-purple-500/40 text-[10px] shrink-0">
                    ACTIVATED
                  </Badge>
                </div>
              )}

              {/* Student Credentials Card */}
              <div className="bg-muted/50 rounded-2xl p-5 border border-border space-y-3 font-mono text-xs">
                <div className="text-[10px] uppercase font-sans font-bold tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Student Portal Credentials</span>
                  <Badge variant="secondary" className="text-primary font-mono text-[10px]">
                    {registrationResult.student.studentId}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 bg-background rounded-lg border border-border/60">
                    <div>
                      <span className="text-[10px] text-muted-foreground font-sans block uppercase">Full Name</span>
                      <span className="font-semibold text-foreground font-sans text-sm">{registrationResult.student.fullName}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-background rounded-lg border border-border/60">
                    <div>
                      <span className="text-[10px] text-muted-foreground font-sans block uppercase">Login Email / Student ID</span>
                      <span className="text-foreground">{registrationResult.student.email}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(registrationResult.student.email, 'Student Email')}
                      className="h-7 w-7 p-0"
                    >
                      {copiedField === 'Student Email' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-background rounded-lg border border-border/60">
                    <div>
                      <span className="text-[10px] text-muted-foreground font-sans block uppercase">Temporary Password</span>
                      <span className="text-emerald-500 font-bold">{registrationResult.student.password}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(registrationResult.student.password, 'Student Password')}
                      className="h-7 w-7 p-0"
                    >
                      {copiedField === 'Student Password' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Parent Credentials Card */}
              {registrationResult.parent?.parentId && (
                <div className="bg-muted/30 rounded-xl p-4 border border-border/60 space-y-2 font-mono text-xs">
                  <div className="text-[10px] uppercase font-sans font-bold tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Linked Parent Account</span>
                    <Badge variant="outline" className="text-[10px]">
                      {registrationResult.parent.parentId}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-sans text-muted-foreground">Parent Login ID:</span>
                    <span className="text-foreground font-bold">{registrationResult.parent.email}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-sans text-muted-foreground">Parent Password:</span>
                    <span className="text-emerald-500 font-bold">{registrationResult.parent.password}</span>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 text-xs gap-2"
                  onClick={() =>
                    copyToClipboard(
                      `🎓 ${organization.name} - Student Portal Credentials\nLogin Portal: ${window.location.origin}/login\nStudent ID: ${registrationResult.student.studentId}\nEmail: ${registrationResult.student.email}\nPassword: ${registrationResult.student.password}\n\nParent Portal Login: ${registrationResult.parent.email}\nParent Password: ${registrationResult.parent.password}`,
                      'All Credentials'
                    )
                  }
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copiedField === 'All Credentials' ? 'Copied Full Summary!' : 'Copy All Credentials'}
                </Button>
                <Button
                  className="flex-1 text-xs gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
                  onClick={() => navigate('/login')}
                >
                  Proceed to Login <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // State 4: Interactive Registration Form
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center p-4 sm:p-6 py-10">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full"
      >
        <Card className="border-border/80 shadow-2xl overflow-hidden bg-card/95 backdrop-blur-md">
          {/* Header Banner */}
          <div className="h-2 bg-gradient-to-r from-primary via-indigo-600 to-purple-600" />
          
          <CardHeader className="p-6 sm:p-8 space-y-4 pb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-lg border border-primary/20 shadow-xs">
                  {organization.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground border-border/80">
                    Official Student Registration
                  </Badge>
                  <CardTitle className="text-xl font-bold text-foreground mt-0.5">{organization.name}</CardTitle>
                </div>
              </div>
            </div>

            {/* AI-Legal Add-on Badge Banner */}
            {organization.hasAiLegal && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3.5 text-xs text-purple-700 dark:text-purple-300 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-semibold">
                  <Scale className="h-4 w-4 text-purple-600 shrink-0" />
                  <span>AI-Legal™ Suite Enabled for this Institution</span>
                </div>
                <Badge variant="outline" className="bg-purple-500/20 text-purple-600 border-purple-500/40 text-[9px] uppercase font-bold shrink-0">
                  Included
                </Badge>
              </div>
            )}

            <CardDescription className="text-xs text-muted-foreground">
              Please enter your details below to create your official student account, class enrollment, and parent portal access.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 sm:p-8 pt-2">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 1. Student Personal Information */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase font-semibold tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-primary" /> 1. Student Details
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="fullName" className="text-xs">
                      Student Full Name *
                    </Label>
                    <Input
                      id="fullName"
                      placeholder="e.g. Alex Rivera"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      required
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs">
                      Student Email Address *
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="alex@school.edu"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                        className="h-9 pl-9 text-sm font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="admissionNo" className="text-xs">
                      Admission / Roll No (Optional)
                    </Label>
                    <Input
                      id="admissionNo"
                      placeholder="e.g. ADM-2026-101"
                      value={formData.admissionNo}
                      onChange={(e) => setFormData({ ...formData, admissionNo: e.target.value })}
                      className="h-9 text-sm font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Academic Wing & Class */}
              <div className="pt-2 border-t border-border/40 space-y-3">
                <h4 className="text-xs uppercase font-semibold tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-indigo-500" /> 2. Class & Academic Wing
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">School Wing / Department</Label>
                    <Select
                      disabled={Boolean(linkData.allowedDeptId)}
                      value={formData.departmentId || '__NONE__'}
                      onValueChange={(val) => setFormData({ ...formData, departmentId: val === '__NONE__' ? '' : val, teamId: '' })}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select School Wing" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Class & Section</Label>
                    <Select
                      disabled={Boolean(linkData.allowedTeamId) || !formData.departmentId}
                      value={formData.teamId || '__NONE__'}
                      onValueChange={(val) => setFormData({ ...formData, teamId: val === '__NONE__' ? '' : val })}
                    >
                      <SelectTrigger className={`h-9 text-xs ${!formData.departmentId ? 'opacity-60 cursor-not-allowed' : ''}`}>
                        <SelectValue placeholder={formData.departmentId ? 'Select Class & Section' : 'Select Wing first'} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTeams.length > 0 ? (
                          availableTeams.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))
                        ) : (
                          <SelectItem value="__NONE__" disabled>No sections in this wing</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* 3. Parent Information & Security */}
              <div className="pt-2 border-t border-border/40 space-y-3">
                <h4 className="text-xs uppercase font-semibold tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-emerald-500" /> 3. Parent & Security Details
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="parentFullName" className="text-xs">
                      Parent / Guardian Full Name
                    </Label>
                    <Input
                      id="parentFullName"
                      placeholder="e.g. Carlos Rivera (Parent)"
                      value={formData.parentFullName}
                      onChange={(e) => setFormData({ ...formData, parentFullName: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs">
                      Custom Password (Optional)
                    </Label>
                    <div className="relative">
                      <KeyRound className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="Auto-generated if empty"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="h-9 pl-9 text-sm font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border/40 space-y-3">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-10 bg-gradient-to-r from-primary via-indigo-600 to-primary hover:opacity-95 text-primary-foreground font-semibold text-sm shadow-md gap-2"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> Registering Account & Provisioning IDs...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-amber-300" /> Complete Registration
                    </>
                  )}
                </Button>

                <p className="text-[11px] text-center text-muted-foreground">
                  By clicking Register, your unique Student ID will be generated and you will be added to your school's workspace.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
