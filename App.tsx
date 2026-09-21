import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';

import Layout from './components/Layout';
import NotificationModal from './components/NotificationModal';
import LoadingScreen from './components/LoadingScreen';

import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Bills from './pages/Bills';
import Shopping from './pages/Shopping';
import Goals from './pages/Goals';
import Assets from './pages/Assets';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Calendar from './pages/Calendar';
import Ranking from './pages/Ranking';
import Debts from './pages/Debts';
import Wallets from './pages/Wallets';
import LandingHomeFin from './pages/LandingHomeFin';
import PreConfiguracaoFamilia from './pages/PreConfiguracaoFamilia';
import Planos from './pages/Planos';
import MeusPlanos from './pages/MeusPlanos';
import SuperAdmin from './pages/SuperAdmin';
import { saasDb } from './services/saasDb';

const App: React.FC = () => {
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    saasDb.syncFromSupabase()
      .catch((error) => {
        console.error('Erro ao sincronizar dados SaaS:', error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingHomeFin />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/setup" element={<PreConfiguracaoFamilia />} />
        <Route path="/plans" element={<Planos />} />
        <Route path="/admin" element={<SuperAdmin />} />

        <Route
          path="/dashboard"
          element={
            <Layout>
              <Dashboard />
            </Layout>
          }
        />

        <Route
          path="/bills"
          element={
            <Layout>
              <Bills />
            </Layout>
          }
        />

        <Route
          path="/shopping"
          element={
            <Layout>
              <Shopping />
            </Layout>
          }
        />

        <Route
          path="/calendar"
          element={
            <Layout>
              <Calendar />
            </Layout>
          }
        />

        <Route
          path="/wallets"
          element={
            <Layout>
              <Wallets />
            </Layout>
          }
        />

        <Route
          path="/goals"
          element={
            <Layout>
              <Goals />
            </Layout>
          }
        />

        <Route
          path="/assets"
          element={
            <Layout>
              <Assets />
            </Layout>
          }
        />

        <Route
          path="/reports"
          element={
            <Layout>
              <Reports />
            </Layout>
          }
        />

        <Route
          path="/ranking"
          element={
            <Layout>
              <Ranking />
            </Layout>
          }
        />

        <Route
          path="/debts"
          element={
            <Layout>
              <Debts />
            </Layout>
          }
        />

        <Route
          path="/settings"
          element={
            <Layout>
              <Settings />
            </Layout>
          }
        />

        <Route
          path="/my-plan"
          element={
            <Layout>
              <MeusPlanos />
            </Layout>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Sistema global de notificações */}
      <NotificationModal />
    </HashRouter>
  );
};

export default App;