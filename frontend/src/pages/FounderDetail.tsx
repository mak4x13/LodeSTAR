import { ArrowLeft, ArrowUpRight, Check, FileText, Github, Globe, LoaderCircle, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { founderDisplay } from "../lib/display";
import { loadThesis } from "../lib/thesis";
import type { ContradictionItem, EvidenceItem, FounderRow, InvestmentMemo, MemoSection, ScoreItem } from "../types";

const axisName: Record<string, string> = { founder: "Founder", market: "Market", idea_vs_market: "Idea vs. market" };
type ActionReport = { title: string; runId: string; metrics: { label: string; value: string; detail: string }[] };

function ScoreCard({ item }: { item?: ScoreItem }) {
  return <div className="axis-score"><span>{item ? axisName[item.axis] : "Pending"}</span><strong>{item ? Math.round(item.score) : "--"}<small>/100</small></strong><div><i style={{ width: `${item?.score || 0}%` }} /></div><p>{item?.rationale || "Awaiting enough evidence to form a view."}</p></div>;
}

function MemoBlock({ section, evidence }: { section: MemoSection; evidence: EvidenceItem[] }) {
  return <section className="memo-section"><h3>{section.title}</h3><ul>{section.bullets.map((bullet, index) => <li key={index}>{bullet}</li>)}</ul>{section.evidence_refs.length > 0 && <div className="memo-refs">{section.evidence_refs.map((ref) => {
    const match = evidence.find((item) => item.id === ref || item.source_url === ref || item.claim === ref);
    const href = match ? `#evidence-${match.id}` : ref.startsWith("http") ? ref : "#evidence-ledger";
    return <a key={ref} href={href} target={ref.startsWith("http") && !match ? "_blank" : undefined} rel={ref.startsWith("http") && !match ? "noreferrer" : undefined}>EVIDENCE {ref.slice(0, 8)} <ArrowUpRight size={11} /></a>;
  })}</div>}</section>;
}

export default function FounderDetail() {
  const { id = "" } = useParams();
  const [founder, setFounder] = useState<FounderRow | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [scores, setScores] = useState<ScoreItem[]>([]);
  const [contradictions, setContradictions] = useState<ContradictionItem[]>([]);
  const [memo, setMemo] = useState<InvestmentMemo | null>(null);
  const [decisionTiming, setDecisionTiming] = useState<{ seconds: number; within24h: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionReport, setActionReport] = useState<ActionReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const result = await api.getFounder(id);
      setFounder(result.founder);
      setEvidence(result.evidence);
      setScores(result.scores);
      setContradictions(result.contradictions);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Founder record could not be loaded.");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [id]);

  const latestScores = useMemo(() => Object.values([...scores]
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
    .reduce<Record<string, ScoreItem>>((result, item) => ({ ...result, [item.axis]: item }), {})), [scores]);

  async function run(kind: "screen" | "diligence" | "memo") {
    setAction(kind); setError(null); setActionError(null); setActionStatus(null);
    try {
      if (kind === "memo") {
        const result = await api.decision(id, loadThesis());
        setMemo(result.memo);
        setDecisionTiming({ seconds: result.decision_time_seconds, within24h: result.within_24h });
        setActionStatus("Decision memo rebuilt from the latest evidence.");
        window.setTimeout(() => document.getElementById("decision-memo")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      } else {
        const previousByAxis = Object.fromEntries(latestScores.map((item) => [item.axis, item.score]));
        const previousTrust = evidence.length ? evidence.reduce((sum, item) => sum + item.trust_score, 0) / evidence.length : 0;
        const result = await (kind === "screen" ? api.screen(id, loadThesis()) : api.diligence(id, loadThesis()));
        await load();
        if (kind === "screen") {
          setActionReport({
            title: "Conviction recalculated",
            runId: result.run_id,
            metrics: result.scores.map((item) => {
              const before = previousByAxis[item.axis];
              const delta = before == null ? null : item.score - before;
              return { label: axisName[item.axis], value: `${Math.round(item.score)}/100`, detail: delta == null ? "First scored view" : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} from prior view` };
            }),
          });
        } else {
          const nextTrust = result.evidence.length ? result.evidence.reduce((sum, item) => sum + item.trust_score, 0) / result.evidence.length : 0;
          const highTrust = result.evidence.filter((item) => item.trust_score >= .75).length;
          const unsupported = result.evidence.filter((item) => item.evidence_type === "no_signal").length;
          setActionReport({ title: "Evidence challenge complete", runId: result.run_id, metrics: [
            { label: "Average trust", value: `${Math.round(nextTrust * 100)}%`, detail: `${nextTrust - previousTrust >= 0 ? "+" : ""}${Math.round((nextTrust - previousTrust) * 100)} points after review` },
            { label: "High-trust claims", value: String(highTrust), detail: `${result.evidence.length} claims reviewed` },
            { label: "Unsupported claims", value: String(unsupported), detail: unsupported ? "Flagged for investor attention" : "No unsupported claims retained" },
          ] });
        }
        setActionStatus(kind === "screen" ? "New scores are live in Founder Memory." : "Trust review is live in the Evidence Ledger.");
        const target = kind === "screen" ? "conviction-axes" : "evidence-ledger";
        window.setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "The agent run failed.";
      setActionError(message);
    }
    finally { setAction(null); }
  }

  if (loading) return <div className="page-loader"><LoaderCircle className="spin" /> Reconstructing the founder signal</div>;
  if (!founder) return <div className="not-found"><h1>This signal is not in memory.</h1><p>{error}</p><Link to="/">Return to conviction</Link></div>;
  const profile = founder.profile;
  const display = founderDisplay(founder);

  return (
    <div className="detail-page">
      <div className="detail-back"><Link to="/"><ArrowLeft size={17} /> Conviction</Link><span>FOUNDER MEMORY / {founder.id.slice(0, 8).toUpperCase()}</span></div>
      {error && <div className="error-banner" role="alert"><strong>Action failed</strong><span>{error}</span><button onClick={() => setError(null)}>Dismiss</button></div>}
      <header className="founder-hero">
        <div><span className="eyebrow">{profile.sector || "SECTOR UNRESOLVED"} / {profile.stage || "STAGE UNRESOLVED"}</span><h1>{display.company}</h1><p>{profile.product_summary || "The product thesis has not yet cleared the evidence threshold."}</p><div className="profile-links">{profile.github_handle && <a href={`https://github.com/${profile.github_handle}`} target="_blank" rel="noreferrer"><Github size={16} /> {profile.github_handle}</a>}{profile.website && <a href={profile.website} target="_blank" rel="noreferrer"><Globe size={16} /> Website</a>}</div></div>
        <div className="hero-score"><span>FOUNDER SCORE</span><strong>{founder.founder_score == null ? "--" : Math.round(Number(founder.founder_score))}</strong><small className={founder.founder_score_trend || "stable"}>{founder.founder_score_trend || "Unscored"}</small></div>
      </header>
      <div className="founder-facts"><div><span>FOUNDER</span><strong>{display.person}</strong></div><div><span>ORIGIN SIGNAL</span><strong>{founder.source.replace(/_/g, " ")}</strong></div><div><span>LOCATION</span><strong>{profile.location || "Unresolved"}</strong></div><div><span>EVIDENCE</span><strong>{evidence.length} claims logged</strong></div></div>

      <div className="detail-actions">
        <button className="primary-button" onClick={() => run("memo")} disabled={!!action}>{action === "memo" ? <LoaderCircle className="spin" size={17} /> : <FileText size={17} />} Build decision memo</button>
        <button className="secondary-button" onClick={() => run("diligence")} disabled={!!action}>{action === "diligence" ? <LoaderCircle className="spin" size={17} /> : <ShieldCheck size={17} />} Challenge the evidence</button>
        <button className="secondary-button" onClick={() => run("screen")} disabled={!!action}>{action === "screen" ? <LoaderCircle className="spin" size={17} /> : <RefreshCw size={17} />} Recalculate conviction</button>
      </div>
      {actionError && <div className="action-error" role="alert"><strong>Action could not complete</strong><span>{actionError}</span><button onClick={() => setActionError(null)}>Dismiss</button></div>}
      {actionStatus && <div className="action-status" role="status"><Check size={16} /> {actionStatus}<button onClick={() => setActionStatus(null)}>Dismiss</button></div>}
      {actionReport && <aside className="action-report" aria-live="polite"><header><div><span className="panel-kicker">LATEST AGENT RUN</span><h3>{actionReport.title}</h3></div><code>{actionReport.runId.slice(0, 8).toUpperCase()}</code></header><div>{actionReport.metrics.map((metric) => <section key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></section>)}</div></aside>}

      <section className="detail-section" id="conviction-axes"><div className="section-heading"><span>01</span><div><div className="panel-kicker">THREE-AXIS CONVICTION</div><h2>No averages. No hidden disagreement.</h2></div></div><div className="axis-grid">{(["founder", "market", "idea_vs_market"] as const).map((axis) => <ScoreCard key={axis} item={latestScores.find((item) => item.axis === axis)} />)}</div></section>

      <section className="detail-section" id="evidence-ledger"><div className="section-heading"><span>02</span><div><div className="panel-kicker">EVIDENCE LEDGER</div><h2>Every conclusion leaves a trail.</h2></div></div><div className="evidence-list">{evidence.map((item) => <article className="evidence-row" id={`evidence-${item.id}`} key={item.id}><div className={`trust-score ${item.trust_score >= .75 ? "high" : item.trust_score >= .5 ? "medium" : "low"}`}><strong>{Math.round(item.trust_score * 100)}</strong><span>TRUST</span></div><div><span className="evidence-type">{item.evidence_type.replace(/_/g, " ")}</span><h3>{item.claim}</h3>{item.source_snippet && <p>{item.source_snippet}</p>}{item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer">Inspect source <ArrowUpRight size={14} /></a>}</div><Check size={17} className="evidence-check" /></article>)}{evidence.length === 0 && <div className="flat-empty">Conviction is on hold until evidence arrives.</div>}</div></section>

      <section className="detail-section contradiction-section"><div className="section-heading"><span>03</span><div><div className="panel-kicker">CONTRADICTION REGISTER</div><h2>Conflicting claims cannot hide.</h2></div></div><div className="contradiction-list">{contradictions.map((item, index) => <article key={item.id || `${item.claim_a}-${index}`}><header><span>{item.status}</span><strong>Conflict {String(index + 1).padStart(2, "0")}</strong></header><div><p>{item.claim_a}</p><b>VERSUS</b><p>{item.claim_b}</p></div><small>{item.explanation}</small></article>)}{contradictions.length === 0 && <div className="flat-empty">No conflicting claims are currently registered.</div>}</div></section>

      <section className="detail-section gaps-section"><div className="section-heading"><span>04</span><div><div className="panel-kicker">OPEN QUESTIONS</div><h2>Unknown is a decision input.</h2></div></div><div className="gap-grid">{(profile.gaps || []).map((gap, index) => <div key={gap}><span>{String(index + 1).padStart(2, "0")}</span><p>{gap}</p></div>)}{(!profile.gaps || profile.gaps.length === 0) && <div className="flat-empty">No material unknowns are currently logged.</div>}</div></section>

      {memo && <section className="memo-document" id="decision-memo"><header><div><span className="eyebrow">DECISION BRIEF / EVIDENCE BACKED</span><h2>{display.company}</h2></div><div className="decision-outcome"><span className={`recommendation-badge ${memo.recommendation}`}>{memo.recommendation.replace("_", " ")}</span>{decisionTiming && <small>{decisionTiming.within24h ? "24H TARGET MET" : "24H TARGET MISSED"} / {decisionTiming.seconds < 3600 ? `${Math.max(1, Math.round(decisionTiming.seconds / 60))}M` : `${(decisionTiming.seconds / 3600).toFixed(1)}H`}</small>}</div></header><div className="recommendation-panel"><div><span>RECOMMENDATION</span><h3>{memo.recommendation.replace("_", " ")}</h3><p>{memo.recommendation_rationale}</p></div><div><span>CONDITIONS TO PROCEED</span>{memo.decision_conditions.length ? <ul>{memo.decision_conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul> : <p>No additional conditions were generated.</p>}</div></div><div className="memo-grid"><MemoBlock section={memo.company_snapshot} evidence={evidence} /><MemoBlock section={memo.investment_hypotheses} evidence={evidence} /><MemoBlock section={memo.swot} evidence={evidence} /><MemoBlock section={memo.problem_and_product} evidence={evidence} /><MemoBlock section={memo.traction_and_kpis} evidence={evidence} /><section className="memo-section"><h3>Open questions</h3><ul>{memo.explicit_gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul></section></div></section>}
    </div>
  );
}
