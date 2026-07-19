import { CircleDot, Radio } from "lucide-react";
import type { TraceEvent } from "../types";

const agentLabel = (agent: string) => agent.replace(/_agent$/, "").replace(/_/g, " ");

export type RealtimeStatus = "connecting" | "live" | "error" | "unavailable";

export function LiveFeed({ events, activeRun, running, realtimeStatus }: { events: TraceEvent[]; activeRun: string | null; running: boolean; realtimeStatus: RealtimeStatus }) {
  const statusLabel = realtimeStatus === "live" ? (running ? "STREAMING" : "LIVE") : realtimeStatus === "connecting" ? "CONNECTING" : "OFFLINE";
  const latestEvents = events.slice(0, 3);
  return (
    <aside className="feed-panel">
      <div className="feed-heading">
        <div><div className="panel-kicker">DECISION STREAM</div><h2>Intelligence, in motion.</h2></div>
        <span className={realtimeStatus === "live" ? "live-badge active" : realtimeStatus === "error" ? "live-badge error" : "live-badge"}><Radio size={14} /> {statusLabel}</span>
      </div>
      {activeRun && <div className="run-id">RUN {activeRun.slice(0, 8).toUpperCase()}</div>}
      <div className="feed-list" aria-live="polite">
        {latestEvents.map((event) => (
          <article className="feed-event" key={event.id}>
            <div className="event-rail"><CircleDot size={14} /><i /></div>
            <div><div className="event-meta"><span>{agentLabel(event.agent)}</span><time>{new Date(event.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div><strong>{event.step.replace(/_/g, " ")}</strong><p>{event.message}</p>{event.confidence != null && <small>Confidence {Math.round(event.confidence * 100)}%</small>}</div>
          </article>
        ))}
        {latestEvents.length === 0 && <div className="feed-empty"><Radio size={22} /><p>{realtimeStatus === "error" ? "Decision stream offline. Check Supabase Realtime for trace_events and founders." : "Every search, signal, score, and confidence shift will surface here as it happens."}</p></div>}
      </div>
    </aside>
  );
}
