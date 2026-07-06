import { createRootRoute, Link, Outlet, redirect, useLocation, useRouter } from '@tanstack/react-router';
import { 
  LayoutDashboard, 
  Map as MapIcon, 
  Bell, 
  Settings as SettingsIcon, 
  LogOut, 
  Thermometer, 
  ShieldAlert 
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useEffect } from 'react';

export const Route = createRootRoute({
  beforeLoad: ({ location }) => {
    const { isLoggedIn } = useAppStore.getState();
    if (!isLoggedIn && location.pathname !== '/login') {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.pathname,
        },
      });
    }
  },
  component: RootLayout
});

function RootLayout() {
  const { isLoggedIn, role, currentUser, alerts, setRole, logout, tickSimulation } = useAppStore();
  const location = useLocation();
  const router = useRouter();

  // Run the background simulation tick every 3 seconds to update temperatures and trigger alerts
  useEffect(() => {
    if (!isLoggedIn) return;
    const interval = setInterval(() => {
      tickSimulation(new Date().toISOString());
    }, 3000);
    return () => clearInterval(interval);
  }, [isLoggedIn, tickSimulation]);

  // If path is /login, render without the shell
  if (location.pathname === '/login') {
    return (
      <div className="w-full min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Outlet />
      </div>
    );
  }

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextRole = e.target.value;
    if (nextRole === 'Admin' || nextRole === 'Operator' || nextRole === 'Viewer') {
      setRole(nextRole);
    }
  };

  const handleLogout = () => {
    logout();
    router.navigate({ to: '/login' });
  };

  // Filter alerts in the last 24 hours
  const alertCount = alerts.filter((alert) => {
    const alertTime = new Date(alert.timestamp).getTime();
    const now = Date.now();
    return now - alertTime <= 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div className="flex w-full min-h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col justify-between flex-shrink-0">
        <div>
          {/* Logo */}
          <div className="px-6 py-5 border-b border-zinc-800 flex items-center gap-2">
            <Thermometer className="h-6 w-6 text-indigo-500" />
            <span className="font-bold text-lg tracking-wider bg-gradient-to-r from-indigo-400 to-indigo-600 bg-clip-text text-transparent">
              TracerTemp
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            <Link
              to="/"
              activeProps={{ className: "bg-indigo-600/20 text-indigo-400 border-l-2 border-indigo-500 font-medium" }}
              inactiveProps={{ className: "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100" }}
              className="flex items-center gap-3 px-4 py-3 rounded-md transition-colors"
            >
              <LayoutDashboard className="h-5 w-5" />
              <span>Dashboard</span>
            </Link>

            <Link
              to="/map"
              activeProps={{ className: "bg-indigo-600/20 text-indigo-400 border-l-2 border-indigo-500 font-medium" }}
              inactiveProps={{ className: "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100" }}
              className="flex items-center gap-3 px-4 py-3 rounded-md transition-colors"
            >
              <MapIcon className="h-5 w-5" />
              <span>Floor Map</span>
            </Link>

            <Link
              to="/alerts"
              search={{}}
              activeProps={{ className: "bg-indigo-600/20 text-indigo-400 border-l-2 border-indigo-500 font-medium" }}
              inactiveProps={{ className: "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100" }}
              className="flex items-center gap-3 px-4 py-3 rounded-md transition-colors relative"
            >
              <ShieldAlert className="h-5 w-5" />
              <span>Alert History</span>
              {alertCount > 0 && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  {alertCount}
                </span>
              )}
            </Link>

            {role === 'Admin' && (
              <Link
                to="/settings"
                activeProps={{ className: "bg-indigo-600/20 text-indigo-400 border-l-2 border-indigo-500 font-medium" }}
                inactiveProps={{ className: "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100" }}
                className="flex items-center gap-3 px-4 py-3 rounded-md transition-colors"
              >
                <SettingsIcon className="h-5 w-5" />
                <span>Settings</span>
              </Link>
            )}
          </nav>
        </div>

        {/* User profile footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-indigo-700/50 flex items-center justify-center font-bold text-indigo-300 border border-indigo-500/30">
              {currentUser?.displayName.charAt(0) || 'U'}
            </div>
            <div className="overflow-hidden">
              <h4 className="font-medium text-sm text-zinc-200 truncate">{currentUser?.displayName}</h4>
              <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">{role}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-zinc-800 rounded-md hover:bg-red-950/20 hover:text-red-400 hover:border-red-900/50 transition-all text-sm text-zinc-400 font-medium cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header */}
        <header className="h-16 border-b border-zinc-800 bg-zinc-900 px-6 flex items-center justify-between flex-shrink-0 sticky top-0 z-10">
          <h2 className="text-lg font-semibold text-zinc-100 capitalize">
            {location.pathname === '/' ? 'Dashboard Overview' : location.pathname.substring(1).replace('/', ' / ')}
          </h2>

          <div className="flex items-center gap-6">
            {/* Simulation Active Indicator */}
            <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-semibold text-emerald-400">Live Sim Active</span>
            </div>

            {/* Role Simulation Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-medium">Switch Role:</span>
              <select
                value={role}
                onChange={handleRoleChange}
                className="bg-zinc-850 text-zinc-200 text-xs border border-zinc-700 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="Admin">Admin</option>
                <option value="Operator">Operator</option>
                <option value="Viewer">Viewer</option>
              </select>
            </div>

            {/* Alert Bell */}
            <Link 
              to="/alerts" 
              search={{}}
              className="relative p-2 text-zinc-400 hover:text-zinc-100 transition-colors"
              title="Alerts History"
            >
              <Bell className="h-5 w-5" />
              {alertCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {alertCount}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* Content Outlet */}
        <main className="flex-1 p-6 relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
