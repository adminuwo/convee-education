import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { userApi, fileApi, API_BASE } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Upload, Trash2, Loader2 } from 'lucide-react';

function initials(n) { return (n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase(); }

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({ fullName: '', bio: '', avatarUrl: '' });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

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

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Profile</h1>
        <p className="text-muted-foreground">Update your personal info</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-4 border-b border-border">
            <Avatar className="h-20 w-20 border border-border">
              <AvatarImage src={form.avatarUrl} alt={form.fullName} />
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-medium">
                {initials(form.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <div className="font-semibold text-lg">{form.fullName || user?.email}</div>
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
            Save changes
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

