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
    }
  }, [user]);

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
        <p className="text-muted-foreground">Manage your credentials, director ID, and personal information</p>
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
                    User / Faculty ID: {currentOrg?.userUniqueId || currentOrg?.directorId || user?.directorId || (user?.memberships?.find((m) => m.orgId === currentOrg?.id)?.title?.match(/\[(.*?)\]/)?.[1])}
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground">{user?.email}</div>
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

