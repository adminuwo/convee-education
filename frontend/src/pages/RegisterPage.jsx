import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Sparkles, Mail } from 'lucide-react';
import { authApi } from '@/lib/api';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', fullName: '', orgName: '' });
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const [resendLoading, setResendLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await register(form);
      if (r.emailSent) {
        setSentTo(form.email);
        setEmailSent(true);
      } else {
        toast.success('Welcome aboard!');
        navigate('/app/home', { replace: true });
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Registration failed');
    } finally { setLoading(false); }
  };

  const resend = async () => {
    setResendLoading(true);
    try {
      const res = await authApi.resendVerification(sentTo);
      toast.success(res?.message || 'Verification email resent!');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to resend email');
    } finally { setResendLoading(false); }
  };

  const BrandPanel = () => (
    <div className="relative hidden lg:flex flex-col justify-between p-12 bg-[hsl(var(--sidebar))] overflow-hidden">
      <div className="absolute inset-0 gradient-brand-soft pointer-events-none" />
      <div className="relative z-10 font-display text-2xl font-semibold flex items-center gap-2">
        <div className="h-9 w-9 rounded-md gradient-brand flex items-center justify-center text-white"><Sparkles className="h-5 w-5" /></div>
        Convee
      </div>
      <div className="relative z-10 max-w-md">
        <h1 className="font-display text-4xl xl:text-5xl font-semibold tracking-tight leading-tight text-balance">Start collaborating in minutes.</h1>
        <p className="mt-4 text-base text-muted-foreground">Create your workspace, invite your team, and let AI take the load off the busywork.</p>
      </div>
      <div className="relative z-10 text-xs text-muted-foreground">Free trial · No credit card required</div>
    </div>
  );

  if (emailSent) {
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
                  <p className="text-sm text-muted-foreground mt-0.5">One last step</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
                We sent a verification link to <strong className="text-primary">{sentTo}</strong>. Click the link to activate your account.
              </div>
              <p className="text-xs text-muted-foreground">Didn't receive it? Check your spam folder or resend below.</p>
              <Button className="w-full" onClick={resend} disabled={resendLoading} variant="outline">
                {resendLoading ? 'Sending…' : 'Resend verification email'}
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                Already verified? <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const startGoogle = async () => {
    try {
      const { url } = await authApi.googleStart('register');
      window.location.href = url;
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Google OAuth not configured');
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2 bg-background">
      <BrandPanel />
      <div className="flex items-center justify-center p-6 sm:p-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Create your account</CardTitle>
            <p className="text-sm text-muted-foreground">You'll be the owner of your new workspace.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Jane Doe" data-testid="register-name-input" />
              </div>
              <div>
                <Label htmlFor="orgName">Organization name (optional)</Label>
                <Input id="orgName" value={form.orgName} onChange={(e) => setForm({ ...form, orgName: e.target.value })} placeholder="Acme Inc." data-testid="register-org-input" />
              </div>
              <div>
                <Label htmlFor="email">Work email</Label>
                <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@company.com" data-testid="register-email-input" />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 6 characters" data-testid="register-password-input" />
              </div>
              <Button type="submit" className="w-full" disabled={loading} data-testid="register-submit-button">{loading ? 'Creating…' : 'Create account'}</Button>
            </form>
            <div className="my-5 flex items-center gap-3"><div className="h-px flex-1 bg-border" /><span className="text-xs text-muted-foreground">OR</span><div className="h-px flex-1 bg-border" /></div>
            <Button variant="outline" className="w-full" onClick={startGoogle} data-testid="register-google-button">
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </Button>
            <div className="mt-6 text-center text-sm text-muted-foreground">Already have an account? <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

