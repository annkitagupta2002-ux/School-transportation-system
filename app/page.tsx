"use client";

import { useEffect, useState, type ReactNode } from "react";

type Status = "Scheduled" | "On the way" | "At stop" | "Completed" | "Delayed";
type Stop = { name: string; area: string; time: string; status: "done" | "current" | "upcoming"; student?: string };

const initialStops: Stop[] = [
  { name: "Lakeview Apartments", area: "North Gate · Stop 01", time: "7:32 AM", status: "done", student: "Aarav Mehta" },
  { name: "Green Park Crossing", area: "Main Road · Stop 02", time: "7:40 AM", status: "done", student: "Anaya Sharma" },
  { name: "Rosewood Society", area: "Community Hall · Stop 03", time: "7:48 AM", status: "current", student: "Ishaan Kapoor" },
  { name: "Cedar Grove", area: "Block C · Stop 04", time: "7:56 AM", status: "upcoming", student: "Mira Patel" },
  { name: "Pinecrest School", area: "School entrance · Final stop", time: "8:10 AM", status: "upcoming" },
];

const initialEvents = [
  { icon: "✓", title: "Aarav was picked up", detail: "Lakeview Apartments · Stop 01", time: "7:32 AM", tone: "green" },
  { icon: "✓", title: "Anaya was picked up", detail: "Green Park Crossing · Stop 02", time: "7:40 AM", tone: "green" },
  { icon: "↗", title: "Bus is heading to Rosewood Society", detail: "Next stop · approx. 4 min", time: "7:43 AM", tone: "blue" },
];

function Icon({ name, size = 19 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const paths: Record<string, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-7h6v7"/></>,
    bus: <><path d="M5 17h14l1-3V6c0-1.1-.9-2-2-2H6C4.9 4 4 4.9 4 6v8l1 3Z"/><path d="M4 11h16M8 20v-3m8 3v-3M7 8h.01M17 8h.01"/><circle cx="7.5" cy="14" r="1"/><circle cx="16.5" cy="14" r="1"/></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    route: <><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h2a4 4 0 0 0 4-4V10a4 4 0 0 1 4-4"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    alert: <><path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  };
  return <svg {...common}>{paths[name] ?? paths.pin}</svg>;
}

export default function Home() {
  const [role, setRole] = useState("School admin");
  const [status, setStatus] = useState<Status>("On the way");
  const [stops, setStops] = useState(initialStops);
  const [events, setEvents] = useState(initialEvents);
  const [notice, setNotice] = useState("");
  const [showDelay, setShowDelay] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/route")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load route updates.");
        if (!active) return;
        setStatus(result.status as Status);
        if (Array.isArray(result.pickedUp)) {
          setStops((current) => current.map((stop) => result.pickedUp.includes(stop.student) ? { ...stop, status: "done" } : stop));
        }
        if (Array.isArray(result.activity) && result.activity.length) {
          setEvents((current) => [...result.activity.map((event: { title: string; time: string }) => ({ icon: "↗", title: event.title, detail: "Route 08 · shared with families", time: event.time, tone: "blue" })), ...current]);
        }
      })
      .catch((error: unknown) => {
        if (active) setNotice(error instanceof Error ? error.message : "Could not load route updates.");
      });
    return () => { active = false; };
  }, []);

  async function updateStatus(next: Status) {
    try {
      const response = await fetch("/api/route", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not update the route.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not reach the route service. Please try again.");
      return;
    }
    setStatus(next);
    const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const messages: Record<Status, string> = {
      Scheduled: "Route 08 has been scheduled", "On the way": "Bus 08 is on the way", "At stop": "Bus 08 has arrived at Rosewood Society", Completed: "Route 08 has arrived at Pinecrest School", Delayed: "A delay was reported on Route 08",
    };
    setEvents((current) => [{ icon: next === "Delayed" ? "!" : "↗", title: messages[next], detail: next === "Delayed" ? "School and families have been notified" : "Route 08 · updated just now", time, tone: next === "Delayed" ? "amber" : "blue" }, ...current]);
    setNotice(`${messages[next]} · visible to families`);
    window.setTimeout(() => setNotice(""), 3500);
    setShowDelay(false);
  }

  async function markPickedUp(stop: Stop, index: number) {
    try {
      const response = await fetch("/api/route", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pickedUp: stop.student }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save the pickup.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not reach the route service. Please try again.");
      return;
    }
    const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setStops((current) => current.map((item, i) => i === index ? { ...item, status: "done" } : i === index + 1 && item.status === "upcoming" ? { ...item, status: "current" } : item));
    setEvents((current) => [{ icon: "✓", title: `${stop.student} was picked up`, detail: stop.name, time, tone: "green" }, ...current]);
    setNotice(`${stop.student} marked as picked up · family notified`);
    window.setTimeout(() => setNotice(""), 3500);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#home"><span className="brand-mark"><Icon name="route" size={21}/></span><span className="brand-name">waypoint<span>.</span><small>SCHOOL TRANSPORT</small></span></a>
        <div className="school-switch"><div className="school-avatar">P</div><div className="school-copy"><strong>Pinecrest School</strong><span>North Campus</span></div><span className="chevron">⌄</span></div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="nav-list" aria-label="Main navigation">
          <button className="nav-item"><Icon name="home"/> Overview</button>
          <button className="nav-item active"><Icon name="bus"/> Live routes <span className="nav-count">3</span></button>
          <button className="nav-item"><Icon name="pin"/> Stops & routes</button>
          <button className="nav-item"><Icon name="users"/> Students</button>
          <button className="nav-item"><Icon name="bell"/> Notifications <span className="unread-dot"/></button>
        </nav>
        <div className="sidebar-bottom"><div className="help-card"><span className="help-icon"><Icon name="shield" size={17}/></span><strong>Every ride, accounted for.</strong><p>Trip updates are shared with families in real time.</p><a href="#activity">How it works <Icon name="arrow" size={14}/></a></div><div className="profile-row"><div className="profile-avatar">RK</div><div className="profile-copy"><strong>Riya Khanna</strong><span>Transport coordinator</span></div><button className="icon-button" aria-label="More profile options"><Icon name="more"/></button></div></div>
      </aside>

      <main className="main-area" id="home">
        <header className="topbar"><div className="breadcrumbs">Pinecrest School <span>/</span> Transport <span>/</span> <strong>Live routes</strong></div><div className="top-actions"><span className="today-label">Wednesday, 19 November</span><button className="top-icon" aria-label="Notifications"><Icon name="bell" size={18}/><i/></button><div className="top-avatar">RK</div></div></header>
        <div className="page-content">
          <section className="page-heading"><div><div className="eyebrow"><span className="live-pulse"/> LIVE TRANSPORT</div><h1>Good morning, Riya <span className="wave">✳</span></h1><p>Here’s what’s happening across your school routes today.</p></div><div className="heading-actions"><label className="role-switch">Viewing as <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Choose your view"><option>School admin</option><option>Driver</option><option>Parent</option></select><span>⌄</span></label><button className="outline-button" onClick={() => { setNotice("Shareable family update link copied"); window.setTimeout(() => setNotice(""), 3000); }}><Icon name="arrow" size={16}/> Share update</button></div></section>

          <section className="stats-grid" aria-label="Today's transport summary">
            <div className="stat-card"><div className="stat-top"><span>ACTIVE ROUTES</span><span className="stat-icon lilac"><Icon name="route" size={17}/></span></div><div className="stat-value">3 <small>/ 8</small></div><div className="stat-foot"><span className="mini-bars"><i/><i/><i/><i/><i/><i/><i/></span><span>routes on the road</span></div></div>
            <div className="stat-card"><div className="stat-top"><span>STUDENTS ONBOARD</span><span className="stat-icon mint"><Icon name="users" size={17}/></span></div><div className="stat-value">42 <small>/ 68</small></div><div className="stat-foot"><span className="foot-dot green-dot"/> 26 students picked up</div></div>
            <div className="stat-card"><div className="stat-top"><span>ON-TIME ARRIVALS</span><span className="stat-icon butter"><Icon name="clock" size={17}/></span></div><div className="stat-value">96<small>%</small></div><div className="stat-foot"><span className="foot-positive">↑ 4%</span><span>from last week</span></div></div>
            <div className="stat-card"><div className="stat-top"><span>NEEDS ATTENTION</span><span className="stat-icon blush"><Icon name="alert" size={17}/></span></div><div className="stat-value">1 <small>route</small></div><div className="stat-foot"><span className="attention-copy">Route 03 · 8 min delay</span></div></div>
          </section>

          <section className="content-grid">
            <div className="panel route-panel"><div className="panel-heading"><div><div className="section-kicker">ROUTE OVERVIEW</div><h2>Morning routes <span className="heading-date">· Wednesday, Nov 19</span></h2></div><button className="small-select">All routes <span>⌄</span></button></div>
              <div className="route-card"><div className="route-card-top"><div className="route-ident"><div className="route-icon"><Icon name="bus" size={20}/></div><div><h3>Route 08 <span className="route-status"><i/>{status}</span></h3><p>North Campus · RTE-008</p></div></div><button className="icon-button route-more" aria-label="Route options"><Icon name="more"/></button></div>
                <div className="route-meta"><div><span className="meta-label">DRIVER</span><span className="driver-name"><span className="driver-avatar">AS</span> Amit Singh <span className="verified">✓</span></span></div><div><span className="meta-label">VEHICLE</span><strong className="vehicle-value">School bus <span>·</span> KA 05 MN 2048</strong></div><div><span className="meta-label">EST. ARRIVAL</span><strong className="eta-value">8:10 AM <span>· 17 min</span></strong></div></div>
                <div className="map-view" aria-label="Illustrated map showing the route from Lakeview Apartments to Pinecrest School"><div className="map-grid"/><div className="map-park park-one"><span>MAPLE GARDENS</span></div><div className="map-park park-two"><span>COMMUNITY PARK</span></div><div className="map-block block-one"/><div className="map-block block-two"/><div className="map-block block-three"/><div className="map-block block-four"/><div className="map-label label-lake">LAKEVIEW APARTMENTS</div><div className="map-label label-green">GREEN PARK</div><div className="map-label label-pine">PINECREST SCHOOL</div><svg className="route-drawing" viewBox="0 0 720 250" preserveAspectRatio="none" aria-hidden="true"><path className="route-shadow" d="M103 169 L208 169 Q231 169 231 144 L231 104 Q231 82 253 82 L374 82 Q396 82 396 105 L396 146 Q396 168 420 168 L529 168 Q552 168 552 146 L552 81 Q552 60 574 60 L633 60"/><path className="route-line" d="M103 169 L208 169 Q231 169 231 144 L231 104 Q231 82 253 82 L374 82 Q396 82 396 105 L396 146 Q396 168 420 168 L529 168 Q552 168 552 146 L552 81 Q552 60 574 60 L633 60"/></svg><span className="map-stop stop-one done-stop">✓</span><span className="map-stop stop-two done-stop">✓</span><span className="map-stop stop-three current-stop"><span/></span><span className="map-stop stop-four">4</span><span className="map-destination"><Icon name="home" size={15}/></span><div className="bus-marker"><Icon name="bus" size={16}/></div><div className="map-scale"><span/> 500 m</div><div className="map-attribution">DEMO ROUTE · NORTH CAMPUS</div></div>
                <div className="route-progress"><div className="progress-copy"><span><b>2 of 4</b> stops completed</span><span>Next stop in <b>4 min</b></span></div><div className="progress-track"><i/></div></div>
                <div className="route-footer"><div className="avatar-stack"><span>AM</span><span>AS</span><small>4 students on this route</small></div><button className="text-button" onClick={() => setNotice("Full route details opened · Route 08")} >View route details <Icon name="arrow" size={15}/></button></div>
              </div>
              <div className="other-routes"><div className="other-route-row"><span className="other-route-icon"><Icon name="bus" size={17}/></span><span className="other-route-title"><b>Route 03</b><small>South Campus · 12 students</small></span><span className="delay-pill"><i/> Delayed 8 min</span><span className="other-eta">8:22 AM</span><button className="row-arrow" aria-label="Open Route 03"><Icon name="arrow" size={16}/></button></div><div className="other-route-row"><span className="other-route-icon"><Icon name="bus" size={17}/></span><span className="other-route-title"><b>Route 05</b><small>East Campus · 9 students</small></span><span className="on-time-pill"><i/> On time</span><span className="other-eta">8:18 AM</span><button className="row-arrow" aria-label="Open Route 05"><Icon name="arrow" size={16}/></button></div></div>
            </div>

            <aside className="right-column"><section className="panel activity-panel" id="activity"><div className="panel-heading activity-heading"><div><div className="section-kicker">HAPPENING NOW</div><h2>Live activity</h2></div><span className="live-badge"><i/> Live</span></div><div className="activity-list">{events.slice(0, 5).map((event, i) => <div className="activity-item" key={`${event.title}-${i}`}><span className={`activity-icon ${event.tone}`}>{event.icon}</span><div className="activity-copy"><strong>{event.title}</strong><span>{event.detail}</span></div><time>{event.time}</time></div>)}</div><button className="activity-link" onClick={() => setNotice("You’re viewing the latest route activity")}>View all activity <Icon name="arrow" size={15}/></button></section>

              <section className="panel stops-panel"><div className="panel-heading stops-heading"><div><div className="section-kicker">ROUTE 08 · LIVE</div><h2>Today’s stops</h2></div><span className="stop-count">4 stops</span></div><div className="stop-list">{stops.map((stop, i) => <div className={`stop-row ${stop.status}`} key={stop.name}><div className="stop-rail"><span className="stop-marker">{stop.status === "done" ? "✓" : stop.status === "current" ? <i/> : i + 1}</span>{i < stops.length - 1 && <span className="stop-connector"/>}</div><div className="stop-copy"><div className="stop-title-row"><strong>{stop.name}</strong><time>{stop.time}</time></div><span>{stop.area}{stop.student ? ` · ${stop.student}` : ""}</span>{stop.status === "current" && <div className="stop-current-label"><i/> {role === "Driver" ? "You’re at this stop" : "Bus is 4 min away"}</div>}</div>{role === "Driver" && stop.status === "current" && <button className="pickup-button" onClick={() => markPickedUp(stop, i)}>Picked up</button>}</div>)}</div><div className="parent-preview"><div className="parent-preview-icon"><Icon name="users" size={16}/></div><div><strong>Families are in the loop</strong><span>Pickup updates reach parents instantly.</span></div><span className="sent-check">✓</span></div></section>
            </aside>
          </section>

          <section className="driver-toolbar"><div className="driver-toolbar-copy"><span className="driver-toolbar-icon"><Icon name="bus" size={18}/></span><div><strong>{role === "Driver" ? "Driver trip controls" : "Quick trip updates"}</strong><span>{role === "Driver" ? "Update your route as you go" : "Send a live update to families on Route 08"}</span></div></div><div className="driver-actions"><button className="update-button" onClick={() => updateStatus("At stop")}><Icon name="pin" size={16}/> Arrived at stop</button><button className="update-button" onClick={() => updateStatus("On the way")}><Icon name="bus" size={16}/> Back on route</button><button className="delay-button" onClick={() => setShowDelay(true)}><Icon name="clock" size={16}/> Report delay</button></div></section>
          <footer className="page-footer"><span><Icon name="shield" size={14}/> Student information is only shared with authorized families and staff.</span><span>Last synced just now <i/> All systems operational</span></footer>
        </div>
      </main>
      {notice && <div className="toast" role="status"><span>✓</span>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}
      {showDelay && <div className="modal-backdrop" onClick={() => setShowDelay(false)}><div className="delay-modal" role="dialog" aria-modal="true" aria-labelledby="delay-title" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setShowDelay(false)} aria-label="Close">×</button><div className="modal-icon"><Icon name="clock" size={21}/></div><div className="section-kicker">ROUTE 08 · FAMILY UPDATE</div><h2 id="delay-title">Report a delay</h2><p>Let the school and families on this route know what to expect.</p><label className="delay-label" htmlFor="delay-reason">Reason for delay</label><select id="delay-reason" className="delay-select"><option>Traffic congestion</option><option>Road closure</option><option>Vehicle issue</option><option>Other</option></select><label className="delay-label" htmlFor="delay-minutes">Estimated delay</label><select id="delay-minutes" className="delay-select"><option>About 5 minutes</option><option>About 10 minutes</option><option>About 15 minutes</option><option>More than 15 minutes</option></select><button className="confirm-delay" onClick={() => updateStatus("Delayed")}>Notify families <Icon name="arrow" size={16}/></button><span className="modal-note"><Icon name="shield" size={13}/> Sent only to families on Route 08</span></div></div>}
    </div>
  );
}
