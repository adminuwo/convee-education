import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi, orgApi, setTokens, getAccessToken, getRefreshToken, setCurrentOrgId, getCurrentOrgId } from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [currentOrg, setCurrentOrg] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser({
        id: me.id, email: me.email, fullName: me.fullName, avatarUrl: me.avatarUrl,
        systemRole: me.systemRole, bio: me.bio, timezone: me.timezone, status: me.status,
        hasPassword: me.hasPassword,
      });
      setMemberships(me.memberships || []);
      const savedOrgId = getCurrentOrgId();
      const parseOrgHasAiLegal = (org) => {
        if (!org) return false;
        if (typeof org.hasAiLegal === 'boolean') return org.hasAiLegal;
        const desc = org.description || '';
        return /\[ADDONS:[^\]]*AI_LEGAL[^\]]*\]/i.test(desc);
      };

      const cur = (me.memberships || []).find((m) => m.orgId === savedOrgId) || me.memberships?.[0];
      if (cur) {
        setCurrentOrg({
          id: cur.orgId,
          name: cur.organization.name,
          slug: cur.organization.slug,
          description: cur.organization.description,
          hasAiLegal: parseOrgHasAiLegal(cur.organization),
          role: cur.role,
          logoUrl: cur.organization.logoUrl,
          ownerId: cur.organization.ownerId,
          departmentId: cur.departmentId,
          teamId: cur.teamId,
          directorId: cur.directorId || (cur.role === 'DIRECTOR' ? 'DIR-2026-1001' : null),
          userUniqueId: cur.userUniqueId || cur.directorId || (cur.title?.match(/\[(.*?)\]/)?.[1]) || null,
        });
        setCurrentOrgId(cur.orgId);
      } else if (me.systemRole === 'SUPER_ADMIN' && savedOrgId) {
        try {
          const orgDetails = await orgApi.get(savedOrgId);
          setCurrentOrg({
            id: orgDetails.id,
            name: orgDetails.name,
            slug: orgDetails.slug,
            description: orgDetails.description,
            hasAiLegal: parseOrgHasAiLegal(orgDetails),
            role: 'SUPER_ADMIN',
            logoUrl: orgDetails.logoUrl,
            ownerId: orgDetails.ownerId,
            isShadowMode: true,
          });
          setCurrentOrgId(orgDetails.id);
        } catch {
          // fallback if savedOrgId invalid
        }
      }
      connectSocket();
    } catch (e) {
      setUser(null); setMemberships([]); setCurrentOrg(null);
      setTokens(null, null); setCurrentOrgId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (getAccessToken()) refresh();
    else setLoading(false);
  }, [refresh]);

  const login = useCallback(async ({ email, password, portalMode }) => {
    const r = await authApi.login({ email, password, portalMode });
    setTokens(r.accessToken, r.refreshToken);
    await refresh();
    return r;
  }, [refresh]);

  const register = useCallback(async (data) => {
    const r = await authApi.register(data);
    // If email verification is required, backend returns emailSent:true without tokens
    if (r.emailSent) return r;
    setTokens(r.accessToken, r.refreshToken);
    if (r.org?.id) setCurrentOrgId(r.org.id);
    await refresh();
    return r;
  }, [refresh]);

  const loginWithGoogleCode = useCallback(async (code) => {
    const r = await authApi.googleCallback(code);
    setTokens(r.accessToken, r.refreshToken);
    await refresh();
    return r;
  }, [refresh]);

  const logout = useCallback(async () => {
    try { await authApi.logout(getRefreshToken()); } catch { }
    setTokens(null, null);
    setCurrentOrgId(null);
    setUser(null); setMemberships([]); setCurrentOrg(null);
    disconnectSocket();
    window.location.href = '/login';
  }, []);

  const switchOrg = useCallback((orgId, orgMeta = null) => {
    const parseOrgHasAiLegal = (org) => {
      if (!org) return false;
      if (typeof org.hasAiLegal === 'boolean') return org.hasAiLegal;
      const desc = org.description || '';
      return /\[ADDONS:[^\]]*AI_LEGAL[^\]]*\]/i.test(desc);
    };

    if (user?.systemRole === 'SUPER_ADMIN' && orgMeta) {
      setCurrentOrg({
        id: orgId,
        name: orgMeta.name,
        slug: orgMeta.slug,
        description: orgMeta.description,
        hasAiLegal: parseOrgHasAiLegal(orgMeta),
        role: 'SUPER_ADMIN',
        logoUrl: orgMeta.logoUrl,
        ownerId: orgMeta.ownerId,
        isShadowMode: true,
      });
      setCurrentOrgId(orgId);
      window.location.href = '/app/home';
      return;
    }
    const m = memberships.find((mm) => mm.orgId === orgId);
    if (m) {
      setCurrentOrg({
        id: m.orgId,
        name: m.organization.name,
        slug: m.organization.slug,
        description: m.organization.description,
        hasAiLegal: parseOrgHasAiLegal(m.organization),
        role: m.role,
        logoUrl: m.organization.logoUrl,
        ownerId: m.organization.ownerId,
      });
      setCurrentOrgId(m.orgId);
      window.location.reload();
      return;
    }
    if (user?.systemRole === 'SUPER_ADMIN' && orgId) {
      setCurrentOrgId(orgId);
      window.location.href = '/app/home';
    }
  }, [memberships, user]);

  return (
    <AuthContext.Provider value={{ user, memberships, currentOrg, loading, login, register, loginWithGoogleCode, logout, switchOrg, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
