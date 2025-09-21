import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

// Create a configured axios instance
const apiClient = axios.create({
  baseURL: 'http://localhost:3001',
});

// Add a request interceptor to include the token in all requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }, [token]);

  const login = async (email, password) => {
    const response = await apiClient.post('/api/auth/login', { email, password });
    setToken(response.data.token);
    return response;
  };

  const signup = async (email, password) => {
    return apiClient.post('/api/auth/signup', { email, password });
  };

  const logout = () => {
    setToken(null);
  };

  const value = {
    token,
    login,
    signup,
    logout,
    apiClient, // Provide the configured axios instance
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
