import React, { useState, useEffect } from 'react';
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { useNavigate } from 'react-router-dom';
import { searchApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Home, Hash, ListTodo, Sparkles, Calendar, FolderOpen, User as UserIcon, MessageSquare } from 'lucide-react';

export function CommandPalette({ open, setOpen }) {
  const navigate = useNavigate();
  const { currentOrg } = useAuth();
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);

  useEffect(() => {
    if (!q || q.length < 2) { setResults(null); return; }
    let ignore = false;
    const timer = setTimeout(async () => {
      try {
        const r = await searchApi.global(q, currentOrg?.id);
        if (!ignore) setResults(r);
      } catch { }
    }, 200);
    return () => { ignore = true; clearTimeout(timer); };
  }, [q, currentOrg?.id]);

  const go = (p) => { setOpen(false); navigate(p); };

  return (
    <CommandDialog open={open} onOpenChange={setOpen} data-testid="command-palette">
      <CommandInput placeholder="Search users, messages, tasks, files, channels…" value={q} onValueChange={setQ} />
      <CommandList>
        <CommandEmpty>{q.length < 2 ? 'Type to search…' : 'No results found.'}</CommandEmpty>
        {(!q || q.length < 2) && (
          <CommandGroup heading="Navigate">
            <CommandItem onSelect={() => go('/app/home')}><Home className="h-4 w-4 mr-2" /> Home</CommandItem>
            <CommandItem onSelect={() => go('/app/tasks')}><ListTodo className="h-4 w-4 mr-2" /> Tasks</CommandItem>
            <CommandItem onSelect={() => go('/app/ai')}><Sparkles className="h-4 w-4 mr-2" /> AI Assistant</CommandItem>
            <CommandItem onSelect={() => go('/app/meetings')}><Calendar className="h-4 w-4 mr-2" /> Meetings</CommandItem>
            <CommandItem onSelect={() => go('/app/files')}><FolderOpen className="h-4 w-4 mr-2" /> Files</CommandItem>
          </CommandGroup>
        )}
        {results?.users?.length > 0 && (
          <CommandGroup heading="People">
            {results.users.map((u) => (
              <CommandItem key={u.id} onSelect={() => go(`/app/profile?user=${u.id}`)}><UserIcon className="h-4 w-4 mr-2" /> {u.fullName} <span className="ml-auto text-xs text-muted-foreground">{u.email}</span></CommandItem>
            ))}
          </CommandGroup>
        )}
        {results?.channels?.length > 0 && (
          <CommandGroup heading="Channels">
            {results.channels.map((c) => (
              <CommandItem key={c.id} onSelect={() => go(`/app/channels/${c.id}`)}><Hash className="h-4 w-4 mr-2" /> {c.name}</CommandItem>
            ))}
          </CommandGroup>
        )}
        {results?.messages?.length > 0 && (
          <CommandGroup heading="Messages">
            {results.messages.map((m) => (
              <CommandItem key={m.id} onSelect={() => go(`/app/channels/${m.channelId}`)}><MessageSquare className="h-4 w-4 mr-2" /> <span className="truncate">{m.content}</span></CommandItem>
            ))}
          </CommandGroup>
        )}
        {results?.tasks?.length > 0 && (
          <CommandGroup heading="Tasks">
            {results.tasks.map((t) => (
              <CommandItem key={t.id} onSelect={() => go(`/app/tasks/${t.id}`)}><ListTodo className="h-4 w-4 mr-2" /> {t.title}</CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
