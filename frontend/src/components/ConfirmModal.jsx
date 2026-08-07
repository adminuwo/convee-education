import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmModal({
  open,
  onOpenChange,
  onClose,
  title = 'Are you sure?',
  description = 'This action cannot be undone.',
  confirmText = 'Delete',
  cancelText = 'Cancel',
  variant = 'destructive',
  onConfirm,
  loading = false,
}) {
  const handleToggle = (val) => {
    if (onOpenChange) onOpenChange(val);
    if (!val && onClose) onClose();
  };

  const handleConfirm = async () => {
    if (onConfirm) {
      await onConfirm();
    }
    handleToggle(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleToggle}>
      <DialogContent className="sm:max-w-[425px] border border-border bg-card text-card-foreground shadow-2xl rounded-xl">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
              variant === 'destructive' ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary'
            }`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground pt-1 leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 flex gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleToggle(false)}
            disabled={loading}
            className="rounded-lg"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={variant}
            onClick={handleConfirm}
            disabled={loading}
            className="rounded-lg font-medium"
          >
            {loading ? 'Processing...' : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
