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
  if (currentOrg?.role === 'PARENT') {
    return <Navigate to="/app/parent" replace />;
  }
  return <Navigate to="/app/home" replace />;
}

function AppIndexRedirect() {
  const { user, currentOrg } = useAuth();
  if (isAccountantUser(user, currentOrg)) {
    return <Navigate to="accountant" replace />;
  }
  if (currentOrg?.role === 'PARENT') {
    return <Navigate to="parent" replace />;
  }
  return <Navigate to="home" replace />;
}

/**
 * Strict Role-Based Route Guard.
 * Automatically verifies user role and prevents unauthorized deep-linking or URL tampering.
 */
function RequireRole({ allowedRoles = [], fallback, children }) {
  const { user, currentOrg, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  const role = (currentOrg?.role || user?.systemRole || 'STUDENT').toUpperCase();
  const isAccountant =
    role === 'ACCOUNTANT' ||
    user?.systemRole === 'ACCOUNTANT' ||
    user?.email?.toLowerCase().includes('accountant');
  const isParent = role === 'PARENT';

  const defaultFallback = isAccountant
    ? '/app/accountant'
    : isParent
    ? '/app/parent'
    : '/app/home';

  const targetFallback = fallback || defaultFallback;

  // 1. Accountant Role Isolation
  if (isAccountant) {
    if (allowedRoles.includes('ACCOUNTANT') || allowedRoles.includes('*')) {
      return children;
    }
    return <Navigate to="/app/accountant" replace />;
  }

  // 2. Parent Role Isolation
  if (isParent) {
    if (allowedRoles.includes('PARENT') || allowedRoles.includes('*')) {
      return children;
    }
    return <Navigate to="/app/parent" replace />;
  }

  // 3. Super Admin & Top Leadership full privileges
  const isAdminTier = ['DIRECTOR', 'OWNER', 'PRINCIPAL', 'ADMIN', 'SUPERADMIN'].includes(role);
  if (isAdminTier && (allowedRoles.includes('ADMIN') || allowedRoles.includes(role) || allowedRoles.includes('*'))) {
    return children;
  }

  // 4. Exact role verification
  if (allowedRoles.includes(role) || allowedRoles.includes('*')) {
    return children;
  }

  return <Navigate to={targetFallback} replace />;
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

                {/* Academic & Staff Core Pages */}
                <Route
                  path="home"
                  element={
                    <RequireRole allowedRoles={['DIRECTOR', 'OWNER', 'PRINCIPAL', 'ADMIN', 'DEAN', 'HOD', 'TEACHER', 'STUDENT']}>
                      <HomePage />
                    </RequireRole>
                  }
                />
                <Route
                  path="channels/:channelId"
                  element={
                    <RequireRole allowedRoles={['DIRECTOR', 'OWNER', 'PRINCIPAL', 'ADMIN', 'DEAN', 'HOD', 'TEACHER', 'STUDENT', 'PARENT']}>
                      <ChannelPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="tasks"
                  element={
                    <RequireRole allowedRoles={['DIRECTOR', 'OWNER', 'PRINCIPAL', 'ADMIN', 'DEAN', 'HOD', 'TEACHER']}>
                      <TasksPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="tasks/:taskId"
                  element={
                    <RequireRole allowedRoles={['DIRECTOR', 'OWNER', 'PRINCIPAL', 'ADMIN', 'DEAN', 'HOD', 'TEACHER']}>
                      <TasksPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="homework"
                  element={
                    <RequireRole allowedRoles={['DIRECTOR', 'OWNER', 'PRINCIPAL', 'ADMIN', 'DEAN', 'HOD', 'TEACHER', 'STUDENT', 'PARENT']}>
                      <HomeworkPage />
                    </RequireRole>
                  }
                />
                <Route path="ai" element={<AIPage />} />
                <Route
                  path="meetings"
                  element={
                    <RequireRole allowedRoles={['DIRECTOR', 'OWNER', 'PRINCIPAL', 'ADMIN', 'DEAN', 'HOD', 'TEACHER', 'STUDENT', 'PARENT']}>
                      <MeetingsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="files"
                  element={
                    <RequireRole allowedRoles={['DIRECTOR', 'OWNER', 'PRINCIPAL', 'ADMIN', 'DEAN', 'HOD', 'TEACHER', 'STUDENT']}>
                      <FilesPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="analytics"
                  element={
                    <RequireRole allowedRoles={['DIRECTOR', 'OWNER', 'PRINCIPAL', 'ADMIN', 'DEAN', 'HOD']}>
                      <AnalyticsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="admin"
                  element={
                    <RequireRole allowedRoles={['DIRECTOR', 'OWNER', 'PRINCIPAL', 'ADMIN', 'SUPERADMIN']}>
                      <AdminPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="department"
                  element={
                    <RequireRole allowedRoles={['DIRECTOR', 'OWNER', 'PRINCIPAL', 'ADMIN', 'DEAN', 'HOD', 'TEACHER']}>
                      <DepartmentPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="classroom"
                  element={
                    <RequireRole allowedRoles={['DIRECTOR', 'OWNER', 'PRINCIPAL', 'ADMIN', 'DEAN', 'HOD', 'TEACHER']}>
                      <TeacherPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="parent"
                  element={
                    <RequireRole allowedRoles={['PARENT', 'DIRECTOR', 'OWNER', 'PRINCIPAL', 'ADMIN']}>
                      <ParentPortalPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="accountant"
                  element={
                    <RequireRole allowedRoles={['ACCOUNTANT', 'DIRECTOR', 'OWNER', 'PRINCIPAL', 'ADMIN']}>
                      <AccountantPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="timetable"
                  element={
                    <RequireRole allowedRoles={['DIRECTOR', 'OWNER', 'PRINCIPAL', 'ADMIN', 'DEAN', 'HOD', 'TEACHER', 'STUDENT']}>
                      <TimetablePage />
                    </RequireRole>
                  }
                />
                <Route
                  path="my-payslips"
                  element={
                    <RequireRole allowedRoles={['DIRECTOR', 'OWNER', 'PRINCIPAL', 'ADMIN', 'DEAN', 'HOD', 'TEACHER', 'ACCOUNTANT']}>
                      <MyPayslipPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="fee-status"
                  element={
                    <RequireRole allowedRoles={['DIRECTOR', 'OWNER', 'PRINCIPAL', 'ADMIN', 'DEAN', 'HOD', 'ACCOUNTANT']}>
                      <StudentFeeStatusPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="projects/:projectId"
                  element={
                    <RequireRole allowedRoles={['DIRECTOR', 'OWNER', 'PRINCIPAL', 'ADMIN', 'DEAN', 'HOD', 'TEACHER']}>
                      <ProjectDetailPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="teams/:teamId"
                  element={
                    <RequireRole allowedRoles={['DIRECTOR', 'OWNER', 'PRINCIPAL', 'ADMIN', 'DEAN', 'HOD', 'TEACHER']}>
                      <TeamDetailPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="super-admin"
                  element={
                    <RequireRole allowedRoles={['SUPERADMIN', 'DIRECTOR', 'OWNER']}>
                      <SuperAdminPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="role-permissions"
                  element={
                    <RequireRole allowedRoles={['SUPERADMIN', 'DIRECTOR', 'OWNER', 'ADMIN', 'PRINCIPAL']}>
                      <RolePermissionsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="student-id-generator"
                  element={
                    <RequireRole allowedRoles={['SUPERADMIN', 'DIRECTOR', 'OWNER', 'ADMIN', 'PRINCIPAL']}>
                      <StudentIDGeneratorPage />
                    </RequireRole>
                  }
                />
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
