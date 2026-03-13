import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import FacultyDashboard from './pages/faculty/FacultyDashboard';
import StudentDashboard from './pages/student/StudentDashboard';
import SessionView from './pages/faculty/SessionView';
import ScanPage from './pages/student/ScanPage';
import StudentHistory from './pages/student/StudentHistory';
import FaceRegistration from './pages/student/FaceRegistration';
import AdminStudents from './pages/admin/AdminStudents';
import AdminTimetable from './pages/admin/AdminTimetable';
import FacultyRecords from './pages/faculty/FacultyRecords';
import AddClass from './pages/faculty/AddClass';
import SwapClass from './pages/faculty/SwapClass';
import ForgotPassword from './pages/ForgotPassword';
import ChangePassword from './pages/ChangePassword';
import { User } from './types';
import { getCurrentUser, toAppUser, AuthUser, logout as authLogout } from './services/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
  user: User | null;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles, user }) => {
  if (!user) return <Navigate to="/" replace />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  // Restore session on mount
  useEffect(() => {
    const stored = getCurrentUser();
    if (stored) {
      setAuthUser(stored);
      setUser(toAppUser(stored));
    }
  }, []);

  const handleLogin = (newAuthUser: AuthUser) => {
    setAuthUser(newAuthUser);
    setUser(toAppUser(newAuthUser));
  };

  const handleLogout = () => {
    authLogout();
    setUser(null);
    setAuthUser(null);
  };

  return (
    <Layout user={user} onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={!user || !user.role ? <Login onLogin={handleLogin} /> : <Navigate to={`/${user.role.toLowerCase()}/dashboard`} />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/change-password" element={
          <ProtectedRoute user={user} allowedRoles={['ADMIN', 'FACULTY', 'STUDENT']}>
            <ChangePassword authUser={authUser} />
          </ProtectedRoute>
        } />

        {/* Admin Routes */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute user={user} allowedRoles={['ADMIN']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/students"
          element={
            <ProtectedRoute user={user} allowedRoles={['ADMIN']}>
              <AdminStudents />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/timetable"
          element={
            <ProtectedRoute user={user} allowedRoles={['ADMIN']}>
              <AdminTimetable />
            </ProtectedRoute>
          }
        />

        {/* Faculty Routes */}
        <Route
          path="/faculty/dashboard"
          element={
            <ProtectedRoute user={user} allowedRoles={['FACULTY']}>
              <FacultyDashboard authUser={authUser} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/faculty/session/:id"
          element={
            <ProtectedRoute user={user} allowedRoles={['FACULTY']}>
              <SessionView authUser={authUser} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/faculty/records"
          element={
            <ProtectedRoute user={user} allowedRoles={['FACULTY']}>
              <FacultyRecords authUser={authUser} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/faculty/add-class"
          element={
            <ProtectedRoute user={user} allowedRoles={['FACULTY']}>
              <AddClass authUser={authUser} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/faculty/swap-class"
          element={
            <ProtectedRoute user={user} allowedRoles={['FACULTY']}>
              <SwapClass authUser={authUser} />
            </ProtectedRoute>
          }
        />

        {/* Student Routes */}
        <Route
          path="/student/dashboard"
          element={
            <ProtectedRoute user={user} allowedRoles={['STUDENT']}>
              <StudentDashboard authUser={authUser} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/scan"
          element={
            <ProtectedRoute user={user} allowedRoles={['STUDENT']}>
              <ScanPage user={user} authUser={authUser} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/history"
          element={
            <ProtectedRoute user={user} allowedRoles={['STUDENT']}>
              <StudentHistory authUser={authUser} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/face-register"
          element={
            <ProtectedRoute user={user} allowedRoles={['STUDENT']}>
              <FaceRegistration />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
};

export default App;