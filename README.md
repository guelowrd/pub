# Pick Up Boomers

Three-minute arcade drive: pick up boomers, deliver them to where they spend, most points wins.
High scores go onchain with GeoQuizz's record/shot notes on Miden.

Plan and decisions: `tasks/todo.md`. Art briefs: `docs/designer-brief*.md` (the latest is the one to read), the per-song dressing in `docs/set-dressing-plan.md`, screens in `docs/screens/`.

```
cd web && yarn && yarn dev                      # http://localhost:5173
cd web && yarn test                             # 79 tests: sim, rules, chain packing, note flows, boards, the hashes
cargo test -p integration --test pub_test       # the MASM replay against rules/vectors.json (4 tests, ~1 min)
cargo run --bin build_scripts                   # assembles the two note scripts into web/public/scripts/
```

Keys: arrows or WASD drive, p pauses, m mutes. In the head unit: 1-6 pick a mode (SOLO RUN, CHALLENGE, MY RUNS,
LEADERBOARDS, WALLET, SYSTEM), arrows move or tune, Enter opens a row, Esc goes back, D drives; the red key reads the one
action the screen allows (DRIVE, SHOT, COLLECT, CONNECT).

Onchain: a run can be posted as a record (a Gamecoin prize on it); rivals pay a Gamecoin for a shot at its course and
song and must beat the score; the chain replays the decision log (`masm/games/pub_score.masm`). Bread signs; without it,
`?local=1` and `?local=2` run two test wallets inside the app (on mainnet `&code=<invite code>` registers a new one and the
node funds its fees; on testnet the public faucet does). Gamecoins are GeoQuizz's, bought from its sale notes (GET GAMECOINS
in the head unit: PREV and NEXT pick how many, the red key buys at 0.001 USDCx each). Note tag 0x50420001, scripts in `web/public/scripts/`.

Deploy: Vercel, root directory `web` (`web/vercel.json` sets the cross-origin isolation headers the Miden client needs).
