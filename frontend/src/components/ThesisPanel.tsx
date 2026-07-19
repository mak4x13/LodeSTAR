import { Play, Save } from "lucide-react";
import { useEffect, useState } from "react";
import type { ThesisConfig } from "../types";

interface ThesisPanelProps {
  value: ThesisConfig;
  busy: boolean;
  onChange: (value: ThesisConfig) => void;
  onRun: (search: { mandate: string; limit: number }) => void;
}

export function ThesisPanel({ value, busy, onChange, onRun }: ThesisPanelProps) {
  const [mandate, setMandate] = useState("Technical founders building AI developer infrastructure with a working product, visible execution speed, and no prior institutional funding.");
  const [limit, setLimit] = useState(5);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 1600);
    return () => window.clearTimeout(timer);
  }, [saved]);

  const update = <K extends keyof ThesisConfig>(key: K, next: ThesisConfig[K]) => onChange({ ...value, [key]: next });
  const list = (text: string) => text.split(",").map((item) => item.trim()).filter(Boolean);

  return (
    <aside className="thesis-panel">
      <div className="thesis-head"><div><div className="panel-kicker">THESIS COMMAND CENTER</div><h2>Your edge, encoded.</h2></div><p className="panel-note">One conviction lens across discovery, diligence, and every decision.</p></div>
      <div className="thesis-grid">
        <label>Sectors<input value={value.sectors.join(", ")} onChange={(event) => update("sectors", list(event.target.value))} /></label>
        <label>Stage<input value={value.stage || ""} onChange={(event) => update("stage", event.target.value || null)} /></label>
        <label>Check size (USD)<input type="number" value={value.check_size_usd || ""} onChange={(event) => update("check_size_usd", Number(event.target.value) || null)} /></label>
        <label>Geography<input value={value.geography.join(", ")} onChange={(event) => update("geography", list(event.target.value))} /></label>
        <label>Ownership %<input type="number" value={value.ownership_target_percent || ""} onChange={(event) => update("ownership_target_percent", Number(event.target.value) || null)} /></label>
        <label>Risk appetite<select value={value.risk_appetite || ""} onChange={(event) => update("risk_appetite", (event.target.value || null) as ThesisConfig["risk_appetite"])}><option value="">Select</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
        <label className="notes-field">Investment notes<input value={value.notes || ""} onChange={(event) => update("notes", event.target.value || null)} /></label>
      </div>
      <div className="discovery-row">
        <div><div className="panel-kicker">DISCOVERY RADAR</div><p>Define the live signals worth finding now.</p></div>
        <label className="mandate-field">Natural-language search mandate<input value={mandate} onChange={(event) => setMandate(event.target.value)} /></label>
        <label>Founders per scan<select value={limit} onChange={(event) => setLimit(Number(event.target.value))}><option>3</option><option>5</option><option>8</option><option>10</option></select></label>
        <div className="thesis-actions"><button className="primary-button" disabled={busy || mandate.trim().length < 10} onClick={() => onRun({ mandate, limit })}><Play size={17} fill="currentColor" /> {busy ? "SCANNING..." : "SCAN FOUNDERS"}</button><button className="secondary-button" onClick={() => { setSaved(true); localStorage.setItem("lodestar-thesis", JSON.stringify(value)); }}><Save size={16} /> {saved ? "SAVED" : "SAVE"}</button></div>
      </div>
    </aside>
  );
}
