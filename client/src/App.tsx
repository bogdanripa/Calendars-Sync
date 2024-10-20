import { useEffect, useState } from "react";
import { BackendService } from "@genezio-sdk/Calendars-Sync";
import { AuthService } from "@genezio/auth";
import { useNavigate } from 'react-router-dom';
import "./App.css";

export default function App({authInstance}: {authInstance: AuthService}) {
  let loaded = false;
  const navigate = useNavigate();

  const [calendars, setCalendars] = useState<any[]>([]);

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
    await BackendService.deleteCalendar(calendar_id);
    setCalendars(calendars.filter((calendar) => calendar.calendar_id !== calendar_id));
  }

  const handleSync = async () => {
    await BackendService.processAllUsers();
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

    BackendService.getCalendars().then((calendars) => {
      setCalendars(calendars);
    }).catch(() => {
      navigate('/login');
    });
  }, []);

  return (
    <>
      <h1>Calendar Sync App</h1>
      <ul className="accounts">
        {calendars.map((calendar) => (
          <li key={calendar._id}>
            <span>{calendar.calendar_id}</span>
            <button onClick={() => handleDelete(calendar.calendar_id)}>Delete</button>
          </li>
        ))}
      </ul>

      <button onClick={handleAdd}>Add Calendar</button>
      {calendars.length > 0 &&
        <button onClick={handleSync}>Sync Calendars</button>
      }
      <button onClick={handleSignOut}>Sign Out</button>
    </>
  );
}
