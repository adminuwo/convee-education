import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { orgApi } from '@/lib/api';
import { toast } from 'sonner';
import { Scale, Send, Building2, Mail, Loader2, CheckCircle2 } from 'lucide-react';

export default function AiLegalFeatureRequestModal({ open, onOpenChange, currentOrg, user }) {
  const [feature, setFeature] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const clean = feature.trim();
    if (!clean || clean.length < 3) {
      toast.error('Please describe the feature you would like to request (at least 3 characters).');
      return;
    }

    if (!currentOrg?.id) {
      toast.error('Organization context is missing.');
      return;
    }

    setLoading(true);
    try {
      const res = await orgApi.requestAiLegalFeature(currentOrg.id, clean);
      toast.success(res?.message || 'Feature request submitted to AI-Legal team!');
      setSubmitted(true);
      setTimeout(() => {
        setFeature('');
        setSubmitted(false);
        onOpenChange(false);
      }, 1500);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to submit feature request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (val) => {
    if (!loading) {
      if (!val) {
        setFeature('');
        setSubmitted(false);
      }
      onOpenChange(val);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="h-9 w-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                Request AI-Legal™ Feature Add-on
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Submit feature ideas or specialized legal tool requests directly to the AI-Legal engineering team.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {submitted ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Request Submitted Successfully!</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Your request has been registered in the AI-Legal organization directory for review.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* Read-only Context Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-muted/40 border border-border">
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
                  <Building2 className="h-3.5 w-3.5 text-primary" /> Organization
                </Label>
                <div className="text-xs font-semibold text-foreground truncate" title={currentOrg?.name || 'Your Organization'}>
                  {currentOrg?.name || 'Your Organization'}
                </div>
              </div>

              <div>
                <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
                  <Mail className="h-3.5 w-3.5 text-blue-500" /> Requester Email
                </Label>
                <div className="text-xs font-semibold text-foreground truncate" title={user?.email || 'Your Email'}>
                  {user?.email || 'Your Email'}
                </div>
              </div>
            </div>

            {/* Feature Description Field */}
            <div className="space-y-1.5">
              <Label htmlFor="feature-text" className="text-xs font-medium flex items-center justify-between">
                <span>Requested Feature Details</span>
                <span className="text-[10px] text-muted-foreground">Write any feature you want</span>
              </Label>
              <textarea
                id="feature-text"
                rows={5}
                required
                disabled={loading}
                value={feature}
                onChange={(e) => setFeature(e.target.value)}
                placeholder="Describe the feature you want added in AI-Legal (e.g., custom court precedent analysis, specialized contract verification for institutional grants, local case law search, etc.)..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
              />
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleClose(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={loading || !feature.trim()}
                className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Submit Feature Request</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
