import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { CommandPalette } from './CommandPalette';
import { useAuth } from '@/contexts/AuthContext';
import { OrgDataProvider } from '@/contexts/OrgDataContext';
import { Sheet, SheetContent } from '@/components/ui/sheet';

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const { currentOrg } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (currentOrg?.role === 'PARENT') {
      const allowedPrefixes = ['/app/parent', '/app/home', '/app/homework', '/app/meetings', '/app/ai', '/app/channels', '/app/profile'];
      const currentPath = location.pathname;
      const isAllowed = allowedPrefixes.some((prefix) => currentPath.startsWith(prefix));
      if (!isAllowed) {
        navigate('/app/parent', { replace: true });
      }
    }
  }, [currentOrg?.role, location.pathname, navigate]);

  if (!currentOrg) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-8 text-center">
        <h2 className="text-xl font-semibold">No workspace found</h2>
        <p className="text-muted-foreground">You are not a member of any organization yet.</p>
      </div>
    );
  }

  return (
    <OrgDataProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background text-foreground" data-testid="app-shell">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-[280px] flex-shrink-0 border-r border-border bg-[hsl(var(--sidebar))]">
        <Sidebar />
      </aside>
      {/* Mobile sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[280px] p-0 bg-[hsl(var(--sidebar))]">
          <Sidebar onNavigate={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} onSearchClick={() => setCmdOpen(true)} />
        <main className="flex-1 overflow-auto bg-background">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={cmdOpen} setOpen={setCmdOpen} />
    </div>
  </OrgDataProvider>
);
}
