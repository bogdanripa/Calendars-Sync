import { useEffect, useState, useRef } from "react";
import { BackendService, CalendarDocument } from "@genezio-sdk/Calendars-Sync";
import { AuthService } from "@genezio/auth";
import { useNavigate } from 'react-router-dom';
import "./App.css";
import SimpleTooltip from './simpleTooltip/simpleTooltip.js';
import Header from './Header.tsx';
import Footer from './Footer.tsx';

export default function App({authInstance}: {authInstance: AuthService}) {
  const navigate = useNavigate();
  const once = useRef(true);
  const [loading, setLoading] = useState(true);
  const [calendars, setCalendars] = useState<CalendarDocument[]>([]);

  const handleAdd = async () => {
    const url = await BackendService.getAuthUrl();
    // redirect to the authorization URL
    window.location.href = url;
  };

  const handleSignOut = async () => {
    await authInstance.logout();
    navigate('/');
  }

  const handleDelete = async (calendar_id: string) => {
    await BackendService.deleteCalendar(calendar_id);
    setCalendars(calendars.filter((calendar) => calendar.calendar_id !== calendar_id));
  }

  const handleSync = async () => {
    await BackendService.processMe();
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
    if (!once.current) return;
    once.current = true;

    BackendService.getCalendars().then((calendars) => {
      setCalendars(calendars);
      setLoading(false);
    }).catch(() => {
      navigate('/');
    });
  }, []);

  useEffect(() => {
    setTimeout(() => {
      if (calendars.length === 0) {
        new SimpleTooltip('.add', "Let's add a few calendars to sync");
      } else {
        new SimpleTooltip('.check:first-of-type', "S stands for source, D for destination. Click to toggle.");
      }
    }, 1000);
  }, [calendars]);

  return (
    <>
      <Header />
      <h3>Your calendars</h3>
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

        {calendars.length === 0 && !loading &&
          <li>
            <span>No calendars added yet</span>
          </li>
        }

        {loading &&
          <li>
            <span>Loading...</span>
          </li>
        }
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
