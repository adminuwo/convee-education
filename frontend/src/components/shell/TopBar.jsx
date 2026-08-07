import React, { useEffect, useState } from 'react';
import { Menu, Search, Bell, Plus, UserPlus, Check, X, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { notifApi, orgApi } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '@/lib/socket';
import { toast } from 'sonner';

export function TopBar({ onMenuClick, onSearchClick }) {
  const [notifs, setNotifs] = useState({ notifications: [], unreadCount: 0 });
  const [inviteModal, setInviteModal] = useState(null);
  const [transferModal, setTransferModal] = useState(null);
  const [responding, setResponding] = useState(false);
  const [respondingTransfer, setRespondingTransfer] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    try { setNotifs(await notifApi.list()); } catch { }
  };

  useEffect(() => {
    load();
    const s = getSocket();
    if (s) s.on('notification:new', () => load());
    const t = setInterval(load, 30000);
    return () => { clearInterval(t); if (s) s.off('notification:new'); };
  }, []);

  const markAll = async () => { await notifApi.markAllRead(); load(); };

  const handleNotifClick = async (n) => {
    if (!n.isRead) {
      try {
        await notifApi.markRead(n.id);
        setNotifs((prev) => ({
          ...prev,
          unreadCount: Math.max(0, prev.unreadCount - 1),
          notifications: prev.notifications.map((item) => (item.id === n.id ? { ...item, isRead: true } : item)),
        }));
      } catch { }
    }

    const titleLower = (n.title || '').toLowerCase();
    const bodyLower = (n.body || '').toLowerCase();
    const isCancelled = n.metadata?.action === 'MEETING_CANCELLED' || titleLower.includes('cancel') || bodyLower.includes('cancel');

    // For cancelled meetings or past meeting notifications: show popup right here, don't redirect
    if (isCancelled) {
      toast.info(n.title || 'Meeting Cancelled', {
        description: n.body || 'This meeting was cancelled by the organizer.',
        duration: 5000,
      });
      return;
    }

    // Ownership transfer request -> open Accept/Reject popup
    const dataMeta = n.metadata || n.data || {};
    if (dataMeta.actionType === 'OWNERSHIP_TRANSFER_REQUEST' || titleLower.includes('ownership transfer request')) {
      setTransferModal({
        notifId: n.id,
        orgId: dataMeta.orgId || n.orgId,
        orgName: dataMeta.orgName || 'Workspace',
        senderName: dataMeta.senderName || 'Director',
        senderEmail: dataMeta.senderEmail || '',
        body: n.body,
      });
      return;
    }

    // Organization invitation -> open Accept/Decline popup
    if (n.metadata?.action === 'ORG_INVITATION' || n.metadata?.inviteId || titleLower.includes('invitation to join')) {
      setInviteModal({
        inviteId: n.metadata?.inviteId,
        orgName: n.metadata?.orgName || 'Organization',
        role: n.metadata?.role || 'EMPLOYEE',
        inviterName: n.metadata?.inviterName || 'An admin',
        body: n.body,
        notifId: n.id,
      });
      return;
    }

    let target = n.linkUrl;
    if (!target) {
      const meta = n.metadata || {};
      const notifType = n.type || '';
      const text = titleLower + ' ' + bodyLower;

      if (meta.taskId || notifType.includes('TASK') || text.includes('task')) {
        target = meta.taskId ? `/app/tasks?taskId=${meta.taskId}` : '/app/tasks';
      } else if (meta.meetingId || notifType.includes('MEETING') || text.includes('meeting')) {
        target = meta.meetingId ? `/app/meetings?meetingId=${meta.meetingId}` : '/app/meetings';
      } else if (meta.channelId || notifType === 'MENTION' || text.includes('#') || text.includes('tagged') || text.includes('channel')) {
        target = meta.channelId ? `/app/channels/${meta.channelId}` : '/app/home';
      } else if (notifType === 'APPROVAL_REQUEST') {
        target = '/app/admin';
      } else if (notifType === 'AI_SUMMARY_READY') {
        target = '/app/ai';
      } else {
        target = '/app/home';
      }
    }

    navigate(target);
  };

  const handleRespondInvite = async (action) => {
    if (!inviteModal?.inviteId) return;
    setResponding(true);
    try {
      const res = await orgApi.respondInvite(inviteModal.inviteId, action);
      if (action === 'ACCEPT') {
        toast.success(res.message || `Joined ${inviteModal.orgName}!`);
        setInviteModal(null);
        setTimeout(() => { window.location.href = '/app/home'; }, 800);
      } else {
        toast.info(res.message || 'Invitation declined.');
        setInviteModal(null);
        load();
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to respond to invitation');
    } finally {
      setResponding(false);
    }
  };

  const handleRespondTransfer = async (action) => {
    if (!transferModal?.notifId || !transferModal?.orgId) return;
    setRespondingTransfer(true);
    try {
      const res = await orgApi.transferRespond(transferModal.orgId, {
        notificationId: transferModal.notifId,
        action,
      });
      if (action === 'ACCEPT') {
        toast.success(res.message || 'Ownership transferred! You are now the Director.');
        setTransferModal(null);
        setTimeout(() => { window.location.href = '/app/admin'; }, 800);
      } else {
        toast.info(res.message || 'Transfer request rejected.');
        setTransferModal(null);
        load();
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to process ownership transfer request');
    } finally {
      setRespondingTransfer(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 flex-shrink-0 items-center gap-2 border-b border-border bg-background/95 backdrop-blur px-3 sm:px-5">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick} data-testid="mobile-menu-btn"><Menu className="h-5 w-5" /></Button>

      <button
        onClick={onSearchClick}
        className="flex-1 max-w-2xl flex items-center gap-2 h-9 rounded-md border border-border bg-secondary/50 hover:bg-secondary px-3 text-sm text-muted-foreground transition-colors"
        data-testid="global-search-trigger"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search anything…</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">Ctrl K</kbd>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" data-testid="notifications-bell">
            <Bell className="h-4 w-4" />
            {notifs.unreadCount > 0 && (
              <Badge variant="destructive" className="absolute -right-0.5 -top-0.5 h-4 min-w-4 rounded-full p-0 text-[10px] flex items-center justify-center">
                {notifs.unreadCount > 9 ? '9+' : notifs.unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <div className="flex items-center justify-between px-2 py-1">
            <DropdownMenuLabel className="px-0">Notifications</DropdownMenuLabel>
            {notifs.unreadCount > 0 && <Button variant="link" size="sm" onClick={markAll} className="h-auto p-0 text-xs">Mark all read</Button>}
          </div>
          <DropdownMenuSeparator />
          <div className="max-h-80 overflow-auto">
            {notifs.notifications.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications</div>
            )}
            {notifs.notifications.slice(0, 20).map((n) => (
              <DropdownMenuItem
                key={n.id}
                onClick={() => handleNotifClick(n)}
                className={`flex-col items-start gap-0.5 whitespace-normal cursor-pointer ${!n.isRead ? 'bg-primary/5 font-medium' : ''}`}
                data-testid={`notification-item-${n.id}`}
              >
                <div className="font-medium text-sm flex items-center justify-between w-full">
                  <span>{n.title}</span>
                  {!n.isRead && <span className="h-2 w-2 rounded-full bg-primary shrink-0 ml-2" />}
                </div>
                <div className="text-xs text-muted-foreground">{n.body}</div>
              </DropdownMenuItem>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Invitation Accept/Decline Dialog */}
      <Dialog open={!!inviteModal} onOpenChange={(open) => !open && setInviteModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <UserPlus className="h-5 w-5 text-primary" /> Organization Invitation
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm text-foreground/90">
              {inviteModal?.body || `You have been invited to join ${inviteModal?.orgName} as a ${inviteModal?.role}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-border bg-secondary/30 p-3 my-2 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Organization:</span>
              <span className="font-medium">{inviteModal?.orgName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Role:</span>
              <Badge variant="outline" className="text-[10px] uppercase font-semibold">{inviteModal?.role}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invited by:</span>
              <span className="font-medium">{inviteModal?.inviterName}</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              disabled={responding}
              onClick={() => handleRespondInvite('DECLINE')}
              className="w-full sm:w-auto"
            >
              <X className="h-4 w-4 mr-1 text-destructive" /> Decline
            </Button>
            <Button
              disabled={responding}
              onClick={() => handleRespondInvite('ACCEPT')}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            >
              <Check className="h-4 w-4 mr-1" /> Accept Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ownership Transfer Request Accept/Reject Dialog */}
      <Dialog open={!!transferModal} onOpenChange={(open) => !open && setTransferModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-amber-500">
              <Crown className="h-5 w-5" /> Workspace Ownership Transfer Request
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm text-foreground/90">
              {transferModal?.body || `${transferModal?.senderName || 'Director'} has requested to transfer workspace ownership of ${transferModal?.orgName || 'this workspace'} to you.`}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 my-2 space-y-1.5 text-xs text-amber-600">
            <div className="font-semibold">Important Authorization Notice</div>
            <div>
              Accepting this request will immediately assign you as the <strong>DIRECTOR</strong> of <strong>{transferModal?.orgName}</strong>.
              The current director ({transferModal?.senderEmail}) will be shifted to the <strong>ADMIN</strong> role.
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => handleRespondTransfer('REJECT')}
              disabled={respondingTransfer}
              className="flex items-center gap-1 text-destructive hover:bg-destructive/10"
            >
              <X className="h-4 w-4" /> Reject Request
            </Button>
            <Button
              onClick={() => handleRespondTransfer('ACCEPT')}
              disabled={respondingTransfer}
              className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1 font-semibold"
            >
              <Check className="h-4 w-4" /> Accept & Become Director
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
