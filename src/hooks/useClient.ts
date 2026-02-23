import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { db } from '../db';

export function useClient() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentClient, setCurrentClient } = useAppStore();

  useEffect(() => {
    if (!id) return;

    // If we already have the right client loaded, skip
    if (currentClient?.id === id) return;

    // Load client from DB
    const loadClient = async () => {
      const client = await db.clients.get(id);
      if (client) {
        setCurrentClient(client);
      } else {
        // Client not found, redirect to dashboard
        navigate('/');
      }
    };

    loadClient();
  }, [id, currentClient?.id, setCurrentClient, navigate]);

  return currentClient;
}
