import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { orgApi, channelApi } from '@/lib/api';
import { connectSocket, getSocket } from '@/lib/socket';

const OrgDataContext = createContext(null);

export function OrgDataProvider({ children }) {
  const { currentOrg } = useAuth();
  const orgId = currentOrg?.id;

  const [departments, setDepartments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [channels, setChannels] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const isLoadedRef = React.useRef(false);

  useEffect(() => {
    isLoadedRef.current = false;
  }, [orgId]);

  const fetchAllOrgData = useCallback(async (silent = false) => {
    if (!orgId) {
      setDepartments([]);
      setProjects([]);
      setChannels([]);
      setMembers([]);
      setLoading(false);
      return;
    }

    if (!silent && !isLoadedRef.current) setLoading(true);

    try {
      const pDepts = orgApi.departments(orgId).then((res) => setDepartments(Array.isArray(res) ? res : [])).catch((err) => { console.warn('Departments fetch fallback:', err); setDepartments([]); });
      const pProjs = orgApi.projects(orgId).then((res) => setProjects(Array.isArray(res) ? res : [])).catch((err) => { console.warn('Projects fetch fallback:', err); setProjects([]); });
      const pChans = channelApi.list(orgId).then((res) => setChannels(Array.isArray(res) ? res : [])).catch((err) => { console.warn('Channels fetch fallback:', err); setChannels([]); });
      const pMems = orgApi.members(orgId).then((res) => setMembers(Array.isArray(res) ? res : [])).catch((err) => { console.warn('Members fetch fallback:', err); setMembers([]); });

      await Promise.all([pDepts, pProjs, pChans, pMems]);
      isLoadedRef.current = true;
    } catch (err) {
      console.error('Error loading org data:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchAllOrgData(false);
  }, [fetchAllOrgData]);

  useEffect(() => {
    if (!orgId) return;

    let s = getSocket() || connectSocket();
    if (!s) return;

    let timer = null;
    const debouncedRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        fetchAllOrgData(true);
      }, 300);
    };

    s.on('department:updated', debouncedRefresh);
    s.on('project:updated', debouncedRefresh);
    s.on('channel:updated', debouncedRefresh);
    s.on('membership:updated', debouncedRefresh);

    return () => {
      if (timer) clearTimeout(timer);
      s.off('department:updated', debouncedRefresh);
      s.off('project:updated', debouncedRefresh);
      s.off('channel:updated', debouncedRefresh);
      s.off('membership:updated', debouncedRefresh);
    };
  }, [orgId, fetchAllOrgData]);

  const refreshOrgData = useCallback(() => fetchAllOrgData(true), [fetchAllOrgData]);

  const value = React.useMemo(() => ({
    departments,
    setDepartments,
    projects,
    setProjects,
    channels,
    setChannels,
    members,
    setMembers,
    loading,
    refreshOrgData,
  }), [departments, projects, channels, members, loading, refreshOrgData]);

  return (
    <OrgDataContext.Provider value={value}>
      {children}
    </OrgDataContext.Provider>
  );
}

export function useOrgData() {
  const context = useContext(OrgDataContext);
  if (!context) {
    return {
      departments: [],
      projects: [],
      channels: [],
      members: [],
      loading: false,
      refreshOrgData: () => {},
      setDepartments: () => {},
      setProjects: () => {},
      setChannels: () => {},
      setMembers: () => {},
    };
  }
  return context;
}
