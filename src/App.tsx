import { canAccessRoute } from './domain/rules';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginView } from './components/LoginView';
import { BarcodeScannerPage } from './pages/BarcodeScannerPage';
import { CategoriesPage, SuppliersPage, UnitsPage } from './pages/CategoriesUnitsSuppliersPage';
import { DashboardPage } from './pages/DashboardPage';
import { DeliveriesPage, OutgoingTransactionsPage } from './pages/DeliveriesAndOutPage';
import { IncomingTransactionsPage } from './pages/IncomingTransactionsPage';
import { MasterItemsPage } from './pages/MasterItemsPage';
import { ReportsPage } from './pages/ReportsPage';
import { HistoryPage, StockCardPage } from './pages/StockCardAndHistoryPage';
import { StockRequestsPage } from './pages/StockRequestsPage';
import { AuditLogsPage, SettingsPage, UsersPage } from './pages/UsersAuditSettingsPage';
import { InventoryProvider, useInventory } from './services/inventoryContext';

function InventoryRouter() {
  const { authStage, currentUser, activeRoute, setActiveRoute } = useInventory();

  if (authStage !== 'READY' || !currentUser) {
    return <LoginView />;
  }

  const route = canAccessRoute(currentUser.role, activeRoute) ? activeRoute : 'dashboard';

  const renderPage = () => {
    switch (route) {
      case 'dashboard':
        return <DashboardPage />;
      case 'items':
        return <MasterItemsPage />;
      case 'categories':
        return <CategoriesPage />;
      case 'units':
        return <UnitsPage />;
      case 'suppliers':
        return <SuppliersPage />;
      case 'incoming':
        return <IncomingTransactionsPage />;
      case 'requests':
        return <StockRequestsPage />;
      case 'deliveries':
        return <DeliveriesPage />;
      case 'outgoing':
        return <OutgoingTransactionsPage />;
      case 'scanner':
        return <BarcodeScannerPage />;
      case 'stock-card':
        return <StockCardPage />;
      case 'history':
        return <HistoryPage />;
      case 'reports':
        return <ReportsPage />;
      case 'users':
        return <UsersPage />;
      case 'audit-logs':
        return <AuditLogsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
            <p className="text-sm text-slate-600">Halaman tidak tersedia untuk role Anda.</p>
            <button
              type="button"
              onClick={() => setActiveRoute('dashboard')}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg"
            >
              Kembali ke Dashboard
            </button>
          </div>
        );
    }
  };

  return <AppShell>{renderPage()}</AppShell>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <InventoryProvider>
        <InventoryRouter />
      </InventoryProvider>
    </ErrorBoundary>
  );
}
