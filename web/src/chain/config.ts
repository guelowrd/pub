// Pick Up Boomers on Miden mainnet (v0.17 client): the same challenge mechanic as GeoQuizz (records and shots), its own note
// tag. VITE_MIDEN_NETWORK=testnet (web/.env.local, gitignored) is the development opt-in.

export const MAINNET = import.meta.env.VITE_MIDEN_NETWORK !== "testnet";

export const APP_NAME = "Pick Up Boomers";

// Gamecoin (GC): GeoQuizz's fungible faucet, one per network (gq/gamecoin*.json); the same coin in both games.
export const GC_FAUCET = MAINNET ? "0x34a3510213533f512ec4abe36baf84" : "0xe1f2c48d5bfa8d5173dfcfdc8ac977";
export const GC_DECIMALS = 6;
// The shop: Gamecoin sold through GeoQuizz's sale notes (PSWAP) for the chain's fee asset (USDCx on mainnet, 6 decimals):
// 0.001 per Gamecoin, at most 100 per buy. The price is a ceiling: a cheaper sale note sells first.
export const GC_PRICE = 1_000n; // base units of the fee asset per whole Gamecoin
export const MAX_BUY_GC = 100;
/** What the quantity keys step through: PREV and NEXT, no typing (Gaylord 2026-10-23). The screens import this, not the shop (SDK-free). */
export const QUANTITIES = [1, 2, 5, 10, 20, 50, 100];

// The stake, as in GeoQuizz: the champion puts it in the record as the prize, each rival puts the same in a shot.
export const STAKE = 1_000_000n; // 1 GC
// Mainnet makes a block about every 3.25 s, testnet every 3 s.
export const BLOCK_SECONDS = MAINNET ? 3.25 : 3;
// A record stays open 64 hours (Gaylord 2026-10-23: a day was short).
export const RECORD_LIFETIME_BLOCKS = Math.round((64 * 3600) / BLOCK_SECONDS);
// A shot must be settled within one drive (3 min) plus the wallet: 6 min. One shot is one drive (Gaylord, 2026-10-18: a
// rival never gets two drives for one Gamecoin); a claim that misses the window is a lost shot.
export const SHOT_WINDOW_BLOCKS = Math.round((6 * 60) / BLOCK_SECONDS);
// A shot can only be driven while this much of its window is left: a minute to press DRIVE, the drive, two minutes to claim.
export const SHOT_DRIVE_BLOCKS = Math.round((5 * 60) / BLOCK_SECONDS);
// Refuse a shot at a record that will expire before the shot window ends.
export const MIN_SHOT_WINDOW_BLOCKS = SHOT_WINDOW_BLOCKS + 20;
// A score no drive can reach: a record above it is rigged (a 3-minute drive banks under 30 000).
export const SCORE_MAX = 50_000;

// Where the assembled note scripts live (written by `cargo run --bin build_scripts`).
export const RECORD_SCRIPT_URL = "/scripts/record.bin";
export const SHOT_SCRIPT_URL = "/scripts/shot.bin";
// masm/challenge/challenge_core.masm CLAIM_FUZZ: how late a claim proved before a deadline may land.
export const CLAIM_FUZZ = 64;

export const NETWORK_POLL_INTERVAL_MS = 2_500;
export const NETWORK_POLL_TIMEOUT_MS = 120_000;
// Building a request and getting the wallet's answer: past this the player is told, with Try again (a wallet popup left open hung the game for good).
export const SUBMIT_TIMEOUT_MS = 120_000;

// Miden SDK configuration (mainnet = the Cedar hosts)
export const MIDEN_RPC_URL = MAINNET ? "https://rpc.cedar.miden.io" : "testnet";
export const MIDEN_PROVER = MAINNET ? "https://tx-prover.cedar.miden.io" : "testnet";
// The testnet fee-asset faucet (the local test wallet's money; mainnet accounts are funded by their invite code).
export const MIDEN_FAUCET_URL = "https://faucet-api.testnet.miden.io";
// The monitor's page per network (SYSTEM screen; api/status.py reads its cards).
export const STATUS_URL = MAINNET ? "https://status.cedar.miden.io/" : "https://status.testnet.miden.io/";
