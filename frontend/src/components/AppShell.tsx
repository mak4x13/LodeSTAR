import { Activity, Menu, Radar, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

export function AppShell({ apiStatus }: { apiStatus: "checking" | "online" | "offline" }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="app-shell">
      <div className="utility-bar">
        <span>FOUNDER INTELLIGENCE / PRIVATE WORKSPACE</span>
        <span className={`api-state ${apiStatus}`}>
          <i /> {apiStatus === "checking" ? "CHECKING API" : apiStatus === "online" ? "API ONLINE" : "API OFFLINE"}
        </span>
      </div>
      <header className="top-nav">
        <NavLink to="/" className="brand" aria-label="LodeSTAR home">
          <Radar size={25} strokeWidth={2.4} />
          <span>LODESTAR</span>
        </NavLink>
        <nav className={open ? "nav-links open" : "nav-links"} aria-label="Primary navigation">
          <NavLink to="/" end onClick={() => setOpen(false)}><strong>For Investors</strong><small>Conviction</small></NavLink>
          <NavLink to="/apply" onClick={() => setOpen(false)}><strong>For Founders</strong><small>Get evaluated</small></NavLink>
        </nav>
        <div className="nav-meta">
          <Activity size={17} />
          <span>24H DECISION MODE</span>
        </div>
        <button className="icon-button menu-button" onClick={() => setOpen((value) => !value)} aria-label="Toggle navigation">
          {open ? <X size={21} /> : <Menu size={21} />}
        </button>
      </header>
      <main><Outlet /></main>
    </div>
  );
}
