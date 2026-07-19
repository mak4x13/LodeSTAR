import { ArrowDown, Clock3 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { FounderPipeline } from "../components/FounderPipeline";
import { LiveFeed, type RealtimeStatus } from "../components/LiveFeed";
import { ThesisPanel } from "../components/ThesisPanel";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import { loadThesis, saveThesis } from "../lib/thesis";
import type { FounderRow, ThesisConfig, TraceEvent } from "../types";

export default function Dashboard() {
  const [thesis, setThesis] = useState<ThesisConfig>(loadThesis);
  const [founders, setFounders] = useState<FounderRow[]>([]);
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [activeRun, setActiveRun] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>(supabase ? "connecting" : "unavailable");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await api.listFounders();
      setFounders(result.founders);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load founder memory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refresh]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    client.from("trace_events")
      .select("*")
      .order("ts", { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (data) setEvents(data as TraceEvent[]);
      });
    const channel = client.channel("lodestar-dashboard")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "founders" }, () => refresh())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "founders" }, () => refresh())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "trace_events" }, ({ new: row }) => {
        const event = row as TraceEvent;
        if (!activeRun || event.run_id === activeRun) setEvents((current) => [event, ...current].slice(0, 3));
      }).subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtimeStatus("live");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setRealtimeStatus("error");
        if (status === "CLOSED") setRealtimeStatus("unavailable");
      });
    return () => { client.removeChannel(channel); };
  }, [activeRun, refresh]);

  async function runSourcing(search: { mandate: string; limit: number }) {
    setRunning(true);
    setError(null);
    saveThesis(thesis);
    try {
      const result = await api.sourceMandate({ thesis, mandate: search.mandate, limit: search.limit });
      setActiveRun(result.run_id);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The sourcing run could not start.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="dashboard-page">
      <section className="mission-strip">
        <span className="eyebrow">AUTONOMOUS EARLY-STAGE INTELLIGENCE</span>
        <h1>BACK THE FOUNDERS<br />OTHERS HAVEN'T FOUND.</h1>
        <div className="mission-footer">
          <p>Source before the pitch. Separate proof from promise. Reach conviction while the market is still looking elsewhere.</p>
          <span><Clock3 size={17} /> TARGET: SIGNAL TO DECISION IN 24H</span>
          <button className="hero-scroll-button" onClick={() => document.getElementById("command-center")?.scrollIntoView({ behavior: "smooth" })}>Enter the command center <ArrowDown size={17} /></button>
        </div>
      </section>
      {error && <div className="error-banner" role="alert"><strong>Pipeline unavailable</strong><span>{error}</span><div className="error-actions"><button onClick={refresh}>Retry</button><button onClick={() => setError(null)}>Dismiss</button></div></div>}
      <div className="workspace-grid" id="command-center">
        <ThesisPanel value={thesis} busy={running} onChange={setThesis} onRun={runSourcing} />
        <FounderPipeline founders={founders} loading={loading} />
        <LiveFeed events={events} activeRun={activeRun} running={running} realtimeStatus={realtimeStatus} />
      </div>
    </div>
  );
}
