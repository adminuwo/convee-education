import React, { useEffect, useState } from 'react';
import {
  Menu,
  Search,
  Bell,
  UserPlus,
  Check,
  X,
  Crown,
  Sun,
  Moon,
  User,
  LogOut,
  ShieldCheck,
  Sparkles,
  Building2,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { notifApi, orgApi } from '@/lib/api';
import { useNavigate, useLocation } from 'react-router-dom';
import { getSocket } from '@/lib/socket';
import { toast } from 'sonner';

function initials(name) {
  return (name || '?')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function TopBar({ onMenuClick, onSearchClick }) {
  const [notifs, setNotifs] = useState({ notifications: [], unreadCount: 0 });
  const [inviteModal, setInviteModal] = useState(null);
  const [transferModal, setTransferModal] = useState(null);
  const [responding, setResponding] = useState(false);
  const [respondingTransfer, setRespondingTransfer] = useState(false);

  const { user, currentOrg, memberships, switchOrg, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const load = async () => {
    try {
      setNotifs(await notifApi.list());
    } catch {}
  };

  useEffect(() => {
    load();
    const s = getSocket();
    if (s) s.on('notification:new', () => load());
    const t = setInterval(load, 30000);
    return () => {
      clearInterval(t);
      if (s) s.off('notification:new');
    };
  }, []);

  const markAll = async () => {
    await notifApi.markAllRead();
    load();
  };

  const handleNotifClick = async (n) => {
    if (!n.isRead) {
      try {
        await notifApi.markRead(n.id);
        setNotifs((prev) => ({
          ...prev,
          unreadCount: Math.max(0, prev.unreadCount - 1),
          notifications: prev.notifications.map((item) => (item.id === n.id ? { ...item, isRead: true } : item)),
        }));
      } catch {}
    }

    const titleLower = (n.title || '').toLowerCase();
    const bodyLower = (n.body || '').toLowerCase();
    const isCancelled =
      n.metadata?.action === 'MEETING_CANCELLED' || titleLower.includes('cancel') || bodyLower.includes('cancel');

    if (isCancelled) {
      toast.info(n.title || 'Meeting Cancelled', {
        description: n.body || 'This meeting was cancelled by the organizer.',
        duration: 5000,
      });
      return;
    }

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
      } else if (
        meta.channelId ||
        notifType === 'MENTION' ||
        text.includes('#') ||
        text.includes('tagged') ||
        text.includes('channel')
      ) {
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
        setTimeout(() => {
          window.location.href = '/app/home';
        }, 800);
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
        setTimeout(() => {
          window.location.href = '/app/admin';
        }, 800);
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

  const isOwner = currentOrg?.role === 'DIRECTOR';

  return (
    <header className="sticky top-0 z-30 flex h-14 flex-shrink-0 items-center justify-between gap-3 border-b border-border bg-background/80 backdrop-blur-md px-3 sm:px-5 transition-colors shadow-2xs">
      {/* Left: Mobile Menu & Mobile Workspace Branding */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="md:hidden text-foreground" onClick={onMenuClick} data-testid="mobile-menu-btn">
          <Menu className="h-5 w-5" />
        </Button>

        {currentOrg && (
          <div className="flex md:hidden items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs border border-primary/20">
              {currentOrg.name?.charAt(0) || 'C'}
            </div>
            <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">
              {currentOrg.name}
            </span>
          </div>
        )}
      </div>

      {/* Center: Search Trigger Bar */}
      <button
        onClick={onSearchClick}
        className="flex-1 max-w-xl flex items-center gap-2 h-9 rounded-xl border border-border/80 bg-muted/30 hover:bg-muted/60 px-3 text-xs sm:text-sm text-muted-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-testid="global-search-trigger"
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-left truncate">Search anything...</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground shadow-2xs">
          Ctrl K
        </kbd>
      </button>

      {/* Right: Actions, AI Shortcut, Theme Toggle, Notifications, Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Quick AI Companion Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/app/ai')}
          className="hidden md:flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 h-8 rounded-lg px-2.5 transition-colors"
          title="AI Assistant"
        >
          <Sparkles className="h-3.5 w-3.5 text-purple-500" />
          <span>AI Assistant</span>
        </Button>

        {/* Dark/Light Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          data-testid="theme-toggle-btn"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
        </Button>

        {/* Notifications Bell Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              data-testid="notifications-bell"
            >
              <Bell className="h-4 w-4" />
              {notifs.unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -right-0.5 -top-0.5 h-4 min-w-4 rounded-full p-0 text-[10px] flex items-center justify-center font-bold"
                >
                  {notifs.unreadCount > 9 ? '9+' : notifs.unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 shadow-xl border-border/80">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
              <DropdownMenuLabel className="p-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Notifications
              </DropdownMenuLabel>
              {notifs.unreadCount > 0 && (
                <Button variant="link" size="sm" onClick={markAll} className="h-auto p-0 text-xs text-primary font-medium">
                  Mark all read
                </Button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifs.notifications.length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">No new notifications</div>
              )}
              {notifs.notifications.slice(0, 20).map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className={`flex-col items-start gap-1 p-3 cursor-pointer border-b border-border/30 last:border-0 ${
                    !n.isRead ? 'bg-primary/5 font-medium' : ''
                  }`}
                  data-testid={`notification-item-${n.id}`}
                >
                  <div className="font-medium text-xs flex items-center justify-between w-full text-foreground">
                    <span>{n.title}</span>
                    {!n.isRead && <span className="h-2 w-2 rounded-full bg-primary shrink-0 ml-2" />}
                  </div>
                  <div className="text-[11px] text-muted-foreground line-clamp-2">{n.body}</div>
                </DropdownMenuItem>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-1.5 p-1 rounded-xl hover:bg-muted/60 transition-colors focus-visible:outline-none"
              data-testid="user-profile-trigger"
            >
              <Avatar className="h-7 w-7 border border-border">
                {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.fullName || 'User'} />}
                <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                  {initials(user?.fullName)}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:inline-block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 shadow-xl border-border/80">
            <div className="px-3 py-2 border-b border-border/50">
              <div className="font-medium text-xs text-foreground truncate">{user?.fullName || 'User'}</div>
              <div className="text-[10px] text-muted-foreground truncate">{user?.email}</div>
              {currentOrg && (
                <Badge variant="outline" className="mt-1 text-[9px] px-1.5 py-0 h-4 border-primary/30 text-primary font-semibold uppercase">
                  {currentOrg.role}
                </Badge>
              )}
            </div>

            <div className="p-1">
              <DropdownMenuItem onClick={() => navigate('/app/profile')} className="cursor-pointer text-xs flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span>My Profile</span>
              </DropdownMenuItem>

              {isOwner && (
                <DropdownMenuItem onClick={() => navigate('/app/role-permissions')} className="cursor-pointer text-xs flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
                  <span>Role Permissions</span>
                </DropdownMenuItem>
              )}
            </div>

            {memberships && memberships.length > 1 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Switch Workspace
                </DropdownMenuLabel>
                <div className="max-h-32 overflow-y-auto p-1">
                  {memberships.map((m) => (
                    <DropdownMenuItem
                      key={m.orgId}
                      onClick={() => switchOrg(m.orgId)}
                      className={`cursor-pointer text-xs flex items-center justify-between ${
                        m.orgId === currentOrg?.id ? 'bg-primary/10 text-primary font-semibold' : ''
                      }`}
                    >
                      <span className="truncate">{m.organization?.name || 'Workspace'}</span>
                      {m.orgId === currentOrg?.id && <Check className="h-3 w-3 text-primary shrink-0" />}
                    </DropdownMenuItem>
                  ))}
                </div>
              </>
            )}

            <DropdownMenuSeparator />
            <div className="p-1">
              <DropdownMenuItem onClick={logout} className="cursor-pointer text-xs text-destructive flex items-center gap-2 focus:bg-destructive/10 focus:text-destructive">
                <LogOut className="h-3.5 w-3.5" />
                <span>Log Out</span>
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

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
              <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                {inviteModal?.role}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invited by:</span>
              <span className="font-medium">{inviteModal?.inviterName}</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" disabled={responding} onClick={() => handleRespondInvite('DECLINE')} className="w-full sm:w-auto">
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
              {transferModal?.body ||
                `${transferModal?.senderName || 'Director'} has requested to transfer workspace ownership of ${
                  transferModal?.orgName || 'this workspace'
                } to you.`}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 my-2 space-y-1.5 text-xs text-amber-600">
            <div className="font-semibold">Important Authorization Notice</div>
            <div>
              Accepting this request will immediately assign you as the <strong>DIRECTOR</strong> of{' '}
              <strong>{transferModal?.orgName}</strong>. The current director ({transferModal?.senderEmail}) will be shifted to
              the <strong>ADMIN</strong> role.
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

