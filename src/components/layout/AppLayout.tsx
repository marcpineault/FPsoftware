import { Outlet, useParams } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useClient } from '../../hooks/useClient';

export default function AppLayout() {
  const { id: clientId } = useParams<{ id?: string }>();

  // Load the client from IndexedDB into the store whenever the route has an :id
  useClient();
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-secondary">
      {/* Sidebar */}
      <Sidebar clientId={clientId} />

      {/* Main column: TopBar + content */}
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />

        <main
          className={`
            flex-1 overflow-y-auto p-6
            transition-all duration-300
          `}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
