import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { userApi, fileApi, API_BASE } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Upload, Trash2, Loader2, Key, ShieldCheck, Lock } from 'lucide-react';

function initials(n) { return (n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase(); }

export default function ProfilePage() {
  const { user, currentOrg, refresh } = useAuth();
  const [form, setForm] = useState({ fullName: '', bio: '', avatarUrl: '' });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Email linking & OTP verification state
  const isInternalIdEmail = Boolean(user?.email && (user.email.startsWith('STU-') || user.email.startsWith('PAR-') || !user.email.includes('@')));
  const [emailInput, setEmailInput] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);

  // Password state
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passSaving, setPassSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        fullName: user.fullName || '',
        bio: user.bio || '',
        avatarUrl: user.avatarUrl || '',
      });
      setEmailInput(isInternalIdEmail ? '' : user.email || '');
      setOtpSent(false);
      setOtpCode('');
      setIsEditingEmail(false);
    }
  }, [user, isInternalIdEmail]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fileApi.upload(formData);
      const fullUrl = res.url?.startsWith('http') ? res.url : `${API_BASE.replace('/api/v1', '')}${res.url}`;
      setForm((prev) => ({ ...prev, avatarUrl: fullUrl }));
      toast.success('Image uploaded successfully');
    } catch (err) {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAvatar = () => {
    setForm((prev) => ({ ...prev, avatarUrl: '' }));
  };

  const save = async () => {
    try {
      await userApi.updateMe(form);
      toast.success('Profile saved');
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to save profile');
    }
  };

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error('Please enter an email address');
      return;
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(cleanEmail)) {
      toast.error('Please enter a valid email format (e.g. name@example.com)');
      return;
    }

    setSendingOtp(true);
    try {
      const res = await userApi.sendEmailVerification(cleanEmail);
      setOtpSent(true);
      if (res.devOtp) {
        setOtpCode(res.devOtp);
      }
      toast.success(res?.message || 'Verification code sent to your email address!');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to send verification code');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    const cleanCode = otpCode.trim();

    if (!cleanCode || cleanCode.length < 6) {
      toast.error('Please enter the 6-digit verification code');
      return;
    }

    setVerifyingOtp(true);
    try {
      const res = await userApi.verifyEmailCode(cleanEmail, cleanCode);
      toast.success(res?.message || 'Email verified and successfully linked to your account!');
      setOtpSent(false);
      setOtpCode('');
      setIsEditingEmail(false);
      await refresh();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Invalid or expired verification code');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passForm.newPassword !== passForm.confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    if (passForm.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }

    setPassSaving(true);
    try {
      const res = await userApi.setPassword({
        currentPassword: passForm.currentPassword,
        newPassword: passForm.newPassword,
      });
      toast.success(res?.message || 'Password updated successfully!');
      setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      await refresh();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to update password');
    } finally {
      setPassSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Profile & Account</h1>
        <p className="text-muted-foreground">Manage your credentials, login email, password, and personal details</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-4 border-b border-border">
            <Avatar className="h-20 w-20 border border-border">
              <AvatarImage src={form.avatarUrl} alt={form.fullName} />
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-medium">
                {initials(form.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1.5 flex-1">
              <div className="font-semibold text-lg flex items-center flex-wrap gap-2">
                <span>{form.fullName || user?.email}</span>
                {(currentOrg?.userUniqueId || currentOrg?.directorId || user?.directorId || (user?.memberships?.find((m) => m.orgId === currentOrg?.id)?.title?.match(/\[(.*?)\]/)?.[1])) && (
                  <Badge variant="default" className="font-mono text-xs bg-primary text-primary-foreground px-2 py-0.5">
                    ID: {currentOrg?.userUniqueId || currentOrg?.directorId || user?.directorId || (user?.memberships?.find((m) => m.orgId === currentOrg?.id)?.title?.match(/\[(.*?)\]/)?.[1])}
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                {isInternalIdEmail ? (
                  <span className="text-amber-400 font-medium">ID Login: {user?.email} (No email linked)</span>
                ) : (
                  <span className="text-foreground font-medium flex items-center gap-1.5">
                    {user?.email}
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                      ✓ Verified Email
                    </Badge>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2 text-xs"
                >
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {uploading ? 'Uploading…' : 'Upload photo'}
                </Button>
                {form.avatarUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeAvatar}
                    className="gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                rows={3}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="About you"
              />
            </div>
          </div>

          <Button onClick={save} data-testid="profile-save-btn">
            Save profile changes
          </Button>
        </CardContent>
      </Card>

      {/* Email & OTP Verification Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Login Email & Inbox Verification</CardTitle>
              <CardDescription className="text-xs">
                {isInternalIdEmail
                  ? 'Verify and link your real email address with a 6-digit verification code to enable email login and notifications.'
                  : 'Your active verified email for notifications, announcements, and portal sign in.'}
              </CardDescription>
            </div>
            {!isInternalIdEmail && !isEditingEmail && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => setIsEditingEmail(true)}
              >
                Change Email
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isInternalIdEmail || isEditingEmail ? (
            <div className="space-y-4">
              {isInternalIdEmail && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
                  ⚠️ <strong>No real email is currently linked to your account.</strong> You are logging in via your ID (<code>{user?.email}</code>). Verify your email below to ensure you never lose access.
                </div>
              )}

              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="emailInput">Real Email Address</Label>
                    <Input
                      id="emailInput"
                      type="email"
                      required
                      placeholder="e.g. yourname@gmail.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      A 6-digit confirmation code will be sent to this email to verify that the mailbox exists.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="submit" disabled={sendingOtp || !emailInput.trim()} className="gap-2">
                      {sendingOtp && <Loader2 className="h-4 w-4 animate-spin" />}
                      {sendingOtp ? 'Sending Verification Code…' : 'Send 6-Digit Verification Code'}
                    </Button>
                    {isEditingEmail && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setIsEditingEmail(false);
                          setEmailInput(user?.email || '');
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4 p-4 rounded-xl border border-primary/30 bg-primary/5">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-foreground">
                      Enter 6-Digit Code Sent to <span className="font-mono text-primary font-bold">{emailInput}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Please check your inbox (and spam folder) for the verification code.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="otpCode" className="text-xs font-semibold">6-Digit Verification Code</Label>
                    <Input
                      id="otpCode"
                      type="text"
                      maxLength={6}
                      required
                      placeholder="e.g. 849201"
                      className="font-mono text-center tracking-widest text-lg font-bold max-w-[200px]"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button type="submit" disabled={verifyingOtp || otpCode.length < 6} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                      {verifyingOtp && <Loader2 className="h-4 w-4 animate-spin" />}
                      {verifyingOtp ? 'Verifying Code…' : '✓ Confirm & Link Email'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setOtpSent(false)}
                      className="text-xs text-muted-foreground"
                    >
                      Change Email / Resend
                    </Button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <div className="space-y-0.5">
                <div className="text-xs font-medium text-emerald-400">Active Verified Email</div>
                <div className="text-sm font-semibold text-foreground font-mono">{user?.email}</div>
              </div>
              <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
                ✓ Verified
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security & Password Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Security & Password</CardTitle>
              <CardDescription className="text-xs">
                {user?.hasPassword
                  ? 'Update your account password. You can log in using your password alongside your Email or Director ID.'
                  : 'You logged in with Google OAuth. Set a password below if you would also like to sign in using your Director ID / Email and password.'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {user?.hasPassword && (
              <div>
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  required
                  value={passForm.currentPassword}
                  onChange={(e) => setPassForm({ ...passForm, currentPassword: e.target.value })}
                  placeholder="Enter current password"
                />
              </div>
            )}
            <div>
              <Label htmlFor="newPassword">{user?.hasPassword ? 'New Password' : 'Create Password'}</Label>
              <Input
                id="newPassword"
                type="password"
                required
                minLength={6}
                value={passForm.newPassword}
                onChange={(e) => setPassForm({ ...passForm, newPassword: e.target.value })}
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                required
                minLength={6}
                value={passForm.confirmPassword}
                onChange={(e) => setPassForm({ ...passForm, confirmPassword: e.target.value })}
                placeholder="Re-enter new password"
              />
            </div>

            <Button type="submit" disabled={passSaving} className="gap-2">
              {passSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              {passSaving ? 'Saving…' : user?.hasPassword ? 'Update Password' : 'Set Account Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}

