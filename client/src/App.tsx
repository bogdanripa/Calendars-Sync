import { useEffect, useState } from "react";
import { BackendService } from "@genezio-sdk/Calendars-Sync";
import { AuthService } from "@genezio/auth";
import { useNavigate } from 'react-router-dom';
import "./App.css";

export default function App({authInstance}: {authInstance: AuthService}) {
  let loaded = false;
  const navigate = useNavigate();

  const [connections, setConnections] = useState<any[]>([]);

  const handleAdd = async () => {
    const url = await BackendService.getAuthUrl();
    // redirect to the authorization URL
    window.location.href = url;
  };

  const handleSignOut = async () => {
    await authInstance.logout();
    navigate('/login');
  }

  const handleDelete = async (calendar_id: string) => {
    await BackendService.deleteConnection(calendar_id);
    setConnections(connections.filter((connection) => connection.calendar_id !== calendar_id));
  }

  useEffect(() => {
    if (loaded) return;
    loaded = true;

    let userToken = null;
    try {
      userToken = authInstance.getUserToken();
    } catch(e) {
      console.error(e);
    }
    if (!userToken) {
      navigate('/login');
      return;
    }

    BackendService.getConnections().then((connections) => {
      setConnections(connections);
    }).catch(() => {
      navigate('/login');
    });
  }, []);

  return (
    <>
      <h1>Calendar Sync App</h1>
      <ul className="accounts">
        {connections.map((connection) => (
          <li key={connection._id}>
            <span>{connection.calendar_id}</span>
            <button onClick={() => handleDelete(connection.calendar_id)}>Delete</button>
          </li>
        ))}
      </ul>

      <button onClick={handleAdd}>Add Account</button>
      <button onClick={handleSignOut}>Sign Out</button>
    </>
  );
}
