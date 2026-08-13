import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Sparkles, ShieldCheck, Zap, Users, Mail, ArrowLeft, RefreshCw, GraduationCap, UserCheck, Info, KeyRound, Building2, IndianRupee } from 'lucide-react';
import { authApi } from '@/lib/api';

export default function LoginPage({ initialPortal = 'faculty' }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);
  const defaultMode = queryParams.get('portal') || initialPortal;
  const [portalMode, setPortalMode] = useState(defaultMode === 'student' ? 'student' : 'faculty');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  // View states: 'login' | 'unverified' | 'forgot' | 'forgot_sent'
  const [view, setView] = useState('login');
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login({ email, password, portalMode });
      const from = location.state?.from?.pathname || '/app/home';
      navigate(from, { replace: true });
    } catch (err) {
      const code = err?.response?.data?.code;
      const serverEmail = err?.response?.data?.email;
      if (code === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(serverEmail || email);
        setView('unverified');
      } else {
        toast.error(err?.response?.data?.error || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (demoEmail, demoPw, targetPortal = portalMode) => {
    setEmail(demoEmail);
    setPassword(demoPw);
    setLoading(true);
    try {
      await login({ email: demoEmail, password: demoPw, portalMode: targetPortal });
      const from = location.state?.from?.pathname || '/app/home';
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const startGoogle = async () => {
    try {
      const { url } = await authApi.googleStart('login');
      window.location.href = url;
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Google OAuth not configured');
    }
  };

  const resendVerification = async () => {
    setResendLoading(true);
    try {
      const res = await authApi.resendVerification(unverifiedEmail);
      toast.success(res?.message || 'Verification email sent! Check your inbox.');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to resend email');
    } finally {
      setResendLoading(false);
    }
  };

  const sendForgotPassword = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      await authApi.forgotPassword(forgotEmail);
      setView('forgot_sent');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to send reset email');
    } finally {
      setForgotLoading(false);
    }
  };

  const BrandPanel = () => (
    <div className="relative hidden lg:flex flex-col justify-between p-12 bg-[hsl(var(--sidebar))] overflow-hidden">
      <div className="absolute inset-0 gradient-brand-soft pointer-events-none" />
      <div className="relative z-10">
        <div className="flex items-center gap-2 font-display text-2xl font-semibold">
          <div className="h-9 w-9 rounded-md gradient-brand flex items-center justify-center text-white"><Sparkles className="h-5 w-5" /></div>
          Convee Education
        </div>
      </div>
      <div className="relative z-10 max-w-md">
        <h1 className="font-display text-4xl xl:text-5xl font-semibold tracking-tight leading-tight text-balance">Digital Campus Collaboration & Academic Portal.</h1>
        <p className="mt-4 text-base text-muted-foreground">Unified platform for school wings, classes, live sync, faculty channels, and student directory.</p>
        <ul className="mt-8 space-y-4">
          <li className="flex items-start gap-3"><Building2 className="h-5 w-5 mt-0.5 text-primary" /><span>School Wings & Class Section Management</span></li>
          <li className="flex items-start gap-3"><GraduationCap className="h-5 w-5 mt-0.5 text-emerald-500" /><span>Dedicated Student Directory & Secure Access</span></li>
          <li className="flex items-start gap-3"><UserCheck className="h-5 w-5 mt-0.5 text-blue-500" /><span>Faculty & Staff Hierarchy (Director, Principal, Dean, HOD, Teacher)</span></li>
          <li className="flex items-start gap-3"><ShieldCheck className="h-5 w-5 mt-0.5 text-primary" /><span>Role-based access policies and class assignment controls</span></li>
        </ul>
      </div>
      <div className="relative z-10 text-xs text-muted-foreground">Demo International Academy · Educational Portal</div>
    </div>
  );

  // Unverified email view
  if (view === 'unverified') {
    return (
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2 bg-background">
        <BrandPanel />
        <div className="flex items-center justify-center p-6 sm:p-10">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <CardTitle className="font-display text-xl">Verify your email</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">Check your inbox to continue</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-400">
                We sent a verification link to <strong className="text-amber-300">{unverifiedEmail}</strong>. Please check your inbox (and spam folder) and click the link to activate your account.
              </div>
              <Button className="w-full" onClick={resendVerification} disabled={resendLoading} variant="outline">
                <RefreshCw className={`h-4 w-4 mr-2 ${resendLoading ? 'animate-spin' : ''}`} />
                {resendLoading ? 'Sending…' : 'Resend verification email'}
              </Button>
              <button
                type="button"
                onClick={() => setView('login')}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-center"
              >
                <ArrowLeft className="h-4 w-4" /> Back to login
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Forgot password view
  if (view === 'forgot') {
    return (
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2 bg-background">
        <BrandPanel />
        <div className="flex items-center justify-center p-6 sm:p-10">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Reset password</CardTitle>
              <p className="text-sm text-muted-foreground">Enter your email and we'll send you a reset link.</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={sendForgotPassword} className="space-y-4">
                <div>
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    required
                    autoFocus
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="you@school.edu"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={forgotLoading}>
                  {forgotLoading ? 'Sending…' : 'Send reset link'}
                </Button>
              </form>
              <button
                type="button"
                onClick={() => setView('login')}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-center mt-4"
              >
                <ArrowLeft className="h-4 w-4" /> Back to login
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Forgot password sent view
  if (view === 'forgot_sent') {
    return (
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2 bg-background">
        <BrandPanel />
        <div className="flex items-center justify-center p-6 sm:p-10">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="font-display text-xl">Check your inbox</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">Reset link sent</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                If <strong className="text-foreground">{forgotEmail}</strong> is registered, you'll receive a password reset link within a few minutes.
              </p>
              <button
                type="button"
                onClick={() => setView('login')}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-center"
              >
                <ArrowLeft className="h-4 w-4" /> Back to login
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Main login view
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2 bg-background">
      <BrandPanel />
      <div className="flex items-center justify-center p-6 sm:p-10">
        <Card className="w-full max-w-md border-border shadow-md">
          <CardHeader className="pb-4">
            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-muted/40 rounded-lg border border-border mb-3">
              <button
                type="button"
                onClick={() => setPortalMode('faculty')}
                className={`py-2 px-2 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1 transition-all ${
                  portalMode === 'faculty'
                    ? 'bg-background text-foreground shadow-xs border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                data-testid="faculty-tab-btn"
              >
                <UserCheck className="h-3.5 w-3.5 text-blue-500" />
                <span>Faculty</span>
              </button>

              <button
                type="button"
                onClick={() => setPortalMode('student')}
                className={`py-2 px-2 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1 transition-all ${
                  portalMode === 'student'
                    ? 'bg-background text-foreground shadow-xs border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                data-testid="student-tab-btn"
              >
                <GraduationCap className="h-3.5 w-3.5 text-emerald-500" />
                <span>Student</span>
              </button>

              <button
                type="button"
                onClick={() => setPortalMode('parent')}
                className={`py-2 px-2 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1 transition-all ${
                  portalMode === 'parent'
                    ? 'bg-background text-foreground shadow-xs border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                data-testid="parent-tab-btn"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-purple-500" />
                <span>Parent</span>
              </button>
            </div>

            {portalMode === 'faculty' ? (
              <div>
                <CardTitle className="font-display text-2xl flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-blue-500" /> Faculty & Staff Sign In
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Sign in with your institutional credentials.</p>
              </div>
            ) : portalMode === 'student' ? (
              <div>
                <CardTitle className="font-display text-2xl flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-emerald-500" /> Student Portal Sign In
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Access your class channels, assignments, and campus updates.</p>
              </div>
            ) : (
              <div>
                <CardTitle className="font-display text-2xl flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-purple-500" /> Parent Portal Sign In
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">View your child's attendance rate, homework, and message teachers.</p>
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="username">
                  {portalMode === 'student' ? 'Student ID / Admission No' : portalMode === 'parent' ? 'Parent ID' : 'Work Email or Faculty / Staff ID'}
                </Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={
                    portalMode === 'student'
                      ? 'e.g. STU-2026-ALEX'
                      : portalMode === 'parent'
                      ? 'e.g. PAR-2026-ALEX'
                      : 'e.g. director@demo.edu or PRN-2026-3674'
                  }
                  data-testid="login-email-input"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button type="button" onClick={() => setShowPw((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground">{showPw ? 'Hide' : 'Show'}</button>
                </div>
                <Input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  data-testid="login-password-input"
                />
                <div className="mt-1 text-right">
                  <button type="button" onClick={() => { setForgotEmail(email); setView('forgot'); }} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                    Forgot password?
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full font-semibold" disabled={loading} data-testid="login-submit-button">
                {loading ? 'Signing in…' : portalMode === 'student' ? 'Sign in to Student Portal' : portalMode === 'parent' ? 'Sign in to Parent Portal' : 'Sign in to Faculty Portal'}
              </Button>
            </form>

            {portalMode === 'faculty' ? (
              <>
                <div className="my-4 flex items-center gap-3"><div className="h-px flex-1 bg-border" /><span className="text-xs text-muted-foreground">OR</span><div className="h-px flex-1 bg-border" /></div>
                <Button variant="outline" className="w-full" onClick={startGoogle} data-testid="login-google-button">
                  <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Continue with Google
                </Button>
                <div className="mt-4 text-center text-xs text-muted-foreground">
                  New institution? <Link to="/register" className="font-semibold text-primary hover:underline">Register your school/college</Link>
                </div>
              </>
            ) : portalMode === 'student' ? (
              /* Student Notice Box */
              <div className="mt-4 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-400 space-y-1">
                <div className="font-semibold flex items-center gap-1 text-emerald-300">
                  <Info className="h-3.5 w-3.5 shrink-0" /> Student Account Notice
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Student accounts are generated directly by the school administration. Self-registration is disabled for students. Please contact your class teacher or school administrator to receive your credentials.
                </p>
              </div>
            ) : (
              /* Parent Notice Box */
              <div className="mt-4 p-3 rounded-lg border border-purple-500/20 bg-purple-500/5 text-xs text-purple-400 space-y-1">
                <div className="font-semibold flex items-center gap-1 text-purple-300">
                  <UserCheck className="h-3.5 w-3.5 shrink-0" /> Parent Portal Access
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Parent accounts allow monitoring of student attendance records, graded homework rubrics, and direct messaging with class teachers.
                </p>
              </div>
            )}


          </CardContent>
        </Card>
      </div>
    </div>
  );
}
