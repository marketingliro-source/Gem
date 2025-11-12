import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Leads from './pages/Leads';
import Calendar from './pages/Calendar';
import Users from './pages/Users';
import Settings from './pages/Settings';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/dashboard" element={
            <PrivateRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </PrivateRoute>
          } />

          <Route path="/clients" element={
            <PrivateRoute>
              <Layout>
                <Clients />
              </Layout>
            </PrivateRoute>
          } />

          <Route path="/leads" element={
            <PrivateRoute>
              <Layout>
                <Leads />
              </Layout>
            </PrivateRoute>
          } />

          <Route path="/calendar" element={
            <PrivateRoute>
              <Layout>
                <Calendar />
              </Layout>
            </PrivateRoute>
          } />

          <Route path="/settings/users" element={
            <PrivateRoute adminOnly={true}>
              <Layout>
                <Users />
              </Layout>
            </PrivateRoute>
          } />

          <Route path="/settings/dimensioning" element={
            <PrivateRoute adminOnly={true}>
              <Layout>
                <Settings />
              </Layout>
            </PrivateRoute>
          } />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
