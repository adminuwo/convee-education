import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi, setTokens, setCurrentOrgId, hydrateAuthTokens } from '../lib/api';
import { storage } from '../lib/storage';

export interface User {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  systemRole?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  currentOrg: Organization | null;
  memberships: any[];
  loading: boolean;
  login: (data: { email: string; password: string; portalMode?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  switchOrg: (orgId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  currentOrg: null,
  memberships: [],
  loading: true,
  login: async () => {},
  logout: async () => {},
  refresh: async () => {},
  switchOrg: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const hydrate = async () => {
    try {
      await hydrateAuthTokens();
      const meData = await authApi.me();
      setUser(meData.user || null);
      setMemberships(meData.memberships || []);

      const savedOrgId = await storage.get('currentOrgId');
      const activeMem = meData.memberships?.find((m: any) => m.orgId === savedOrgId) || meData.memberships?.[0];
      if (activeMem) {
        setCurrentOrg({
          id: activeMem.organization?.id || activeMem.orgId,
          name: activeMem.organization?.name || 'Institution',
          slug: activeMem.organization?.slug || 'school',
          role: activeMem.role,
        });
        await setCurrentOrgId(activeMem.orgId);
      }
    } catch (e) {
      setUser(null);
      setCurrentOrg(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    hydrate();
  }, []);

  const login = async (data: { email: string; password: string; portalMode?: string }) => {
    const res = await authApi.login(data);
    await setTokens(res.accessToken, res.refreshToken);
    setUser(res.user);

    if (res.org) {
      const activeOrg = { ...res.org, role: res.role || res.user?.role || 'STUDENT' };
      setCurrentOrg(activeOrg);
      await setCurrentOrgId(res.org.id);
    }
    await hydrate();
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    } finally {
      await setTokens(null, null);
      await setCurrentOrgId(null);
      setUser(null);
      setCurrentOrg(null);
      setMemberships([]);
    }
  };

  const switchOrg = async (orgId: string) => {
    const mem = memberships.find((m) => m.orgId === orgId);
    if (mem) {
      setCurrentOrg({
        id: mem.orgId,
        name: mem.organization?.name || 'Institution',
        slug: mem.organization?.slug || '',
        role: mem.role,
      });
      await setCurrentOrgId(orgId);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        currentOrg,
        memberships,
        loading,
        login,
        logout,
        refresh: hydrate,
        switchOrg,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
