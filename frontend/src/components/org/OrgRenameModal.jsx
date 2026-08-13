import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { orgApi } from '@/lib/api';
import { toast } from 'sonner';
import { Building2, Sparkles } from 'lucide-react';

export default function OrgRenameModal({ open, onOpenChange, isFirstTimeSetup = false }) {
  const { currentOrg, refresh } = useAuth();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentOrg?.name) {
      if (isFirstTimeSetup && (currentOrg.name.includes("'s Workspace") || currentOrg.name.includes("'s Organization"))) {
        setName('');
      } else {
        setName(currentOrg.name);
      }
    }
  }, [currentOrg?.name, open, isFirstTimeSetup]);

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter a valid institution name');
      return;
    }
    if (!currentOrg?.id) return;

    setSaving(true);
    try {
      await orgApi.update(currentOrg.id, { name: name.trim() });
      toast.success('Institution name updated successfully!');
      await refresh();
      onOpenChange(false);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to update institution name');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-9 w-9 rounded-lg gradient-brand flex items-center justify-center text-white">
              {isFirstTimeSetup ? <Sparkles className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
            </div>
            <DialogTitle className="font-display text-xl">
              {isFirstTimeSetup ? 'Name Your Institution' : 'Rename Institution'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            {isFirstTimeSetup
              ? 'Welcome to Convee! Enter your school, college, or organization name to complete your workspace setup.'
              : 'Update the official name of your institution displayed across reports, timetable, and portals.'}
          </DialogDescription>
        </DialogHeader>

        {currentOrg?.role === 'DIRECTOR' && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs space-y-1 my-1">
            <div className="flex items-center justify-between font-medium text-foreground">
              <span>Your Unique Director ID:</span>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary text-primary-foreground">
                {currentOrg.directorId || 'DIR-2026-1001'}
              </span>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              You can use this Unique Director ID or your email address to sign into Convee anytime.
            </p>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="org-name-input">Institution Name</Label>
            <Input
              id="org-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Demo International Academy"
              autoFocus
              required
            />
          </div>

          <DialogFooter className="pt-2">
            {!isFirstTimeSetup && (
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={saving || !name.trim()} className="w-full sm:w-auto">
              {saving ? 'Saving…' : 'Save Institution Name'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
