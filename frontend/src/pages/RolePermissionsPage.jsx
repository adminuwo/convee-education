import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { rolePermissionsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck, ShieldAlert, Plus, Trash2, Lock, Save, Search, Sparkles, Check, Info } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmModal from '@/components/ConfirmModal';

export default function RolePermissionsPage() {
  const { currentOrg, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [isOwner, setIsOwner] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [activePermissions, setActivePermissions] = useState([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Create Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRolePerms, setNewRolePerms] = useState([]);
  const [creating, setCreating] = useState(false);

  // Delete Modal
  const [deleteModal, setDeleteModal] = useState({ open: false, role: null });
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentOrg?.id) return;
    setLoading(true);
    try {
      const data = await rolePermissionsApi.get(currentOrg.id);
      const filteredRoles = (data.roles || []).filter((r) => r.role?.toUpperCase() !== 'ACCOUNTANT');
      setRoles(filteredRoles);
      setAllPermissions(data.allPermissions || []);
      setIsOwner(data.isOwner);
      if (filteredRoles && filteredRoles.length > 0) {
        const initial = filteredRoles[0];
        setSelectedRole(initial);
        setActivePermissions(initial.permissions || []);
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to load role permissions');
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectRole = (r) => {
    setSelectedRole(r);
    setActivePermissions(r.permissions || []);
  };

  const togglePermission = (key) => {
    if (!isOwner) return;
    setActivePermissions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSavePermissions = async () => {
    if (!selectedRole || !currentOrg?.id) return;
    setSaving(true);
    try {
      const res = await rolePermissionsApi.updatePermissions(currentOrg.id, selectedRole.role, {
        permissions: activePermissions,
      });
      toast.success(`Updated permissions for ${selectedRole.role}`);
      setRoles((prev) =>
        prev.map((r) => (r.role === selectedRole.role ? { ...r, permissions: res.permissions } : r))
      );
      setSelectedRole((prev) => (prev ? { ...prev, permissions: res.permissions } : prev));
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      toast.error('Role name is required');
      return;
    }
    setCreating(true);
    try {
      const created = await rolePermissionsApi.createRole(currentOrg.id, {
        role: newRoleName.trim(),
        description: newRoleDesc.trim(),
        permissions: newRolePerms,
      });
      toast.success(`Custom role "${created.role}" created successfully!`);
      setRoles((prev) => [...prev, created]);
      setSelectedRole(created);
      setActivePermissions(created.permissions || []);
      setCreateOpen(false);
      setNewRoleName('');
      setNewRoleDesc('');
      setNewRolePerms([]);
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to create role');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!deleteModal.role || !currentOrg?.id) return;
    setDeleting(true);
    try {
      await rolePermissionsApi.deleteRole(currentOrg.id, deleteModal.role.role);
      toast.success(`Role "${deleteModal.role.role}" deleted.`);
      const remaining = roles.filter((r) => r.role !== deleteModal.role.role);
      setRoles(remaining);
      if (remaining.length > 0) {
        setSelectedRole(remaining[0]);
        setActivePermissions(remaining[0].permissions || []);
      } else {
        setSelectedRole(null);
        setActivePermissions([]);
      }
      setDeleteModal({ open: false, role: null });
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to delete role');
    } finally {
      setDeleting(false);
    }
  };

  const filteredRoles = useMemo(() => {
    if (!search) return roles;
    return roles.filter((r) => r.role.toLowerCase().includes(search.toLowerCase()));
  }, [roles, search]);

  const categories = useMemo(() => {
    const map = {};
    allPermissions.forEach((p) => {
      if (!map[p.category]) map[p.category] = [];
      map[p.category].push(p);
    });
    return map;
  }, [allPermissions]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold">Director Access Required</h2>
        <p className="text-sm text-muted-foreground">
          The Role & Permissions Dashboard is restricted to Directors and Admins. You do not have permission to view or edit role security policies.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Role & Permissions Management</h1>
            <Badge variant="secondary" className="gap-1 bg-amber-500/10 text-amber-500 border-amber-500/20">
              <ShieldCheck className="h-3.5 w-3.5" /> Director Control Panel
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Grant or revoke permissions across system roles, create custom roles with specific privileges, or manage custom role lifecycles.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Create Custom Role
        </Button>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column: Role List */}
        <div className="md:col-span-4 lg:col-span-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter roles…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          <div className="space-y-1 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
            {filteredRoles.map((r) => {
              const isSelected = selectedRole?.role === r.role;
              return (
                <div
                  key={r.role}
                  onClick={() => handleSelectRole(r)}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-primary/10 border-primary text-foreground shadow-sm font-medium'
                      : 'bg-card border-border hover:bg-accent/50 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate">{r.role}</span>
                    </div>
                    <span className="text-xs opacity-70 truncate">{r.permissions?.length || 0} permissions</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {r.isSystem ? (
                      <Badge variant="outline" className="text-[10px] bg-muted/50 border-border gap-1 text-muted-foreground">
                        <Lock className="h-2.5 w-2.5" /> SYSTEM
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] bg-primary/15 text-primary border-primary/30">
                        CUSTOM
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Permission Matrix for Selected Role */}
        <div className="md:col-span-8 lg:col-span-9">
          {selectedRole ? (
            <Card className="border-border shadow-sm">
              <CardHeader className="border-b border-border bg-muted/20 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xl font-bold">{selectedRole.role}</CardTitle>
                      {selectedRole.isSystem ? (
                        <Badge variant="outline" className="gap-1 border-muted-foreground/30 text-muted-foreground">
                          <Lock className="h-3 w-3" /> Hardcoded System Role
                        </Badge>
                      ) : (
                        <Badge className="bg-primary/20 text-primary hover:bg-primary/20">Custom Role</Badge>
                      )}
                    </div>
                    <CardDescription className="mt-1">{selectedRole.description}</CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button onClick={handleSavePermissions} disabled={saving} className="gap-2">
                      <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Changes'}
                    </Button>
                    {!selectedRole.isSystem && (
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => setDeleteModal({ open: true, role: selectedRole })}
                        title="Delete custom role"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {selectedRole.isSystem && (
                  <div className="mt-3 text-xs bg-amber-500/10 border border-amber-500/20 text-amber-500 p-2.5 rounded-md flex items-center gap-2">
                    <Info className="h-4 w-4 shrink-0" />
                    <span>
                      This is a built-in system role. You can customize which permissions are granted or revoked below, but this role cannot be deleted.
                    </span>
                  </div>
                )}
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {Object.entries(categories).map(([cat, perms]) => (
                  <div key={cat} className="space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-1">
                      {cat}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {perms.map((p) => {
                        const isGranted = activePermissions.includes(p.key);
                        return (
                          <div
                            key={p.key}
                            onClick={() => togglePermission(p.key)}
                            className={`flex items-start justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                              isGranted
                                ? 'bg-primary/5 border-primary/40 shadow-xs'
                                : 'bg-card border-border hover:bg-muted/30 opacity-70'
                            }`}
                          >
                            <div className="space-y-0.5 pr-2">
                              <div className="text-sm font-medium flex items-center gap-1.5">
                                <span>{p.label}</span>
                              </div>
                              <div className="text-xs font-mono text-muted-foreground">{p.key}</div>
                            </div>
                            <Switch
                              checked={isGranted}
                              onCheckedChange={() => togglePermission(p.key)}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center border border-dashed rounded-lg text-muted-foreground">
              Select a role from the left panel to configure permissions.
            </div>
          )}
        </div>
      </div>

      {/* Dialog: Create Custom Role */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Custom Role</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateRole} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Role Name</label>
              <Input
                placeholder="e.g. EXAM_COORDINATOR or Lab Assistant"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Description</label>
              <Textarea
                placeholder="Briefly describe what this custom role handles…"
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
                rows={2}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-2">Initial Permissions</label>
              <div className="max-h-48 overflow-y-auto space-y-2 border border-border rounded-md p-3">
                {allPermissions.map((p) => {
                  const checked = newRolePerms.includes(p.key);
                  return (
                    <label key={p.key} className="flex items-center gap-2.5 text-xs cursor-pointer hover:bg-muted/40 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setNewRolePerms((prev) =>
                            prev.includes(p.key) ? prev.filter((k) => k !== p.key) : [...prev, p.key]
                          )
                        }
                        className="rounded text-primary focus:ring-primary h-4 w-4"
                      />
                      <div>
                        <span className="font-medium text-foreground">{p.label}</span>
                        <span className="text-[10px] text-muted-foreground block">{p.key}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? 'Creating…' : 'Create Role'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirm Delete Role */}
      <ConfirmModal
        open={deleteModal.open}
        onOpenChange={(val) => !val && setDeleteModal({ open: false, role: null })}
        title={`Delete Custom Role "${deleteModal.role?.role}"?`}
        description="Are you sure you want to delete this custom role? Members currently assigned to this role will revert to default permissions."
        confirmText="Delete Role"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDeleteRole}
        onClose={() => setDeleteModal({ open: false, role: null })}
      />
    </div>
  );
}
