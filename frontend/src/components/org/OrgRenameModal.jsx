import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { orgApi } from '@/lib/api';
import { toast } from 'sonner';
import { Building2, Sparkles, UploadCloud, Image as ImageIcon, Trash2, ShieldCheck, ShieldAlert, Check } from 'lucide-react';

export default function OrgRenameModal({ open, onOpenChange, isFirstTimeSetup = false }) {
  const { currentOrg, refresh } = useAuth();
  const [name, setName] = useState('');
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const isDirector = currentOrg?.role === 'DIRECTOR' || currentOrg?.role === 'OWNER';

  useEffect(() => {
    if (currentOrg?.name) {
      if (isFirstTimeSetup && (currentOrg.name.includes("'s Workspace") || currentOrg.name.includes("'s Organization"))) {
        setName('');
      } else {
        setName(currentOrg.name);
      }
    }
    setLogoPreview(currentOrg?.logoUrl || null);
    setLogoFile(null);
  }, [currentOrg?.name, currentOrg?.logoUrl, open, isFirstTimeSetup]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, WebP, SVG)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Logo image size must be under 10MB');
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setLogoPreview(event.target?.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    if (logoFile) {
      setLogoFile(null);
      setLogoPreview(currentOrg?.logoUrl || null);
      return;
    }

    if (!currentOrg?.id) return;
    setSaving(true);
    try {
      await orgApi.removeLogo(currentOrg.id);
      setLogoPreview(null);
      setLogoFile(null);
      toast.success('Institution logo removed');
      await refresh();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to remove logo');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!isDirector) {
      toast.error('Only the Institution Director can change institution branding');
      return;
    }

    if (!name.trim()) {
      toast.error('Please enter a valid institution name');
      return;
    }
    if (!currentOrg?.id) return;

    setSaving(true);
    try {
      // 1. Upload logo file if selected
      if (logoFile) {
        const formData = new FormData();
        formData.append('logo', logoFile);
        await orgApi.uploadLogo(currentOrg.id, formData);
      }

      // 2. Update institution name if changed
      if (name.trim() !== currentOrg.name) {
        await orgApi.update(currentOrg.id, { name: name.trim() });
      }

      toast.success('Institution profile & branding updated successfully!');
      await refresh();
      onOpenChange(false);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to update institution settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="h-9 w-9 rounded-lg gradient-brand flex items-center justify-center text-white">
              {isFirstTimeSetup ? <Sparkles className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
            </div>
            <div>
              <DialogTitle className="font-display text-xl">
                {isFirstTimeSetup ? 'Setup Institution Branding' : 'Institution Branding & Settings'}
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {isFirstTimeSetup
              ? 'Customize your institution name and upload the official school crest/logo displayed across report cards, portals, and badges.'
              : 'Manage the official institution name and visual logo crest displayed to all faculty, students, and parents.'}
          </DialogDescription>
        </DialogHeader>

        {/* Director Governance Notice */}
        {isDirector ? (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs space-y-1 my-1">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Director Governance Active</span>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Only you as the Director / Owner have authorization to update the official institution name and logo crest.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs space-y-1 my-1">
            <div className="flex items-center gap-1.5 font-medium text-destructive">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              <span>Director Permission Required</span>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              You are currently logged in with the <strong>{currentOrg?.role}</strong> role. Only the Director can edit institution branding.
            </p>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 py-1">
          {/* Logo Crest Uploader */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">Institution Logo / Crest</Label>
            <div className="flex items-center gap-3.5 p-3 rounded-lg border border-border bg-card/60">
              <div className="relative h-16 w-16 rounded-xl border border-border/80 bg-muted/60 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                {logoPreview ? (
                  <img src={logoPreview} alt="Institution Logo" className="h-full w-full object-cover" />
                ) : (
                  <Building2 className="h-7 w-7 text-muted-foreground/60" />
                )}
              </div>

              <div className="flex-1 space-y-1.5 min-w-0">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png, image/jpeg, image/webp, image/svg+xml"
                  className="hidden"
                  disabled={saving || !isDirector}
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving || !isDirector}
                    className="h-8 text-xs gap-1.5"
                  >
                    <UploadCloud className="h-3.5 w-3.5" />
                    {logoPreview ? 'Change Image' : 'Upload Image'}
                  </Button>
                  {logoPreview && isDirector && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleRemoveLogo}
                      disabled={saving}
                      className="h-8 text-xs text-destructive hover:bg-destructive/10 gap-1 px-2"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  PNG, JPG, WebP or SVG up to 10MB
                </p>
              </div>
            </div>
          </div>

          {/* Institution Name */}
          <div className="space-y-1.5">
            <Label htmlFor="org-name-input" className="text-xs font-semibold text-foreground">Institution Name</Label>
            <Input
              id="org-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Demo International Academy"
              disabled={saving || !isDirector}
              required
            />
          </div>

          <DialogFooter className="pt-2">
            {!isFirstTimeSetup && (
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={saving || !name.trim() || !isDirector}
              className="w-full sm:w-auto gap-1.5"
            >
              {saving ? 'Saving…' : <><Check className="h-4 w-4" /> Save Branding</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
