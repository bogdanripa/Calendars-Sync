import { useEffect, useRef, useState } from "react";
import { BackendService } from "@genezio-sdk/Calendars-Sync";
import { AuthService } from "@genezio/auth";
import { useNavigate } from 'react-router-dom';
import "./App.css";

export default function App({authInstance}: {authInstance: AuthService}) {
  let loaded = false;
  const navigate = useNavigate();

  const [connections, setConnections] = useState<any[]>([]);

  const handleAdd = async () => {
    const accountNickname = prompt('Enter a nickname for this account');
    const url = await BackendService.getAuthUrl(accountNickname || 'default');
    // redirect to the authorization URL
    window.location.href = url;
  };

  const handleSignOut = async () => {
    await authInstance.logout();
    navigate('/login');
  }

  const handleDelete = async (accountNickname: string) => {
    await BackendService.deleteConnection(accountNickname);
    setConnections(connections.filter((connection) => connection.account_nickname !== accountNickname));
  }

  useEffect(() => {
    if (loaded) return;
    loaded = true;

    const userToken = authInstance.getUserToken();
    if (!userToken) {
      navigate('/login');
      return;
    }

    BackendService.getConnections().then((connections) => {
      setConnections(connections);
    });
  }, []);

  return (
    <>
      <h1>Calendar Sync App</h1>
      <ul>
        {connections.map((connection) => (
          <li key={connection._id}>
            {connection.account_nickname}
            <button onClick={() => handleDelete(connection.account_nickname)}>Delete</button>
          </li>
        ))}
      </ul>

      <button onClick={handleAdd}>Add Calendar</button>
      <button onClick={handleSignOut}>Sign Out</button>
    </>
  );
}
