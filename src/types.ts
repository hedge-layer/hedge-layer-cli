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
// Allocator cycle — mirrors POST /api/allocator/cycle
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
  max_order_notional?: number;
  quote_edge_bps?: number;
  min_liquidity?: number;
  max_spread?: number;
  min_days_to_end?: number;
  max_markets?: number;
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
}

export interface AllocatorAllocationInput {
  market_slug: string;
  status?: string;
  allocated_capital?: number;
  locked_capital?: number;
  inventory_yes?: number;
  inventory_no?: number;
  open_order_notional?: number;
  [key: string]: unknown;
}

export interface AllocatorCycleRequest {
  strategy?: AllocatorStrategyInput;
  markets: AllocatorMarketInput[];
  allocations?: AllocatorAllocationInput[];
}

export interface AllocatorOrderPlan {
  side?: string;
  outcome?: string;
  token_id?: string;
  price?: number;
  size?: number;
  notional?: number;
  type?: string;
  post_only?: boolean;
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
  order_plan?: AllocatorOrderPlan[];
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
    orders_planned?: number;
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
