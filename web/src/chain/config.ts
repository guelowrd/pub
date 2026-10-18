// Pick Up Boomers on Miden testnet v0.17: the same challenge mechanic as GeoQuizz (records and shots), its own note tag.

export const APP_NAME = "Pick Up Boomers";

// Gamecoin (GC): the fungible faucet GeoQuizz deployed on testnet, anyone may mint from it (gq/gamecoin.json).
export const GC_FAUCET = import.meta.env.VITE_GC_FAUCET ?? "0x6a8e2ccb2090bcd1071cea18da2cce";
export const GC_DECIMALS = 6;

// The stake, as in GeoQuizz: the champion puts it in the record as the prize, each rival puts the same in a shot.
export const STAKE: bigint = BigInt(import.meta.env.VITE_GC_STAKE ?? "1000000"); // 1 GC
// Testnet makes a block about every 3 s.
export const BLOCK_SECONDS = 3;
// A record stays open about a day.
export const RECORD_LIFETIME_BLOCKS = Math.round((24 * 3600) / BLOCK_SECONDS); // 28 800
// A shot must be settled within its window: the review, one drive (3 min), then the wallet's approval and proving on a
// phone. 6 min lost SQQ a won claim (2026-10-18, ERR_EXPIRED in Bread): 15 min now. The chain lets a rival pick any
// deadline inside the record's life; a longer window only makes the champion wait that long to collect a lost shot.
export const SHOT_WINDOW_BLOCKS = Math.round((15 * 60) / BLOCK_SECONDS); // 300
// A shot can only be driven while this much of its window is left: the drive and as long again for the claim.
export const SHOT_DRIVE_BLOCKS = Math.round((6 * 60) / BLOCK_SECONDS); // 120
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

// Miden SDK configuration, overridable through environment variables
export const MIDEN_RPC_URL = import.meta.env.VITE_MIDEN_RPC_URL ?? "testnet";
export const MIDEN_FAUCET_URL = import.meta.env.VITE_MIDEN_FAUCET_URL ?? (MIDEN_RPC_URL === "testnet" ? "https://faucet-api.testnet.miden.io" : "");
export const MIDEN_PROVER = (import.meta.env.VITE_MIDEN_PROVER as "devnet" | "testnet" | "local") ?? "testnet";
