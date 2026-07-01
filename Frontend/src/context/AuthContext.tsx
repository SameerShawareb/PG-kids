import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'parent' | 'admin' | 'child';
}

interface AuthContextType {
  user: User | null;
  role: 'parent' | 'admin' | 'child' | null;
  isBootstrapping: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'parent' | 'admin' | 'child' | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      const token = localStorage.getItem('pgkids_auth_token');
      if (!token) {
        setIsBootstrapping(false);
        return;
      }
      try {
        const { data } = await api.get('/api/auth/me');
        setUser(data.data.user);
        setRole(data.data.user.role);
      } catch (err) {
        console.error('Bootstrap failed', err);
        localStorage.removeItem('pgkids_auth_token');
      } finally {
        setIsBootstrapping(false);
      }
    };
    bootstrap();
  }, []);

  const login = (token: string, user: User) => {
    localStorage.setItem('pgkids_auth_token', token);
    setUser(user);
    setRole(user.role);
  };

  const logout = () => {
    localStorage.removeItem('pgkids_auth_token');
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, isBootstrapping, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
