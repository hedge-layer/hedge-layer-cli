// Domain types mirrored from the Hedge Layer web app.
// Only the subset needed for CLI display and API interaction.

export type RiskType =
  | "flood"
  | "hurricane"
  | "wildfire"
  | "earthquake"
  | "storm"
  | "tornado";

export type AssetType = "residential" | "commercial" | "vehicle" | "other";

export interface RiskProfile {
  location: string;
  assetType: AssetType;
  riskTypes: RiskType[];
  assetValue: number;
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

export interface MappedMarket {
  market: Market;
  correlationScore: number;
  matchReason: string;
  matchedRiskType: RiskType;
}

export interface HedgePosition {
  market: Market;
  correlationWeight: number;
  yesPrice: number;
  positionSize: number;
  estimatedCost: number;
  potentialPayout: number;
  coverageExplanation: string;
  slippageEstimate?: number;
  effectiveCost?: number;
  liquidityDepth?: number;
  wasCapped?: boolean;
}

export interface HedgeBundle {
  positions: HedgePosition[];
  totalCost: number;
  totalCoverage: number;
  hedgeEfficiency: number;
  assetValue: number;
}

export interface OrderbookLevel {
  price: string;
  size: string;
}

export interface Orderbook {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
}

export interface SlippageResult {
  avgPrice: number;
  worstPrice: number;
  slippage: number;
  fillableSize: number;
}

export interface Assessment {
  id: string;
  user_id: string;
  status: string;
  risk_profile: RiskProfile | null;
  hedge_bundle: HedgeBundle | null;
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

export interface ApiError {
  error: string;
}

export interface GlobalOptions {
  json?: boolean;
  apiUrl?: string;
  token?: string;
  verbose?: boolean;
}
