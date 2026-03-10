import { Outlet, useParams } from 'react-router-dom';
import ClientHeader from './ClientHeader';
import SettingsPanel from './SettingsPanel';
import { useClient } from '../../hooks/useClient';

export default function AppLayout() {
  const { id: clientId } = useParams<{ id?: string }>();

  // Load client from IndexedDB when route has :id
  useClient();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-50">
      {/* Show client header only when viewing a client */}
      {clientId && <ClientHeader />}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* Settings slide-over */}
      <SettingsPanel />
    </div>
  );
}
