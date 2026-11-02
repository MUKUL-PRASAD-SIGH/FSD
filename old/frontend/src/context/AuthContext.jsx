import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('hackelite_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('hackelite_token') || null);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (token && !user) {
      authService
        .getMe()
        .then((res) => {
          if (res.data?.user) {
            setUser(res.data.user);
            localStorage.setItem('hackelite_user', JSON.stringify(res.data.user));
          }
        })
        .catch(() => {
          logout();
        });
    }
  }, [token]);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await authService.login({ email, password });
      const { token: receivedToken, user: receivedUser } = res.data;

      localStorage.setItem('hackelite_token', receivedToken);
      localStorage.setItem('hackelite_user', JSON.stringify(receivedUser));

      setToken(receivedToken);
      setUser(receivedUser);

      showToast(`Welcome back, ${receivedUser.name}! (${receivedUser.role})`, 'success');
      return { success: true, user: receivedUser };
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please check your credentials.';
      showToast(msg, 'error');
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    setLoading(true);
    try {
      const res = await authService.register(userData);
      const { token: receivedToken, user: receivedUser } = res.data;

      localStorage.setItem('hackelite_token', receivedToken);
      localStorage.setItem('hackelite_user', JSON.stringify(receivedUser));

      setToken(receivedToken);
      setUser(receivedUser);

      showToast(`Account successfully created for ${receivedUser.name}!`, 'success');
      return { success: true, user: receivedUser };
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed.';
      showToast(msg, 'error');
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('hackelite_token');
    localStorage.removeItem('hackelite_user');
    setToken(null);
    setUser(null);
    showToast('Logged out successfully', 'info');
  };

  const updateUser = (updatedUserData) => {
    setUser(updatedUserData);
    localStorage.setItem('hackelite_user', JSON.stringify(updatedUserData));
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token && !!user,
    isAdmin: user?.role === 'admin',
    isStudent: user?.role === 'student',
    login,
    register,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
