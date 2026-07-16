import { Outlet } from 'react-router-dom';
import { CosmicBackground } from '../ui/CosmicBackground';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { JourneysProvider } from '../../lib/JourneysContext';

export function AppShell() {
  return (
    <JourneysProvider>
      <CosmicBackground />
      <TopBar />
      <div className="flex items-start" style={{ minHeight: 'calc(100vh - 58px)' }}>
        <Sidebar />
        <main className="max-w-[1180px] flex-1 px-9 pb-16 pt-8">
          <Outlet />
        </main>
      </div>
    </JourneysProvider>
  );
}
