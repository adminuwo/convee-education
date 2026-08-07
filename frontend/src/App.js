import React, { useEffect } from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import GoogleCallbackPage from '@/pages/GoogleCallbackPage';
import VerifyEmailPage from '@/pages/VerifyEmailPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import AppShell from '@/components/shell/AppShell';
import HomePage from '@/pages/HomePage';
import ChannelPage from '@/pages/ChannelPage';
import TasksPage from '@/pages/TasksPage';
import HomeworkPage from '@/pages/HomeworkPage';
import AIPage from '@/pages/AIPage';
import MeetingsPage from '@/pages/MeetingsPage';
import FilesPage from '@/pages/FilesPage';
import AnalyticsPage from '@/pages/AnalyticsPage';
import AdminPage from '@/pages/AdminPage';
import DepartmentPage from '@/pages/DepartmentPage';
import TeacherPage from '@/pages/TeacherPage';
import ProjectDetailPage from '@/pages/ProjectDetailPage';
import TeamDetailPage from '@/pages/TeamDetailPage';
import ProfilePage from '@/pages/ProfilePage';
import SuperAdminPage from '@/pages/SuperAdminPage';
import RolePermissionsPage from '@/pages/RolePermissionsPage';
import StudentIDGeneratorPage from '@/pages/StudentIDGeneratorPage';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? '/app/home' : '/login'} replace />;
}

export default function App() {
  useEffect(() => {
    document.title = 'Convee';
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/student-login" element={<LoginPage initialPortal="student" />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/auth/google" element={<GoogleCallbackPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/app" element={<RequireAuth><AppShell /></RequireAuth>}>
              <Route index element={<Navigate to="home" replace />} />
              <Route path="home" element={<HomePage />} />
              <Route path="channels/:channelId" element={<ChannelPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="tasks/:taskId" element={<TasksPage />} />
              <Route path="homework" element={<HomeworkPage />} />
              <Route path="ai" element={<AIPage />} />
              <Route path="meetings" element={<MeetingsPage />} />
              <Route path="files" element={<FilesPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="admin" element={<AdminPage />} />
              <Route path="department" element={<DepartmentPage />} />
              <Route path="classroom" element={<TeacherPage />} />
              <Route path="projects/:projectId" element={<ProjectDetailPage />} />
              <Route path="teams/:teamId" element={<TeamDetailPage />} />
              <Route path="super-admin" element={<SuperAdminPage />} />
              <Route path="role-permissions" element={<RolePermissionsPage />} />
              <Route path="student-id-generator" element={<StudentIDGeneratorPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster richColors position="top-right" />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
