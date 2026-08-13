import React, { useEffect, lazy, Suspense } from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

// Eagerly loaded critical paths
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import AppShell from '@/components/shell/AppShell';
import HomePage from '@/pages/HomePage';

// Lazy loaded secondary & heavy feature routes for faster initial bundle load
const GoogleCallbackPage = lazy(() => import('@/pages/GoogleCallbackPage'));
const VerifyEmailPage = lazy(() => import('@/pages/VerifyEmailPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const ChannelPage = lazy(() => import('@/pages/ChannelPage'));
const TasksPage = lazy(() => import('@/pages/TasksPage'));
const HomeworkPage = lazy(() => import('@/pages/HomeworkPage'));
const AIPage = lazy(() => import('@/pages/AIPage'));
const MeetingsPage = lazy(() => import('@/pages/MeetingsPage'));
const FilesPage = lazy(() => import('@/pages/FilesPage'));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'));
const AdminPage = lazy(() => import('@/pages/AdminPage'));
const DepartmentPage = lazy(() => import('@/pages/DepartmentPage'));
const TeacherPage = lazy(() => import('@/pages/TeacherPage'));
const ProjectDetailPage = lazy(() => import('@/pages/ProjectDetailPage'));
const TeamDetailPage = lazy(() => import('@/pages/TeamDetailPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const SuperAdminPage = lazy(() => import('@/pages/SuperAdminPage'));
const RolePermissionsPage = lazy(() => import('@/pages/RolePermissionsPage'));
const StudentIDGeneratorPage = lazy(() => import('@/pages/StudentIDGeneratorPage'));
const ParentPortalPage = lazy(() => import('@/pages/ParentPortalPage'));
const AccountantPage = lazy(() => import('@/pages/AccountantPage'));
const TimetablePage = lazy(() => import('@/pages/TimetablePage'));
import MyPayslipPage from '@/pages/MyPayslipPage';
import StudentFeeStatusPage from '@/pages/StudentFeeStatusPage';

function PageLoader() {
  return (
    <div className="flex h-[300px] w-full items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function isAccountantUser(user, currentOrg) {
  return (
    user?.systemRole === 'ACCOUNTANT' ||
    currentOrg?.role === 'ACCOUNTANT' ||
    user?.email?.toLowerCase().includes('accountant')
  );
}

function RootRedirect() {
  const { user, currentOrg, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (isAccountantUser(user, currentOrg)) {
    return <Navigate to="/app/accountant" replace />;
  }
  return <Navigate to="/app/home" replace />;
}

function AppIndexRedirect() {
  const { user, currentOrg } = useAuth();
  if (isAccountantUser(user, currentOrg)) {
    return <Navigate to="accountant" replace />;
  }
  return <Navigate to="home" replace />;
}

function RequireAccountant({ children }) {
  const { user, currentOrg, loading } = useAuth();
  if (loading) return <PageLoader />;
  const isAccountant = currentOrg?.role === 'ACCOUNTANT' || user?.systemRole === 'ACCOUNTANT' || user?.email?.toLowerCase().includes('accountant');
  if (!isAccountant) return <Navigate to="/app/home" replace />;
  return children;
}

export default function App() {
  useEffect(() => {
    document.title = 'Convee';
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/student-login" element={<LoginPage initialPortal="student" />} />
              <Route path="/parent-login" element={<LoginPage initialPortal="parent" />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/auth/google" element={<GoogleCallbackPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/app" element={<RequireAuth><AppShell /></RequireAuth>}>
                <Route index element={<AppIndexRedirect />} />
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
                <Route path="parent" element={<ParentPortalPage />} />
                <Route path="accountant" element={<RequireAccountant><AccountantPage /></RequireAccountant>} />
                <Route path="timetable" element={<TimetablePage />} />
                <Route path="my-payslips" element={<MyPayslipPage />} />
                <Route path="fee-status" element={<StudentFeeStatusPage />} />
                <Route path="projects/:projectId" element={<ProjectDetailPage />} />
                <Route path="teams/:teamId" element={<TeamDetailPage />} />
                <Route path="super-admin" element={<SuperAdminPage />} />
                <Route path="role-permissions" element={<RolePermissionsPage />} />
                <Route path="student-id-generator" element={<StudentIDGeneratorPage />} />
                <Route path="profile" element={<ProfilePage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <Toaster richColors position="top-right" />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
