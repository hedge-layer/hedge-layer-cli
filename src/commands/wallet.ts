import { Command, InvalidArgumentError } from "commander";
import { spawn } from "node:child_process";
import { ApiClient } from "../client.js";
import type {
  GlobalOptions,
  WalletAssetKey,
  WalletBalanceAsset,
  WalletBalances,
  WalletDepositResponse,
  WalletStatus,
  WalletWithdrawIntent,
  WalletWithdrawIntentResponse,
} from "../types.js";
import * as out from "../output.js";

const NETWORK_NAME = "Polygon";
const POLYGON_NATIVE_USDC = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
const SUPPORTED_ASSETS: WalletAssetKey[] = ["pUsd", "usdcE", "matic"];
const POLYGON_NATIVE_ASSET_LABEL = "POL";
const TERMINAL_WITHDRAWAL_STATUSES = new Set(["succeeded", "failed", "cancelled", "expired"]);

interface DepositInstructions {
  action: "deposit";
  publicDepositAddress: string;
  walletAddress: string;
  chainId: number;
  network: string;
  asset: WalletBalanceAsset | null;
  assets: WalletBalanceAsset[];
  warning: string;
}

interface DepositOpts {
  asset?: string;
  bridge?: boolean;
}

interface WithdrawOpts {
  asset?: string;
  amount: number;
  to: string;
  toChainId?: string;
  toTokenAddress?: string;
  open?: boolean;
  wait?: boolean;
  pollInterval?: number;
  timeout?: number;
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
  throw new InvalidArgumentError("Unknown wallet asset. Use pUSD, USDC.e, or POL.");
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
  if (asset.address === null && asset.decimals === 18) {
    return Number.isFinite(numeric) ? numeric.toLocaleString("en-US", { maximumFractionDigits: 6 }) : asset.balance;
  }
  return Number.isFinite(numeric) ? out.currency(numeric) : asset.balance;
}

function displayAssetSymbol(asset: WalletBalanceAsset): string {
  return asset.address === null && asset.decimals === 18 ? POLYGON_NATIVE_ASSET_LABEL : asset.symbol;
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
    publicDepositAddress: balances.walletAddress,
    walletAddress: balances.walletAddress,
    chainId: balances.chainId,
    network: NETWORK_NAME,
    asset: assetKey ? assetByKey(balances, assetKey) : null,
    assets,
    warning: "Send only Polygon assets to this address. Hedge Layer cannot reverse external transfers.",
  };
}

export function buildWithdrawRequestPayload(opts: WithdrawOpts) {
  const assetKey = normalizeWalletAsset(opts.asset) ?? "pUsd";
  if (assetKey !== "pUsd") {
    throw new InvalidArgumentError("Bridge withdrawals currently send pUSD. Use --asset pUSD.");
  }
  return {
    amount: opts.amount,
    recipientAddress: opts.to,
    toChainId: opts.toChainId ?? "137",
    toTokenAddress: opts.toTokenAddress ?? POLYGON_NATIVE_USDC,
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
    [displayAssetSymbol(balances.assets.matic), displayAmount(balances.assets.matic)],
    ["Updated", new Date(balances.updatedAt).toLocaleString()],
  ]);
}

function displayDepositInstructions(instructions: DepositInstructions): void {
  out.heading("Deposit");
  out.table([
    ["Public deposit address", instructions.publicDepositAddress],
    ["Network", `${instructions.network} (${instructions.chainId})`],
  ]);

  process.stdout.write("\n");
  out.table(
    instructions.assets.map((asset) => [
      displayAssetSymbol(asset),
      tokenAddress(asset),
      displayAmount(asset),
    ]),
    ["Asset", "Token contract", "Current balance"],
  );
  process.stdout.write("\n");
  out.warn(instructions.warning);
}

function displayBridgeDeposit(result: WalletDepositResponse): void {
  const bridgeAddresses = result.bridge?.address ?? {};
  const rows = Object.entries(bridgeAddresses)
    .filter(([, value]) => typeof value === "string" && value.length > 0)
    .map(([network, value]) => [network.toUpperCase(), value]);

  if (rows.length === 0) return;
  process.stdout.write("\n");
  out.table(rows, ["Bridge network", "Bridge deposit address"]);
  if (result.bridge?.note) {
    process.stdout.write("\n" + out.dim(`  ${result.bridge.note}\n`));
  }
  for (const warning of result.bridge?.warnings ?? []) {
    if (warning.message) out.warn(warning.message);
  }
}

function displayWithdrawIntent(intent: WalletWithdrawIntent): void {
  out.heading("Withdraw");
  out.table([
    ["Intent", intent.id],
    ["Status", intent.status],
    ["Wallet", intent.walletAddress],
    ["Amount", `${intent.amount} pUSD`],
    ["Recipient", intent.recipientAddress],
    ["Destination", `chain ${intent.toChainId} · ${intent.toTokenAddress}`],
    ["Bridge address", intent.bridgeAddresses.evm ?? "(none)"],
    ["Signing URL", intent.signingUrl],
  ]);
  const quote = intent.quote ?? {};
  if (quote.estOutputUsd !== undefined || quote.estCheckoutTimeMs !== undefined) {
    process.stdout.write("\n");
    out.table([
      ["Estimated output", quote.estOutputUsd !== undefined ? out.currency(Number(quote.estOutputUsd)) : "-"],
      ["Estimated checkout", quote.estCheckoutTimeMs !== undefined ? `${Math.round(Number(quote.estCheckoutTimeMs) / 1000)}s` : "-"],
    ]);
  }
}

function openBrowser(url: string): void {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args =
    process.platform === "win32"
      ? ["/c", "start", "", url]
      : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollWithdrawalIntent(
  client: ApiClient,
  id: string,
  opts: { timeoutSeconds: number; intervalSeconds: number; jsonMode: boolean },
): Promise<WalletWithdrawIntent> {
  const started = Date.now();
  let lastStatus = "";
  while (Date.now() - started <= opts.timeoutSeconds * 1000) {
    const result = await client.get<WalletWithdrawIntentResponse>(
      `/api/wallet/withdraw/intents/${encodeURIComponent(id)}`,
    );
    const intent = result.intent;
    if (!opts.jsonMode && intent.status !== lastStatus) {
      process.stderr.write(out.dim(`  Withdrawal status: ${intent.status}\n`));
      lastStatus = intent.status;
    }
    if (TERMINAL_WITHDRAWAL_STATUSES.has(intent.status)) return intent;
    await sleep(opts.intervalSeconds * 1000);
  }
  throw new Error(`Timed out waiting for withdrawal intent ${id}`);
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
    .option("--asset <asset>", "pUSD | USDC.e | POL")
    .option("--bridge", "Also request Polymarket Bridge deposit addresses")
    .action(async (opts: DepositOpts) => {
      const globalOpts = program.opts<GlobalOptions>();
      const client = new ApiClient(globalOpts);
      requireAuth(client);

      const asset = normalizeWalletAsset(opts.asset);
      const result = await client.post<WalletDepositResponse>("/api/wallet/deposit", {
        bridge: Boolean(opts.bridge),
      });
      const balances: WalletBalances = {
        walletAddress: result.direct.walletAddress,
        chainId: result.direct.chainId,
        updatedAt: new Date().toISOString(),
        available: result.direct.assets.pUsd,
        assets: result.direct.assets,
      };
      const instructions = buildDepositInstructions(balances, asset);
      if (globalOpts.json) {
        out.json({ ...result, instructions });
        return;
      }
      displayDepositInstructions(instructions);
      displayBridgeDeposit(result);
    });

  wallet
    .command("withdraw")
    .description("Create a browser-signed withdrawal intent and poll for completion")
    .requiredOption("--to <address>", "Recipient EVM wallet address", parseWalletAddress)
    .requiredOption("--amount <amount>", "Amount to withdraw", parsePositiveNumber)
    .option("--asset <asset>", "Source asset; currently only pUSD is supported", "pUSD")
    .option("--to-chain-id <id>", "Destination chain id", "137")
    .option("--to-token-address <address>", "Destination token address", parseWalletAddress, POLYGON_NATIVE_USDC)
    .option("--no-open", "Do not open the browser signing URL")
    .option("--no-wait", "Do not poll for completion after creating the intent")
    .option("--poll-interval <seconds>", "Polling interval in seconds", parsePositiveNumber, 5)
    .option("--timeout <seconds>", "Maximum seconds to wait for completion", parsePositiveNumber, 600)
    .action(async (opts: WithdrawOpts) => {
      const globalOpts = program.opts<GlobalOptions>();
      const client = new ApiClient(globalOpts);
      requireAuth(client);

      const created = await client.post<WalletWithdrawIntentResponse>(
        "/api/wallet/withdraw/intents",
        buildWithdrawRequestPayload(opts),
      );
      let intent = created.intent;
      if (opts.open !== false) {
        openBrowser(intent.signingUrl);
      }
      if (opts.wait !== false) {
        intent = await pollWithdrawalIntent(client, intent.id, {
          timeoutSeconds: opts.timeout ?? 600,
          intervalSeconds: opts.pollInterval ?? 5,
          jsonMode: Boolean(globalOpts.json),
        });
      }
      if (globalOpts.json) {
        out.json(intent);
        return;
      } else {
        displayWithdrawIntent(intent);
      }
    });
}
