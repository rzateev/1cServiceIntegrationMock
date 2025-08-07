import React from 'react';
import { Layout, Menu } from 'antd';
import {
  AppstoreOutlined,
  ClusterOutlined,
  ApartmentOutlined,
  UserOutlined
} from '@ant-design/icons';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import ApplicationTable from './components/ApplicationTable';
import ProcessTable from './components/ProcessTable';
import ChannelTable from './components/ChannelTable';
import UserTable from './components/UserTable';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import LoginPage from './pages/LoginPage';
import IntegrationTestPage from './pages/IntegrationTestPage';
import { useAuth } from './contexts/AuthContext';
import { Button } from 'antd';
import ApiTestPage from './pages/ApiTestPage';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { Header, Sider, Content } = Layout;

const queryClient = new QueryClient();

const HeaderUser: React.FC = () => {
    const { isAuthenticated, logout } = useAuth();
    if (!isAuthenticated) return null;
    return <Button onClick={logout}>Выйти</Button>;
};

const App: React.FC = () => {

    const menuItems = [
        { key: 'applications', icon: <AppstoreOutlined />, label: <Link to="/applications">Приложения</Link> },
        { key: 'processes', icon: <ClusterOutlined />, label: <Link to="/processes">Процессы</Link> },
        { key: 'channels', icon: <ApartmentOutlined />, label: <Link to="/channels">Каналы</Link> },
        { key: 'users', icon: <UserOutlined />, label: <Link to="/users">Пользователи</Link> },        
        { key: 'api-test', icon: <AppstoreOutlined />, label: <Link to="/api-test">Проверка API</Link> },
        { key: 'integration-test', icon: <AppstoreOutlined />, label: <Link to="/integration-test">Проверка каналов</Link> },
      ];

    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <Router basename="/">
                    <Layout style={{ minHeight: '100vh' }}>
                        <Sider breakpoint="lg" collapsedWidth="0">
                            <div style={{ height: 32, margin: 16, color: '#fff', fontWeight: 'bold', textAlign: 'center' }}>
                                Сервис интеграции (Mock-сервис) 
                            </div>
                            <Menu theme="dark" mode="inline" items={menuItems} />
                        </Sider>
                        <Layout>
                            <Header style={{ background: '#fff', padding: 0, textAlign: 'right', paddingRight: 24 }}>
                                <HeaderUser />
                            </Header>
                            <Content style={{ margin: '24px 16px 0', background: '#fff', padding: 24, minHeight: 360 }}>
                                <Routes>
                                    <Route path="/login" element={<LoginPage />} />
                                    <Route path="/applications" element={<PrivateRoute><ApplicationTable /></PrivateRoute>} />
                                    <Route path="/processes" element={<PrivateRoute><ProcessTable /></PrivateRoute>} />
                                    <Route path="/channels" element={<PrivateRoute><ChannelTable /></PrivateRoute>} />
                                    <Route path="/users" element={<PrivateRoute><UserTable /></PrivateRoute>} />
                                    <Route path="/api-test" element={<PrivateRoute><ApiTestPage /></PrivateRoute>} />
                                    <Route path="/integration-test" element={<PrivateRoute><IntegrationTestPage /></PrivateRoute>} />                                    
                                    <Route path="*" element={<PrivateRoute><ApplicationTable /></PrivateRoute>} />
                                </Routes>
                            </Content>
                        </Layout>
                    </Layout>
                </Router>
            </AuthProvider>
        </QueryClientProvider>
    );
};

export default App;
