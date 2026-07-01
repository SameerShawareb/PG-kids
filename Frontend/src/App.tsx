import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChildProvider } from './context/ChildContext';
import Header from './components/Header';
import AuthPage from './pages/AuthPage';
import ProfilesPage from './pages/ProfilesPage';
import ParentDashboard from './pages/ParentDashboard';
import ChildHomePage from './pages/ChildHomePage';
import WorldViewPage from './pages/WorldViewPage';
import AdminDashboard from './pages/AdminDashboard';
import SubscriptionPage from './pages/SubscriptionPage';
import ProfilePage from './pages/ProfilePage';
import Footer from './components/Footer';

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const { user, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-orange-500 border-t-sky-300 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'admin') return <Navigate to="/admin" />;
    return <Navigate to="/profiles" />;
  }

  return <>{children}</>;
};

const AppContent = () => {
  const { user } = useAuth();
  
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="flex-grow">
        <Routes>
          <Route path="/auth" element={user ? <Navigate to="/profiles" /> : <AuthPage />} />
          
          <Route path="/profiles" element={
            <ProtectedRoute allowedRoles={['parent']}>
              <ProfilesPage />
            </ProtectedRoute>
          } />
          
          <Route path="/parent" element={
            <ProtectedRoute allowedRoles={['parent']}>
              <ParentDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/subscriptions" element={
            <ProtectedRoute allowedRoles={['parent']}>
              <SubscriptionPage />
            </ProtectedRoute>
          } />
          
          <Route path="/home" element={<ChildHomePage />} />
          
          <Route path="/profile" element={
            <ProtectedRoute allowedRoles={['parent', 'child']}>
              <ProfilePage />
            </ProtectedRoute>
          } />
          
          <Route path="/world" element={<Navigate to="/world/1" replace />} />

          <Route path="/world/:worldId" element={
            <ProtectedRoute allowedRoles={['parent', 'child', 'admin']}>
              <WorldViewPage />
            </ProtectedRoute>
          } />
          
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/home" />} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <ChildProvider>
          <AppContent />
        </ChildProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;
