import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { demoMode } = useAuth();

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        {demoMode && (
          <div className="demo-banner">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <strong>Demo Mode</strong> — backend is unreachable. All data is local and changes are not persisted to the server.
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
