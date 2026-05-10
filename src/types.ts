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
  rank: number;
  score: number;
  question: string;
  slug: string;
  eventSlug: string;
  yesPrice: number;
  noPrice: number;
  volume24h: number;
  liquidity: number;
  spread: number;
  oneDayPriceChange: number;
  rewardsDailyRate: number;
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
