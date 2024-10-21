import { useEffect, useState } from "react";
import { BackendService } from "@genezio-sdk/Calendars-Sync";
import { AuthService } from "@genezio/auth";
import { useNavigate } from 'react-router-dom';
import "./App.css";
import SimpleTooltip from './simpleTooltip/simpleTooltip.js';
import Footer from './Footer.tsx';


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

  const togleSource = async (calendar_id: string) => {
    await BackendService.toggleSource(calendar_id);
    const c = calendars.find((calendar) => calendar.calendar_id === calendar_id)
    c.source = !c.source;
    setCalendars([...calendars]);
  }

  const toggleDestination = async (calendar_id: string) => {
    await BackendService.toggleDestination(calendar_id);
    const c = calendars.find((calendar) => calendar.calendar_id === calendar_id)
    c.destination = !c.destination;
    setCalendars([...calendars]);
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

  useEffect(() => {
    setTimeout(() => {
      if (calendars.length === 0) {
        new SimpleTooltip('.add', "Next, let's add a few calendars to sync");
      } else {
        new SimpleTooltip('.check:first-of-type', "S stands for source, D for destination. Click to toggle.");
      }
    }, 1000);
  }, [calendars]);

  return (
    <>
      <h1>Calendar Sync App</h1>
      <ul className="accounts">
        {calendars.map((calendar) => (
          <li key={calendar._id}>
            <span>{calendar.calendar_id}</span>
            <div>
              <a href="#" title="Source" className={calendar.source?"check":""} onClick={() => togleSource(calendar.calendar_id)}>S</a>
              <a href="#" title="Destination" className={calendar.destination?"check":""} onClick={() => toggleDestination(calendar.calendar_id)}>D</a>
            </div>
            <button onClick={() => handleDelete(calendar.calendar_id)}>Delete</button>
          </li>
        ))}
      </ul>

      <button onClick={handleAdd} className="add">Add Calendar</button>
      {calendars.length > 0 &&
        <button onClick={handleSync}>Sync Calendars</button>
      }
      <button onClick={handleSignOut}>Sign Out</button>
      <Footer />
    </>
  );
}
