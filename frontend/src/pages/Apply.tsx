import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { ArrowRight, CheckCircle2, FileText, LoaderCircle, Mic, MicOff, Radio } from "lucide-react";
import { FormEvent, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { loadThesis } from "../lib/thesis";

const INTERVIEWER_PROMPT = `You are the LodeSTAR VC founder interviewer for a $100K pre-seed investment evaluation. You are not a general-purpose assistant. Never ask "How can I assist you?" and never wait for the founder to choose a topic.

Lead a natural, rigorous interview by asking exactly one concise question at a time. Begin with the founder's name, company, and one-sentence description. Then adapt your follow-ups to evaluate: the problem and urgency; target customer and market; product and differentiation; founder insight and founder-market fit; team and execution history; prototype or technical evidence; traction and measurable KPIs; business model; competitors; funding status; key risks; and the next milestone achievable with $100K.

Probe vague answers for concrete examples, dates, numbers, or observable evidence. Respect first-time and pre-track-record founders: evaluate learning speed, insight, resourcefulness, and demonstrated execution without treating lack of funding, network, or pedigree as failure. Politely surface contradictions and ask the founder to reconcile them. Do not invent facts, coach answers, promise funding, or reveal a final investment decision.

After covering the topics, give a short factual recap separating verified claims from unknowns, ask the founder to correct it, then thank them and say the interview is complete.`;

const INTERVIEWER_OPENING = "Welcome to LodeSTAR's founder evaluation. I'll ask one question at a time so we can understand both your venture and your ability to execute. To begin, what is your name, your company's name, and what are you building in one sentence?";

function VoiceInterview({ transcript, setTranscript }: { transcript: string; setTranscript: Dispatch<SetStateAction<string>> }) {
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const conversation = useConversation({
    onMessage: ({ role, message }) => {
      const speaker = role === "agent" ? "Interviewer" : "Founder";
      setTranscript((current) => `${current}${current ? "\n\n" : ""}${speaker}: ${message}`);
    },
    onError: (message) => setSessionError(message),
  });

  async function startInterview() {
    setStarting(true); setSessionError(null); setTranscript("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      const { signed_url } = await api.startVoiceSession();
      conversation.startSession({
        signedUrl: signed_url,
        connectionType: "websocket",
        overrides: {
          agent: {
            prompt: { prompt: INTERVIEWER_PROMPT },
            firstMessage: INTERVIEWER_OPENING,
          },
        },
      });
    } catch (reason) {
      setSessionError(reason instanceof Error ? reason.message : "The voice interview could not start.");
    } finally { setStarting(false); }
  }

  const active = conversation.status === "connected" || conversation.status === "connecting";
  return <>
    <div className={`voice-console ${active ? "active" : ""}`}>
      <div className="voice-pulse"><Mic size={24} /></div>
      <div><strong>{conversation.status === "connected" ? (conversation.isSpeaking ? "Interviewer is speaking" : "Your signal is live") : "Founder evaluation / voice"}</strong><p>No deck required. Your insight, evidence, and execution speak first.</p></div>
      {active
        ? <button type="button" className="secondary-button" onClick={() => conversation.endSession()}><MicOff size={16} /> End interview</button>
        : <button type="button" className="primary-button" onClick={startInterview} disabled={starting}>{starting ? <LoaderCircle className="spin" size={16} /> : <Mic size={16} />} Start interview</button>}
    </div>
    {sessionError && <div className="form-error">{sessionError}</div>}
    <label>Interview record *<textarea required minLength={20} rows={12} value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="Your conversation will appear here in real time." /></label>
  </>;
}

export default function Apply() {
  const [mode, setMode] = useState<"written" | "voice">("written");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ id: string; runId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");

  async function submitWritten(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null);
    const data = new FormData(event.currentTarget);
    try {
      data.set("thesis", JSON.stringify(loadThesis()));
      const response = await api.applyDeck(data);
      setResult({ id: response.founder.id, runId: response.run_id });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Application could not be processed."); }
    finally { setBusy(false); }
  }

  async function submitVoice(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const response = await api.submitTranscript({ transcript, thesis: loadThesis() });
      setResult({ id: response.founder.id, runId: response.run_id });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Transcript could not be processed."); }
    finally { setBusy(false); }
  }

  if (result) return <div className="intake-success"><CheckCircle2 size={40} /><span className="eyebrow">EVALUATION COMPLETE</span><h1>Your signal is on the map.</h1><p>One founder profile. Three independent scores. Every conclusion tied to evidence.</p><div>RUN ID <code>{result.runId}</code></div><Link className="primary-button" to={`/founders/${result.id}`}>See the conviction case <ArrowRight size={17} /></Link></div>;

  return (
    <div className="intake-page">
      <header className="intake-intro"><span className="eyebrow">OPEN ACCESS / FOUNDER EVALUATION</span><h1>DECK OR NO DECK.<br />PROVE THE SIGNAL.</h1><p>Upload the case or tell it live. Potential is judged by evidence, execution, and what remains honestly unproven.</p><div className="intake-points"><span><b>01</b> Founder intelligence</span><span><b>02</b> Evidence over pedigree</span><span><b>03</b> Independent conviction</span></div></header>
      <section className="intake-form-wrap">
        <div className="mode-tabs"><button className={mode === "written" ? "active" : ""} onClick={() => setMode("written")}><FileText size={17} /> Pitch deck</button><button className={mode === "voice" ? "active" : ""} onClick={() => setMode("voice")}><Mic size={17} /> Voice interview</button></div>
        {error && <div className="form-error">{error}</div>}
        {mode === "written" ? <form className="intake-form" onSubmit={submitWritten}><div className="field-row"><label>Company name *<input name="company_name" required placeholder="Acme Labs" /></label><label>Founder name<input name="founder_name" placeholder="Full name" /></label></div><div className="field-row"><label>Email<input name="email" type="email" placeholder="founder@company.com" /></label><label>GitHub handle<input name="github_handle" placeholder="username" /></label></div><label>Website<input name="website" type="url" placeholder="https://" /></label><label>Pitch deck (PDF, max 10 MB) *<input name="deck" type="file" accept="application/pdf,.pdf" required /></label><label>Founder context<textarea name="application_text" rows={5} placeholder="Anything the deck misses: recent traction, the hardest risk, or what $100K unlocks next." /></label><button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <ArrowRight size={17} />} Evaluate the deck</button></form> : <form className="intake-form" onSubmit={submitVoice}><div className="voice-status"><Radio size={18} /><div><strong>Potential, spoken plainly.</strong><p>A live investor-grade conversation becomes evidence for the same decision engine as every sourced founder.</p></div></div><ConversationProvider><VoiceInterview transcript={transcript} setTranscript={setTranscript} /></ConversationProvider><button className="primary-button" disabled={busy || transcript.length < 20}>{busy ? <LoaderCircle className="spin" size={17} /> : <ArrowRight size={17} />} Build the conviction case</button></form>}
      </section>
    </div>
  );
}
