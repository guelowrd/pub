// Everything the head unit and the results screen ask of the chain, as one hook: the wallet (Bread, or the local test
// wallet behind ?local=), the game's notes and the chain height, and the four moves (post a record, take a shot, settle a
// drive, collect). A move runs the wallet transaction, then waits until the chain shows its effect: a wallet only
// acknowledges a request (Bread answers as soon as you approve and can still fail afterwards in its own queue), so nothing
// is called done before the node shows it. Ported from GeoQuizz's AppContent `run`.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMiden } from "@miden-sdk/react";
import { useMidenFiWallet } from "@miden-sdk/miden-wallet-adapter-react";
import { LOCAL_WALLET, useLocalWallet } from "./localWallet";
import { GAMECOIN_GRANT, gamecoinRefusal, GRANT_PENDING_MS, useGamecoin } from "./gamecoin";
import { RECORD_LIFETIME_BLOCKS, STAKE, SUBMIT_TIMEOUT_MS } from "./config";
import { accountFelts, bech32Of, endpoint, fetchChallengeNote, knownNote, listChallengeNotes, loadScripts, parseAccountId, syncNotes, wordFromHex, type ChallengeNote, type Client } from "./chain";
import { keyOf, lettersBackward, nicknames, playersInOrder } from "./hub";
import { collect as collectNotes, gcBalance, postRecord, postShot, setBalanceListener, setPendingListener, setSubmitAttemptListener, setSubmitStageListener, settle as settleNotes, waitFor, type Submitted } from "./bread";
import { shotDeadline, shotStorage, ZERO_WORD, type AccountFelts, type ChallengeStorage } from "./notes";
import { blockToMs, canDrive, claimVerdict, explain, fmtGamecoin, myOpenShotsOn, NOT_FINISHED, doneText, settlePlan, SHOT_LOST, shotRefusal, WALLET_SILENT, withTimeout, type Trouble } from "./flow";
import { decodeGame, encodeGame, genuine, newGame, pubAnswer } from "./game";
import type { Event } from "../game/sim";

export type Stage = "connect" | "prepare" | "wallet" | "network";
export type Busy = { text: string; stage: Stage; since: number };
export type Posted = { recordId: string; score: number; song: number; expiresAt: number };
export type Settled = { won: boolean; claimed: boolean; text: string };

export type ChainApi = {
  ready: boolean;
  local: boolean;
  installed: boolean;
  connected: boolean;
  connecting: boolean;
  walletStatus: string;
  address: string | null;
  me: AccountFelts | null;
  height: number;
  notes: ChallengeNote[];
  notesRead: boolean;
  balance: bigint | null;
  busy: Busy | null;
  trouble: { t: Trouble; retry?: () => void } | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
  /** The wallet's Gamecoin balance (Bread asks the player first). */
  readBalance: () => Promise<void>;
  dismiss: () => void;
  nameOf: (a: AccountFelts) => string;
  /** A record opened by link, fresh from the node. */
  loadRecord: (id: string) => Promise<ChallengeNote | null>;
  /** Champion: the drive's score as a record, the stake on it as the prize. */
  post: (seed: number, song: number, score: number) => Promise<Posted | null>;
  /** Rival: the shot note at `record` (or the open ones already there); the drive starts with what comes back. */
  shoot: (record: ChallengeNote) => Promise<{ shots: ChallengeNote[]; record: ChallengeNote } | null>;
  /** Rival, after the drive: the win claims the prize, the loss waits for the champion. */
  settle: (shots: ChallengeNote[], record: ChallengeNote | undefined, seed: number, song: number, log: Event[], dist: number, score: number) => Promise<Settled | null>;
  /** Champion: expired records and lost shots, all in one transaction. */
  collect: (notes: ChallengeNote[]) => Promise<boolean>;
  /** The node the game reads from (SYSTEM screen). */
  rpc: string;
  /** Ten Gamecoins from the faucet; what the player should know. */
  gamecoins: () => Promise<string | null>;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useChain(): ChainApi {
  const { client, isReady, runExclusive } = useMiden();
  const bread = useMidenFiWallet();
  const local = useLocalWallet(client, runExclusive);
  const wallet = LOCAL_WALLET ? local : bread;
  const walletRef = useRef(wallet);
  walletRef.current = wallet;
  const mint = useGamecoin(client, runExclusive);

  const [height, setHeight] = useState(0);
  const [notes, setNotes] = useState<ChallengeNote[]>([]);
  const [notesRead, setNotesRead] = useState(false);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [trouble, setTrouble] = useState<ChainApi["trouble"]>(null);
  const heightRef = useRef(0);
  const notesRef = useRef<ChallengeNote[]>([]);
  const notesReadRef = useRef(false);
  const lastGrant = useRef<{ to: string; at: number } | null>(null);
  const token = useRef(0);

  const address = wallet.connected && wallet.address ? wallet.address : null;
  const me = useMemo(() => (address ? accountFelts(parseAccountId(address)) : null), [address]);

  // the chain height every 15 s (the countdowns need it); the notes on a timer until the first read works, then after my
  // own moves and on request
  const refresh = useCallback(
    async (withNotes = true) => {
      if (!client) return;
      try {
        const h = await withTimeout(runExclusive(() => syncNotes(client)), 30_000, "Syncing");
        heightRef.current = h;
        setHeight(h);
        if (withNotes) {
          const list = await listChallengeNotes(h);
          notesRef.current = list;
          setNotes(list);
          notesReadRef.current = true;
          setNotesRead(true);
        }
      } catch (e) {
        console.warn("[pub] background sync failed", e);
      }
    },
    [client, runExclusive],
  );
  useEffect(() => {
    if (!isReady) return;
    void refresh();
    loadScripts().catch((e) => console.warn("[pub] scripts", e));
    const timer = setInterval(() => void refresh(!notesReadRef.current), 15_000);
    return () => clearInterval(timer);
  }, [isReady, refresh]);

  // Bread opens a popup for every asset read (it asks before sharing them): read on the player's request only; the
  // local test wallet has no popup, so it reads on its own. Every read (a post's check included) lands in `balance`.
  useEffect(() => { setBalanceListener(setBalance); }, []);
  const readBalance = useCallback(async () => {
    if (!walletRef.current.connected) return setBalance(null);
    try {
      await gcBalance(walletRef.current);
    } catch (e) {
      console.warn("[pub] balance", e);
    }
  }, []);
  useEffect(() => { if (LOCAL_WALLET) void readBalance(); else setBalance(null); }, [address, readBalance]);

  // arcade names for everyone who played, in the order they first did; a newcomer comes last
  const names = useMemo(() => {
    const players = playersInOrder(notes);
    if (me && !players.some((p) => keyOf(p) === keyOf(me))) players.push(me);
    return nicknames(players.map((p) => ({ key: keyOf(p), address: bech32Of(p) })));
  }, [notes, me]);
  const nameOf = useCallback((a: AccountFelts) => names.get(keyOf(a)) ?? lettersBackward(bech32Of(a)).slice(0, 3), [names]);

  const oops = (e: unknown, retry?: () => void) => { const t = explain(e); setTrouble({ t, retry: t.kind === "not-found" ? undefined : retry }); }; // a missing record never comes back: no TRY AGAIN
  const say = (title: string) => setTrouble({ t: { kind: "unknown", title } });

  /** The wallet, connected: Bread opens its popup, the test wallet creates itself. */
  const needWallet = async (): Promise<string> => {
    if (walletRef.current.connected && walletRef.current.address) return walletRef.current.address;
    setBusy({ text: "CONNECTING", stage: "connect", since: Date.now() });
    await walletRef.current.connect();
    for (let i = 0; i < 200 && !walletRef.current.address; i++) await sleep(50);
    if (!walletRef.current.address) throw new Error("WalletNotConnectedError: the wallet never answered");
    return walletRef.current.address;
  };

  /**
   * Runs a wallet transaction, then waits until the chain shows its effect (`posted`: the new notes exist; otherwise: the
   * consumed notes are gone). A failure, or a wallet that never finishes, leaves the error in plain words with Try again,
   * which first looks whether the attempt landed after all, so a slow network never makes anyone post or pay twice.
   */
  async function run<S extends Submitted>(text: string, posted: boolean, fn: () => Promise<S>, previous?: S): Promise<S | null> {
    const mine = ++token.current;
    const live = () => token.current === mine;
    const landed = async (ids: string[]) => {
      const records = await Promise.all(ids.map((id) => knownNote(id)));
      return posted ? records.every((r) => !!r) : records.every((r) => !!r?.consumed);
    };
    const again = (attempt?: S) => () => void run(text, posted, fn, attempt);
    let stage: Stage = "prepare", pending = previous; // what the request will make, known before the wallet has it
    setTrouble(null);
    setBusy({ text, stage: previous ? "network" : "prepare", since: Date.now() });
    setSubmitAttemptListener((attempt) => live() && setBusy((b) => (b ? { ...b, text: attempt > 1 ? `${text} (TRY ${attempt})` : text } : b)));
    setSubmitStageListener((s) => { stage = s; if (live()) setBusy((b) => (b ? { ...b, stage: s, since: Date.now() } : b)); });
    setPendingListener((s) => { if (live()) pending = s as S; });
    try {
      await needWallet();
      if (previous && client) {
        await runExclusive(() => syncNotes(client)).catch(() => undefined);
        if (await runExclusive(() => landed(previous.noteIds))) return previous;
        setBusy({ text, stage: "prepare", since: Date.now() });
      }
      // a wallet popup left open, or a node that never answers, used to hold the screen for good: past the cap the player
      // is told, and Try again first looks whether the request landed anyway
      const submitted = await withTimeout(fn(), SUBMIT_TIMEOUT_MS, text).catch((e) => { throw stage === "wallet" && /timed out after/.test(String(e)) ? new Error(WALLET_SILENT) : e; });
      setBusy({ text, stage: "network", since: Date.now() });
      const seen = client ? await waitFor(client, runExclusive, () => landed(submitted.noteIds)) : false;
      if (!live()) return null;
      if (seen) return submitted;
      oops(new Error(NOT_FINISHED), again(submitted));
      return null;
    } catch (e) {
      if (!live()) return null;
      oops(e, again(pending));
      return null;
    } finally {
      if (live()) {
        setBusy(null);
        void refresh();
        if (LOCAL_WALLET) void readBalance();
      }
    }
  }

  const post: ChainApi["post"] = async (seed, song, score) => {
    const game = newGame(seed, song);
    const submitted = await run("POSTING YOUR RECORD", true, async () => {
      const champion = accountFelts(parseAccountId(walletRef.current.address!));
      const storage: ChallengeStorage = { expiryBlock: heightRef.current + RECORD_LIFETIME_BLOCKS, target: score, minStake: STAKE, champion, rival: null, recordId: ZERO_WORD, shotRoot: ZERO_WORD, game: encodeGame(game), shotDeadline: 0 };
      return client ? postRecord(client, walletRef.current, storage, STAKE) : Promise.reject(new Error("client not ready"));
    });
    return submitted ? { recordId: submitted.noteIds[0], score, song, expiresAt: blockToMs(heightRef.current + RECORD_LIFETIME_BLOCKS, heightRef.current) } : null;
  };

  const shoot: ChainApi["shoot"] = async (record) => {
    try {
      const address = await needWallet();
      const rival = accountFelts(parseAccountId(address));
      const refusal = shotRefusal(record, heightRef.current, rival);
      if (refusal) return (setBusy(null), say(refusal), null);
      const open = myOpenShotsOn(notesRef.current, rival, record, heightRef.current).filter((n) => canDrive(n, heightRef.current));
      // one Gamecoin per sitting: drive the shot already on the table instead of paying again
      if (open.length > 0) return (setBusy(null), { shots: open, record });
      const submitted = await run("INSERTING YOUR GAMECOIN", true, async () => {
        // refuse a course that does not come from the seed: the chain cannot grow it, this app can
        if (!genuine(decodeGame(record.storage.game))) throw new Error("This record's course does not match its seed.");
        return client ? postShot(client, walletRef.current, record, rival) : Promise.reject(new Error("client not ready"));
      });
      if (!submitted) return null;
      const shot: ChallengeNote = { id: submitted.noteIds[0], idWord: wordFromHex(submitted.noteIds[0]), kind: "shot", storage: shotStorage(record.storage, rival, record.idWord, submitted.deadline), faucet: record.faucet, amount: record.storage.minStake, consumed: false };
      return { shots: [shot], record };
    } catch (e) {
      setBusy(null);
      oops(e);
      return null;
    }
  };

  const settle: ChainApi["settle"] = async (shots, record, seed, song, log, dist, score) => {
    const plan = settlePlan(shots, record, score, heightRef.current), { won, claimPrize } = plan, text = plan.text.toUpperCase();
    if (!won) return { won, claimed: false, text }; // nothing to sign on a loss: the Gamecoin waits for the champion
    const submitted = await run(claimPrize ? "CLAIMING YOUR PRIZE" : "GETTING YOUR GAMECOIN BACK", false, async () => {
      // ask the chain first: a claim that already landed (or a shot already taken) needs no wallet
      const now = await Promise.all(shots.map((s) => withTimeout(fetchChallengeNote(s.id), 30_000, "Checking your shot")));
      const verdict = claimVerdict(now.map((s) => ({ consumedAt: s.consumedAt, deadline: shotDeadline(s.storage) })));
      if (verdict === "claimed") return { txId: "", noteIds: shots.map((s) => s.id) };
      if (verdict === "lost") throw new Error(SHOT_LOST);
      // the deadline, at the chain's current block: the note script refuses a late claim, and Bread tells nobody when it does
      const h = client ? await runExclusive(() => syncNotes(client)) : heightRef.current;
      if (shots.some((s) => h >= shotDeadline(s.storage))) throw new Error(SHOT_LOST);
      return client ? settleNotes(client, walletRef.current, shots, claimPrize ? record : undefined, pubAnswer(seed, song, log, dist)) : Promise.reject(new Error("client not ready"));
    });
    return submitted ? { won, claimed: true, text: doneText(text) } : null;
  };

  const collect: ChainApi["collect"] = async (picked) => {
    const submitted = await run(picked.length > 1 ? "TAKING THEM" : "TAKING IT", false, () => (client ? collectNotes(client, walletRef.current, picked) : Promise.reject(new Error("client not ready"))));
    return !!submitted;
  };

  /** Mints the grant to the connected wallet; the local wallet then claims it, Bread claims by itself. */
  const gamecoins: ChainApi["gamecoins"] = async () => {
    const mine = ++token.current;
    setTrouble(null);
    try {
      const address = await needWallet();
      setBusy({ text: "GETTING GAMECOINS", stage: "network", since: Date.now() });
      const grant = lastGrant.current;
      const refusal = gamecoinRefusal(await gcBalance(walletRef.current), grant?.to === address && Date.now() - grant.at < GRANT_PENDING_MS);
      if (refusal) return (say(refusal), null);
      await withTimeout(mint(address), 180_000, "Getting Gamecoins");
      lastGrant.current = { to: address, at: Date.now() };
      if (LOCAL_WALLET) await local.claim();
      else setBalance(null); // unknown until Bread takes the note: the results screen offers POST IT again
      if (token.current !== mine) return null;
      return `${fmtGamecoin(GAMECOIN_GRANT).toUpperCase()} FOR YOU. OPEN YOUR WALLET TO TAKE THEM.`;
    } catch (e) {
      if (token.current === mine) oops(e, () => void gamecoins());
      return null;
    } finally {
      if (token.current === mine) {
        setBusy(null);
        if (LOCAL_WALLET) void readBalance();
      }
    }
  };

  const loadRecord: ChainApi["loadRecord"] = async (id) => {
    try {
      const r = await withTimeout(fetchChallengeNote(id), 30_000, "Loading the record");
      setTrouble(null);
      return r;
    } catch (e) {
      oops(e, () => void loadRecord(id));
      return null;
    }
  };

  const connect = async () => {
    try {
      await needWallet();
    } catch (e) {
      oops(e);
    } finally {
      setBusy(null);
    }
  };

  return {
    ready: isReady,
    local: LOCAL_WALLET,
    installed: LOCAL_WALLET || bread.wallet?.readyState === "Installed",
    connected: !!me,
    connecting: wallet.connecting,
    walletStatus: LOCAL_WALLET ? local.status : "",
    address,
    me,
    height,
    notes,
    notesRead,
    balance,
    busy,
    trouble,
    connect,
    disconnect: () => wallet.disconnect(),
    refresh: () => refresh(true),
    readBalance,
    dismiss: () => setTrouble(null),
    nameOf,
    loadRecord,
    post,
    shoot,
    settle,
    collect,
    rpc: endpoint().toString(),
    gamecoins,
  };
}

export type { ChallengeNote, Client, Trouble };
