import React, { useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Bell,
  Boxes,
  Check,
  ClipboardCheck,
  ClipboardList,
  FileClock,
  FolderTree,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Ruler,
  ScanBarcode,
  Settings,
  ShieldAlert,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { MENU_BY_ROLE } from '../domain/rules';
import type { NavRoute } from '../domain/types';
import { useInventory } from '../services/inventoryContext';
import { Logo } from './Logo';

const ROUTE_ICONS: Record<NavRoute, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  items: Boxes,
  categories: FolderTree,
  units: Ruler,
  suppliers: Truck,
  incoming: ArrowDownToLine,
  requests: ClipboardList,
  deliveries: ClipboardCheck,
  outgoing: ArrowUpFromLine,
  scanner: ScanBarcode,
  'stock-card': FileClock,
  history: History,
  reports: BarChart3,
  users: Users,
  'audit-logs': ShieldAlert,
  settings: Settings,
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    currentUser,
    systemConfig,
    activeRoute,
    setActiveRoute,
    notifications,
    markNotificationAsRead,
    logout,
  } = useInventory();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  if (!currentUser) return null;

  const menuItems = MENU_BY_ROLE[currentUser.role];
  const currentMenu = menuItems.find((m) => m.route === activeRoute) ?? menuItems[0];
  const unreadCount = notifications.filter((n) => !n.readBy.includes(currentUser.uid)).length;

  const handleSelectRoute = (route: NavRoute) => {
    setActiveRoute(route);
    setMobileMenuOpen(false);
  };

  const roleDisplayName =
    currentUser.role === 'OWNER'
      ? 'Owner'
      : currentUser.role === 'ADMIN'
      ? 'Admin Gudang'
      : 'Staf Produksi';

  const SidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-2">
        <Logo light compact />
        <button
          type="button"
          aria-label="Tutup menu navigasi"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-md"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-5 py-3 border-b border-slate-800/80 text-xs text-slate-400">
        <div className="font-medium text-slate-200 truncate">{systemConfig?.companyName || 'Operasional Gudang'}</div>
        <div className="mt-0.5 text-slate-400">
          {roleDisplayName} · {currentUser.department}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Menu Utama">
        {menuItems.map((item) => {
          const Icon = ROUTE_ICONS[item.route];
          const isActive = activeRoute === item.route;
          return (
            <button
              key={item.route}
              type="button"
              onClick={() => handleSelectRoute(item.route)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-red-800 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-800">
        <button
          type="button"
          onClick={() => void logout()}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Keluar</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-slate-200 no-print">
        <div className="sticky top-0 h-screen">{SidebarContent}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] h-full z-10">{SidebarContent}</aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Buka menu navigasi"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-lg shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0 flex items-center gap-2 text-sm">
              <span className="hidden sm:inline text-slate-500 whitespace-nowrap">Inventaris</span>
              <span className="hidden sm:inline text-slate-300">/</span>
              <h1 className="font-display text-base sm:text-lg font-semibold text-slate-900 truncate">
                {currentMenu.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 relative">
            <button
              type="button"
              aria-label={`Notifikasi (${unreadCount} belum dibaca)`}
              onClick={() => setNotifOpen((v) => !v)}
              className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-700 text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
                  {unreadCount}
                </span>
              )}
            </button>

            <div className="hidden sm:flex flex-col items-end text-right leading-tight">
              <span className="text-sm font-medium text-slate-900 whitespace-nowrap">{currentUser.name}</span>
              <span className="text-xs text-slate-500 whitespace-nowrap">{roleDisplayName}</span>
            </div>

            {notifOpen && (
              <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <span className="font-display text-sm font-semibold text-slate-900">Notifikasi</span>
                  <button
                    type="button"
                    aria-label="Tutup notifikasi"
                    onClick={() => setNotifOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      Belum ada notifikasi.
                    </div>
                  ) : (
                    notifications.slice(0, 15).map((n) => {
                      const isRead = n.readBy.includes(currentUser.uid);
                      return (
                        <div
                          key={n.id}
                          className={`p-3.5 text-left space-y-1 ${isRead ? 'bg-white' : 'bg-slate-50'}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-900">{n.title}</span>
                            {!isRead && (
                              <button
                                type="button"
                                aria-label={`Tandai dibaca: ${n.title}`}
                                onClick={() => void markNotificationAsRead(n)}
                                className="p-1 text-blue-700 hover:bg-blue-50 rounded"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-slate-600">{n.message}</p>
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] text-slate-400 tabular-nums">
                              {n.createdAt.slice(0, 16).replace('T', ' ')}
                            </span>
                            {n.linkView && (
                              <button
                                type="button"
                                onClick={() => {
                                  void markNotificationAsRead(n);
                                  setActiveRoute(n.linkView!);
                                  setNotifOpen(false);
                                }}
                                className="text-[11px] font-medium text-red-800 hover:underline"
                              >
                                Buka Halaman
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
