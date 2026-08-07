import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fileApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UploadCloud, FileText, Image as ImageIcon, Film, FileArchive, Music, Search, Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

function bytes(b) { if (!b) return '0 B'; const k = 1024; const sizes = ['B','KB','MB','GB']; const i = Math.floor(Math.log(b) / Math.log(k)); return `${(b / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`; }
function icon(mime) { if (mime?.startsWith('image/')) return ImageIcon; if (mime?.startsWith('video/')) return Film; if (mime?.startsWith('audio/')) return Music; if (mime?.includes('zip') || mime?.includes('compressed')) return FileArchive; return FileText; }
function initials(n) { return (n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase(); }

export default function FilesPage() {
  const { currentOrg, user } = useAuth();
  const [files, setFiles] = useState([]);
  const [q, setQ] = useState('');
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef();

  const load = useCallback(async () => { if (!currentOrg?.id) return; try { setFiles(await fileApi.list(currentOrg.id)); } catch { } }, [currentOrg?.id]);
  useEffect(() => { load(); }, [load]);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (currentOrg?.id) fd.append('orgId', currentOrg.id);
      await fileApi.upload(fd);
      toast.success('Uploaded');
      load();
    } catch (e) { toast.error(e?.response?.data?.error || 'Upload failed'); } finally { setUploading(false); }
  };

  const removeFile = async (fileId) => {
    try {
      await fileApi.delete(fileId);
      toast.success('File deleted');
      load();
    } catch (e) {
      toast.error('Failed to delete file');
    }
  };

  const filtered = files.filter((f) => !q || f.originalName.toLowerCase().includes(q.toLowerCase()));

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-6 lg:p-8 space-y-4" data-testid="files-page">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold">Files</h1>
          <p className="text-muted-foreground text-sm">Shared documents and media</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative"><Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search files…" className="pl-8 h-9 w-56" /></div>
          {currentOrg?.role !== 'STUDENT' && (
            <>
              <input type="file" hidden ref={inputRef} onChange={(e) => upload(e.target.files?.[0])} />
              <Button onClick={() => inputRef.current?.click()} disabled={uploading} data-testid="upload-file-btn"><UploadCloud className="h-4 w-4 mr-1" /> {uploading ? 'Uploading…' : 'Upload'}</Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr className="text-left text-muted-foreground">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Uploader</th>
                <th className="px-4 py-2 font-medium">Size</th>
                <th className="px-4 py-2 font-medium">Uploaded</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => { const Ic = icon(f.mimeType); return (
                <tr key={f.id} className="border-b border-border hover:bg-muted/50">
                  <td className="px-4 py-2"><div className="flex items-center gap-2"><Ic className="h-4 w-4 text-muted-foreground" /> <span className="font-medium">{f.originalName}</span></div></td>
                  <td className="px-4 py-2"><div className="flex items-center gap-2"><Avatar className="h-6 w-6"><AvatarImage src={f.uploader?.avatarUrl}/><AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials(f.uploader?.fullName)}</AvatarFallback></Avatar>{f.uploader?.fullName}</div></td>
                  <td className="px-4 py-2 text-muted-foreground">{bytes(f.size)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{format(new Date(f.createdAt), 'PP')}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <a href={fileApi.download(f.id)} download={f.originalName}>
                        <Button variant="ghost" size="sm" title="Download file">
                          <Download className="h-4 w-4" />
                        </Button>
                      </a>
                      {(f.uploaderId === user?.id || ['DIRECTOR', 'PRINCIPAL', 'DEAN', 'HOD', 'ADMIN', 'OWNER'].includes(currentOrg?.role)) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(f.id)}
                          className="text-muted-foreground hover:text-destructive"
                          title="Delete file"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );})}
              {filtered.length === 0 && <tr><td colSpan={5} className="text-center text-muted-foreground py-8">No files yet</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </motion.div>
  );
}
