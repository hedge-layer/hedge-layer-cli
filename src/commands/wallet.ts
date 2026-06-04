import { Command, InvalidArgumentError } from "commander";
import { ApiClient } from "../client.js";
import type {
  GlobalOptions,
  WalletAssetKey,
  WalletBalanceAsset,
  WalletBalances,
  WalletStatus,
} from "../types.js";
import * as out from "../output.js";

const NETWORK_NAME = "Polygon";
const SUPPORTED_ASSETS: WalletAssetKey[] = ["pUsd", "usdcE", "matic"];
const WITHDRAWAL_UNSUPPORTED_REASON =
  "CLI withdrawal is not available yet because the API token cannot sign wallet transactions.";

interface DepositInstructions {
  action: "deposit";
  walletAddress: string;
  chainId: number;
  network: string;
  asset: WalletBalanceAsset | null;
  assets: WalletBalanceAsset[];
  warning: string;
}

interface WithdrawIntent {
  action: "withdraw";
  supported: false;
  reason: string;
  walletAddress: string;
  chainId: number;
  network: string;
  asset: WalletBalanceAsset;
  amount: number;
  to: string;
  availableBalance: string;
  nextStep: string;
}

interface DepositOpts {
  asset?: string;
}

interface WithdrawOpts {
  asset?: string;
  amount: number;
  to: string;
}

function requireAuth(client: ApiClient): void {
  if (!client.isAuthenticated) {
    out.error("Not authenticated. Run `hl auth login` first.");
    process.exit(1);
  }
}

function parsePositiveNumber(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new InvalidArgumentError("Expected a positive number");
  }
  return n;
}

function parseWalletAddress(value: string): string {
  const trimmed = value.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    throw new InvalidArgumentError("Expected a valid EVM wallet address");
  }
  return trimmed;
}

export function normalizeWalletAsset(value: string | undefined): WalletAssetKey | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase().replace(/[._\s-]/g, "");
  if (["pusd", "polymarketusd"].includes(normalized)) return "pUsd";
  if (["usdce", "usdcebridged", "bridgedusdc", "usdc"].includes(normalized)) return "usdcE";
  if (["matic", "pol"].includes(normalized)) return "matic";
  throw new InvalidArgumentError("Unknown wallet asset. Use pUSD, USDC.e, or MATIC.");
}

function assetByKey(balances: WalletBalances, key: WalletAssetKey): WalletBalanceAsset {
  return balances.assets[key];
}

function tokenAddress(asset: WalletBalanceAsset): string {
  return asset.address ?? "native token";
}

function displayAmount(asset: WalletBalanceAsset): string {
  if (!asset.ok) {
    return `unavailable${asset.error ? ` (${asset.error})` : ""}`;
  }
  const numeric = Number(asset.balance);
  if (asset.symbol === "MATIC") {
    return Number.isFinite(numeric) ? numeric.toLocaleString("en-US", { maximumFractionDigits: 6 }) : asset.balance;
  }
  return Number.isFinite(numeric) ? out.currency(numeric) : asset.balance;
}

export function buildDepositInstructions(
  balances: WalletBalances,
  assetKey?: WalletAssetKey,
): DepositInstructions {
  const assets = assetKey
    ? [assetByKey(balances, assetKey)]
    : SUPPORTED_ASSETS.map((key) => assetByKey(balances, key));

  return {
    action: "deposit",
    walletAddress: balances.walletAddress,
    chainId: balances.chainId,
    network: NETWORK_NAME,
    asset: assetKey ? assetByKey(balances, assetKey) : null,
    assets,
    warning: "Send only Polygon assets to this address. Hedge Layer cannot reverse external transfers.",
  };
}

export function buildWithdrawIntent(
  balances: WalletBalances,
  opts: WithdrawOpts,
): WithdrawIntent {
  const assetKey = normalizeWalletAsset(opts.asset) ?? "pUsd";
  const asset = assetByKey(balances, assetKey);

  return {
    action: "withdraw",
    supported: false,
    reason: WITHDRAWAL_UNSUPPORTED_REASON,
    walletAddress: balances.walletAddress,
    chainId: balances.chainId,
    network: NETWORK_NAME,
    asset,
    amount: opts.amount,
    to: opts.to,
    availableBalance: asset.balance,
    nextStep: "Use a wallet-signed browser flow before this CLI can move funds.",
  };
}

function displayWalletStatus(status: WalletStatus): void {
  out.heading("Wallet");
  out.table([
    ["Linked", status.linked ? "yes" : "no"],
    ["Provider", status.provider],
    ["Wallet", status.wallet?.wallet_address ?? "(none)"],
    ["Chain", status.wallet ? `${NETWORK_NAME} (${status.wallet.chain_id})` : "(none)"],
    ["Linked at", status.wallet?.linked_at ? new Date(status.wallet.linked_at).toLocaleString() : "(none)"],
    ["Magic configured", status.magicPublishableKeyConfigured ? "yes" : "no"],
  ]);
}

function displayWalletBalances(balances: WalletBalances): void {
  out.heading("Wallet Funds");
  out.table([
    ["Wallet", balances.walletAddress],
    ["Chain", `${NETWORK_NAME} (${balances.chainId})`],
    ["Available pUSD", displayAmount(balances.available)],
    ["USDC.e", displayAmount(balances.assets.usdcE)],
    ["MATIC", displayAmount(balances.assets.matic)],
    ["Updated", new Date(balances.updatedAt).toLocaleString()],
  ]);
}

function displayDepositInstructions(instructions: DepositInstructions): void {
  out.heading("Deposit");
  out.table([
    ["Wallet", instructions.walletAddress],
    ["Network", `${instructions.network} (${instructions.chainId})`],
  ]);

  process.stdout.write("\n");
  out.table(
    instructions.assets.map((asset) => [
      asset.symbol,
      tokenAddress(asset),
      displayAmount(asset),
    ]),
    ["Asset", "Address", "Current balance"],
  );
  process.stdout.write("\n");
  out.warn(instructions.warning);
}

function displayWithdrawIntent(intent: WithdrawIntent): void {
  out.heading("Withdraw");
  out.table([
    ["Supported", "no"],
    ["Wallet", intent.walletAddress],
    ["Network", `${intent.network} (${intent.chainId})`],
    ["Asset", intent.asset.symbol],
    ["Amount", String(intent.amount)],
    ["To", intent.to],
    ["Available", displayAmount(intent.asset)],
  ]);
  process.stdout.write("\n");
  out.warn(intent.reason);
  process.stdout.write(out.dim(`  ${intent.nextStep}\n`));
}

export function registerWalletCommands(program: Command): void {
  const wallet = program
    .command("wallet")
    .description("Inspect linked wallet funds and funding instructions");

  wallet
    .command("status")
    .description("Show linked Magic wallet status")
    .action(async () => {
      const globalOpts = program.opts<GlobalOptions>();
      const client = new ApiClient(globalOpts);
      requireAuth(client);

      const status = await client.get<WalletStatus>("/api/wallet/status");
      if (globalOpts.json) {
        out.json(status);
        return;
      }
      displayWalletStatus(status);
    });

  wallet
    .command("balances")
    .alias("funds")
    .description("Show available wallet funds")
    .action(async () => {
      const globalOpts = program.opts<GlobalOptions>();
      const client = new ApiClient(globalOpts);
      requireAuth(client);

      const balances = await client.get<WalletBalances>("/api/wallet/balances");
      if (globalOpts.json) {
        out.json(balances);
        return;
      }
      displayWalletBalances(balances);
    });

  wallet
    .command("deposit")
    .description("Show deposit address and supported Polygon assets")
    .option("--asset <asset>", "pUSD | USDC.e | MATIC")
    .action(async (opts: DepositOpts) => {
      const globalOpts = program.opts<GlobalOptions>();
      const client = new ApiClient(globalOpts);
      requireAuth(client);

      const asset = normalizeWalletAsset(opts.asset);
      const balances = await client.get<WalletBalances>("/api/wallet/balances");
      const instructions = buildDepositInstructions(balances, asset);
      if (globalOpts.json) {
        out.json(instructions);
        return;
      }
      displayDepositInstructions(instructions);
    });

  wallet
    .command("withdraw")
    .description("Validate withdrawal intent; actual transfer requires wallet signing")
    .requiredOption("--to <address>", "Recipient EVM wallet address", parseWalletAddress)
    .requiredOption("--amount <amount>", "Amount to withdraw", parsePositiveNumber)
    .option("--asset <asset>", "pUSD | USDC.e | MATIC", "pUSD")
    .action(async (opts: WithdrawOpts) => {
      const globalOpts = program.opts<GlobalOptions>();
      const client = new ApiClient(globalOpts);
      requireAuth(client);

      const balances = await client.get<WalletBalances>("/api/wallet/balances");
      const intent = buildWithdrawIntent(balances, opts);
      if (globalOpts.json) {
        out.json(intent);
      } else {
        displayWithdrawIntent(intent);
      }
      process.exit(1);
    });
}
