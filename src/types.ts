// Domain types mirrored from the Hedge Layer web app.
// Only the subset needed for CLI display and API interaction.

export interface MarketBriefMarket {
  question: string;
  slug: string;
  eventSlug?: string;
  yesPrice: number;
  relevance: number;
  causalLink: string;
  signals: string[];
  polymarketUrl: string;
  qualityScore?: number;
  volume?: number;
  liquidity?: number;
  endDate?: string;
}

export interface MarketBrief {
  title: string;
  thesis: string;
  markets: MarketBriefMarket[];
  watchlist: string[];
  gaps: string[];
  marketCount: number;
  createdAt: string;
}

export interface Market {
  id: string;
  question: string;
  slug: string;
  conditionId: string;
  clobTokenIds: string;
  outcomePrices: string;
  outcomes: string;
  volume: string;
  liquidity: string;
  endDate: string;
  active: boolean;
  closed: boolean;
  image?: string;
  description?: string;
}

export interface Assessment {
  id: string;
  user_id: string;
  status: string;
  market_brief: MarketBrief | null;
  messages: unknown[];
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  user_id: string;
  handle: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Feed result — matches getFeed tool output from the web agent
// ---------------------------------------------------------------------------

export interface FeedResultMarket {
  id?: string;
  rank: number;
  score: number;
  question: string;
  slug: string;
  eventSlug: string;
  yesTokenId?: string | null;
  noTokenId?: string | null;
  yesPrice: number;
  noPrice: number;
  probability?: number;
  volume24h: number;
  liquidity: number;
  spread: number;
  oneDayPriceChange: number;
  rewardsDailyRate: number;
  lpExpectedReturnDailyPct?: number;
  lpCapacity?: number;
  lpRiskFlags?: string[];
  daysToEnd?: number | null;
  active?: boolean;
  endDate: string;
  polymarketUrl: string;
  components: {
    volume: number;
    liquidity: number;
    movement: number;
    spread: number;
    recency: number;
    extremity: number;
    rewards: number;
    rewardYield?: number;
    lpExpectedReturn?: number;
    horizon?: number;
  };
}

export interface FeedResult {
  totalScanned: number;
  totalAfterFilter: number;
  marketsReturned: number;
  sortedBy: string;
  preset: string;
  markets: FeedResultMarket[];
  error?: string;
}

export interface ApiError {
  error: string;
}

export interface GlobalOptions {
  json?: boolean;
  apiUrl?: string;
  token?: string;
  verbose?: boolean;
}

// ---------------------------------------------------------------------------
// Signal analysis — mirrors POST /api/signal/analyze
// ---------------------------------------------------------------------------

export interface SignalMarketInput {
  market_name?: string;
  name?: string;
  question?: string;
  title?: string;
  market_description?: string;
  description?: string;
  rules?: string;
  yes_pct?: number;
  yes_prob?: number;
  current_yes_prob?: number;
  yesPrice?: number;
  no_pct?: number;
  no_prob?: number;
  current_no_prob?: number;
  noPrice?: number;
  market_link?: string;
  link?: string;
  url?: string;
  market_slug?: string;
  slug?: string;
  created_at?: string;
  createdAt?: string;
  end_date?: string;
  endDate?: string;
  end_date_iso?: string;
  [key: string]: unknown;
}

export interface SignalAnalysisRequest {
  url?: string;
  urls?: string[];
  market?: SignalMarketInput;
  markets?: SignalMarketInput[];
  previous_analysis_context?: string;
}

export interface SignalAnalysis {
  market_slug?: string;
  market_name?: string;
  market_link?: string;
  current_yes_prob?: number | null;
  current_no_prob?: number | null;
  predicted_prob?: number | null;
  confidence?: string;
  research_findings?: string;
  bayesian_analysis?: Record<string, unknown>;
  key_factors?: string[];
  probability_gap?: number | null;
  signal_strength?: "strong" | "weak" | "unknown" | string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface SignalAnalysisItem {
  agent?: string;
  analysis?: SignalAnalysis;
  raw_response?: string;
  [key: string]: unknown;
}

export interface SignalAnalysisResult extends SignalAnalysisItem {
  error?: string;
  analyses?: SignalAnalysisItem[];
  markets_analyzed?: number;
  strong_signal_count?: number;
  summary?: Record<string, unknown>;
  memory?: Record<string, unknown>;
}

export interface SignalAnalysisApiResponse {
  mode?: string;
  result?: SignalAnalysisResult;
  error?: string;
}

// ---------------------------------------------------------------------------
// Directional quote preview — mirrors POST /api/quote
// ---------------------------------------------------------------------------

export type QuoteAction = "BUY" | "SELL";
export type QuoteOutcome = "YES" | "NO";
export type QuoteRoute = "auto" | "aggressive" | "passive";
export type SelectedQuoteRoute = Exclude<QuoteRoute, "auto">;
export type QuoteStatus = "READY" | "PARTIAL" | "PASSIVE_ONLY" | "SKIP" | "UNAVAILABLE";

export type QuoteSize =
  | { type: "cash"; amount_usd: number }
  | { type: "shares"; shares: number };

export interface QuotePreviewRequest {
  instrument: string;
  action: QuoteAction;
  outcome: QuoteOutcome;
  size: QuoteSize;
  signal_forecast_id?: string;
  portfolio_capital_usd?: number;
  route?: QuoteRoute;
  max_slippage_bps?: number;
  kelly_fraction?: number;
  max_allocation_pct?: number;
  persist?: boolean;
}

export interface QuotePreviewInstrument {
  instrument_key: string;
  venue_instrument_id: string;
  slug: string;
  event_slug: string | null;
  question: string;
  market_url: string;
  condition_id: string;
  token_id: string;
  outcome: QuoteOutcome;
  [key: string]: unknown;
}

export interface QuotePreviewRequestSummary {
  action: QuoteAction;
  outcome: QuoteOutcome;
  size: QuoteSize;
  route_requested: QuoteRoute;
  route_selected: SelectedQuoteRoute;
  max_slippage_bps: number;
  [key: string]: unknown;
}

export interface QuotePreviewMarket {
  active: boolean;
  closed: boolean;
  accepting_orders: boolean;
  end_date: string | null;
  game_start_time: string | null;
  best_bid: number | null;
  best_ask: number | null;
  spread: number | null;
  bid_depth_shares: number;
  ask_depth_shares: number;
  minimum_order_size: number | null;
  tick_size: number | null;
  [key: string]: unknown;
}

export interface QuotePreviewFill {
  requested_cash_usd: number | null;
  requested_shares: number | null;
  quoted_shares: number;
  fillable_shares: number | null;
  safety_capped_shares: number;
  fill_ratio: number | null;
  full_request: boolean;
  average_price: number | null;
  worst_price: number | null;
  slippage_bps: number | null;
  passive_limit_price: number | null;
  fill_guaranteed: false;
  [key: string]: unknown;
}

export interface QuotePreviewEconomics {
  gross_notional_usd: number;
  venue_fee_usd: number | null;
  fee_rate: number | null;
  fee_exponent: number | null;
  fee_source: "clob_market_info" | null;
  all_in_cost_usd: number | null;
  net_proceeds_usd: number | null;
  max_loss_usd: number | null;
  max_payout_usd: number | null;
  max_profit_usd: number | null;
  foregone_payout_usd: number | null;
  break_even_probability: number | null;
  [key: string]: unknown;
}

export interface QuotePreviewSignal {
  id: string | null;
  source: "saved" | "inline";
  forecast_yes: number;
  lower_bound: number;
  upper_bound: number;
  outcome_probability: number;
  conservative_probability: number;
  midpoint_edge: number | null;
  conservative_edge: number | null;
  [key: string]: unknown;
}

export interface QuoteSizingSuggestion {
  method: "fractional_kelly";
  kelly_fraction: number;
  max_allocation_pct: number;
  raw_edge_fraction: number;
  allocation_fraction: number;
  suggested_max_spend_usd: number;
  suggested_shares: number;
  [key: string]: unknown;
}

export interface QuotePreview {
  schema_version: 1;
  id: string | null;
  status: QuoteStatus;
  venue: "polymarket";
  instrument: QuotePreviewInstrument;
  request: QuotePreviewRequestSummary;
  market: QuotePreviewMarket;
  fill: QuotePreviewFill;
  economics: QuotePreviewEconomics;
  signal: QuotePreviewSignal | null;
  sizing_suggestion: QuoteSizingSuggestion | null;
  risks: string[];
  observed_at: string;
  expires_at: string;
  execution: {
    supported: false;
    reason: "preview_only";
    [key: string]: unknown;
  };
  error?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Brief API request/response
// ---------------------------------------------------------------------------

export interface BriefRequestFilters {
  minVolume?: number;
  maxYesPrice?: number;
  tags?: string[];
}

export interface BriefRequest {
  query: string;
  location?: string;
  timeHorizon?: string;
  filters?: BriefRequestFilters;
  stream: true;
}
