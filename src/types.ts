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
// Wallet status and funds
// ---------------------------------------------------------------------------

export interface WalletRecord {
  id?: string;
  provider: string;
  email?: string | null;
  wallet_address: string;
  chain_id: number;
  metadata?: Record<string, unknown> | null;
  linked_at?: string;
  updated_at?: string;
}

export interface WalletStatus {
  linked: boolean;
  provider: string;
  wallet: WalletRecord | null;
  ownerWallet?: WalletRecord | null;
  depositWallet?: WalletRecord | null;
  tradingWallet?: WalletRecord | null;
  depositWalletReady?: boolean;
  depositWalletDeployed?: boolean;
  depositWalletApproved?: boolean;
  relayerUrl?: string | null;
  relayerConfigured?: boolean;
  /** Legacy response fields kept optional for older servers. */
  magicPublishableKey?: string | null;
  magicPublishableKeyConfigured?: boolean;
}

export type WalletAssetKey = "pUsd" | "usdcE" | "matic";

export interface WalletBalanceAsset {
  symbol: string;
  name: string;
  address: string | null;
  decimals: number;
  balanceRaw: string;
  balance: string;
  ok: boolean;
  error?: string;
}

export interface WalletBalances {
  walletAddress: string;
  chainId: number;
  updatedAt: string;
  available: WalletBalanceAsset;
  assets: Record<WalletAssetKey, WalletBalanceAsset>;
}

export interface WalletDepositResponse {
  action: "deposit";
  mode: "direct" | "bridge";
  direct: {
    publicDepositAddress: string;
    walletAddress: string;
    chainId: number;
    network: string;
    assets: Record<WalletAssetKey, WalletBalanceAsset>;
    warning: string;
  };
  bridge?: {
    address?: Record<string, string>;
    note?: string;
    warnings?: { code?: string; message?: string }[];
    [key: string]: unknown;
  };
}

export interface WalletWithdrawIntent {
  id: string;
  status: "pending" | "submitted" | "succeeded" | "failed" | "cancelled" | "expired";
  walletAddress: string;
  amount: string;
  amountBaseUnit: string;
  fromChainId: string;
  fromTokenAddress: string;
  toChainId: string;
  toTokenAddress: string;
  recipientAddress: string;
  bridgeAddresses: Record<string, string>;
  quote?: Record<string, unknown>;
  txHash?: string | null;
  error?: string | null;
  expiresAt: string;
  createdAt?: string;
  updatedAt?: string;
  signingUrl: string;
}

export interface WalletWithdrawIntentResponse {
  intent: WalletWithdrawIntent;
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
// Allocator recommendation — mirrors POST /api/lp/allocator
// ---------------------------------------------------------------------------

export interface AllocatorStrategyInput {
  id?: string;
  name?: string;
  status?: "dry_run" | "paused" | "live";
  total_holdings?: number;
  total_holdings_usd?: number;
  portfolio_value?: number;
  portfolio_value_usd?: number;
  capital_limit_pct?: number;
  per_market_limit_pct?: number;
  capital_limit?: number;
  per_market_limit?: number;
  min_expected_return_daily_pct?: number;
  max_inventory_imbalance?: number;
  min_liquidity?: number;
  max_spread?: number;
  min_days_to_end?: number;
  max_markets?: number;
  volatility_fill_spike_threshold?: number;
  event_no_quote_minutes_before?: number;
  event_no_quote_minutes_after?: number;
}

export interface AllocatorMarketInput {
  slug: string;
  question?: string;
  yesTokenId?: string;
  noTokenId?: string;
  yesPrice?: number;
  noPrice?: number;
  liquidity?: number;
  volume24h?: number;
  spread?: number;
  rewardsDailyRate?: number;
  oneDayPriceChange?: number;
  daysToEnd?: number;
  active?: boolean;
  eventRisk?: "low" | "medium" | "high" | "unknown";
  scheduledEvents?: Record<string, unknown>[];
  recentFillRateYes?: number;
  recentFillRateNo?: number;
  bookImbalance?: number;
  rewardProgramEnd?: string;
  resolutionSourceQuality?: number;
}

export interface AllocatorAllocationInput {
  market_slug: string;
  status?: string;
  allocated_capital?: number;
  locked_capital?: number;
  inventory_yes?: number;
  inventory_no?: number;
  open_order_notional?: number;
  inventory_value?: number;
  realized_spread_pnl?: number;
  reward_income?: number;
  fees?: number;
  [key: string]: unknown;
}

export interface AllocatorCycleRequest {
  strategy?: AllocatorStrategyInput;
  markets: AllocatorMarketInput[];
  allocations?: AllocatorAllocationInput[];
}

export interface AllocatorSafetyCheck {
  name?: string;
  passed?: boolean;
  actual?: unknown;
  limit?: unknown;
}

export interface AllocatorDecision {
  market_slug?: string;
  question?: string;
  action?: string;
  dry_run?: boolean;
  target_capital?: number;
  capital_delta?: number;
  score?: {
    score?: number;
    expected_return_daily_pct?: number;
    capacity?: number;
    risk_flags?: string[];
    [key: string]: unknown;
  };
  safety_checks?: AllocatorSafetyCheck[];
  quote_regime?: "reward_optimized" | "defensive" | "no_quote";
  inventory_status?: Record<string, unknown>;
  economics?: {
    estimated_reward_yield_daily_pct?: number;
    estimated_spread_capture_daily_pct?: number;
    estimated_risk_penalty_daily_pct?: number;
    realized_spread_pnl?: number;
    reward_income?: number;
    fees?: number;
    net_realized_pnl?: number;
    [key: string]: unknown;
  };
  rationale?: string;
  [key: string]: unknown;
}

export interface AllocatorCycleResult {
  agent?: string;
  mode?: string;
  dry_run?: boolean;
  generated_at?: string;
  strategy?: Record<string, unknown>;
  total_markets?: number;
  decisions?: AllocatorDecision[];
  summary?: {
    actions?: Record<string, number>;
    target_capital?: number;
    economics?: Record<string, unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface AllocatorCycleApiResponse {
  mode?: string;
  dryRunOnly?: boolean;
  result?: AllocatorCycleResult;
  error?: string;
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
  bayesian_reasoning?: string;
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
// Persisted LP workflow API responses
// ---------------------------------------------------------------------------

export interface LpScanResponse extends FeedResult {
  scanId: string;
  strategyId: string;
  topic: string;
  profile: string;
  evidenceSaved: number;
  filters?: Record<string, unknown>;
}

export interface LpRecommendResponse {
  mode?: string;
  cycleId: string;
  scanId?: string | null;
  strategyId: string;
  candidatesSubmitted: number;
  allocationsSubmitted: number;
  pnlContextCount: number;
  pnlSynced: boolean;
  approvalRequired: boolean;
  decisions: AllocatorDecision[];
  result: AllocatorCycleResult;
  error?: string;
}

export interface LpEvaluationSummary {
  snapshots: number;
  markets: number;
  realizedPnl: number;
  unrealizedPnl: number;
  cashPnl: number;
  netPnl: number;
  currentValue: number;
  capitalLocked: number;
  outcomes: Record<string, number>;
}

export interface LpPnlLesson {
  market_slug?: string | null;
  realized_pnl?: number;
  unrealized_pnl?: number;
  cash_pnl?: number;
  net_pnl?: number;
  capital_locked?: number;
  outcome?: string;
  lesson?: string;
  [key: string]: unknown;
}

export interface LpEvaluateResponse {
  strategyId: string;
  walletAddress: string | null;
  pnlSynced: boolean;
  syncError: string | null;
  summary: LpEvaluationSummary;
  lessons: LpPnlLesson[];
  error?: string;
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
