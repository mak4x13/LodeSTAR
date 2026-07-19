export type Trend = "improving" | "stable" | "declining";
export type ScoreAxis = "founder" | "market" | "idea_vs_market";

export interface ThesisConfig {
  sectors: string[];
  stage: string | null;
  geography: string[];
  check_size_usd: number | null;
  ownership_target_percent: number | null;
  risk_appetite: "low" | "medium" | "high" | null;
  notes: string | null;
}

export interface FounderProfile {
  identity_key: string;
  name?: string | null;
  company_name?: string | null;
  email?: string | null;
  github_handle?: string | null;
  website?: string | null;
  location?: string | null;
  sector?: string | null;
  stage?: string | null;
  product_summary?: string | null;
  traction?: string | null;
  funding_status?: string | null;
  gaps?: string[];
}

export interface FounderRow {
  id: string;
  identity_key: string;
  name?: string | null;
  source: string;
  founder_score?: number | null;
  founder_score_trend?: Trend | null;
  profile: FounderProfile;
  created_at?: string;
  updated_at?: string;
}

export interface ScoreItem {
  id?: string;
  axis: ScoreAxis;
  score: number;
  trend: string;
  rationale: string;
  created_at?: string;
}

export interface EvidenceItem {
  id: string;
  claim: string;
  source_url?: string | null;
  source_snippet?: string | null;
  trust_score: number;
  evidence_type: "known_signal" | "statistical_association" | "no_signal";
  created_at?: string;
}

export interface ContradictionItem {
  id?: string;
  claim_a: string;
  claim_b: string;
  explanation: string;
  status: "unresolved" | "resolved";
  created_at?: string;
}

export interface TraceEvent {
  id: number;
  run_id: string;
  agent: string;
  step: string;
  message: string;
  evidence_ref?: string | null;
  confidence?: number | null;
  ts: string;
}

export interface MemoSection {
  title: string;
  bullets: string[];
  evidence_refs: string[];
}

export interface InvestmentMemo {
  founder_id: string;
  recommendation: "invest" | "continue_diligence" | "pass";
  recommendation_rationale: string;
  decision_conditions: string[];
  company_snapshot: MemoSection;
  investment_hypotheses: MemoSection;
  swot: MemoSection;
  problem_and_product: MemoSection;
  traction_and_kpis: MemoSection;
  explicit_gaps: string[];
}
