# Pick Up Boomers

Three-minute arcade drive: pick up boomers, deliver them to where they spend, most points wins.
High scores go onchain with GeoQuizz's record/shot notes on Miden.

Plan and decisions: `tasks/todo.md`. Art briefs: `docs/designer-brief.md`, `docs/designer-brief-next.md`.

```
cd web && yarn && yarn dev                      # http://localhost:5173
cd web && yarn test                             # 67 tests: sim, rules, chain packing, note flows, boards, the hashes
cargo test -p integration --test pub_test       # the MASM replay against rules/vectors.json (4 tests, ~1 min)
cargo run --bin build_scripts                   # assembles the two note scripts into web/public/scripts/
```

Keys: arrows or WASD drive, p pauses, m mutes. In the head unit: 1-6 pick a mode, arrows move or tune, Enter selects,
Esc goes back, AUTO is the action on the lower display.

Onchain: a run can be posted as a record (a Gamecoin prize on it); rivals pay a Gamecoin for a shot at its course and
song and must beat the score; the chain replays the decision log (`masm/games/pub_score.masm`). Bread signs; without it,
`?local=1` and `?local=2` run two test wallets inside the app (fee-funded from the testnet faucet, Gamecoins from the
WALLET mode). Note tag 0x50420001, scripts in `web/public/scripts/`.

Deploy: Vercel, root directory `web` (`web/vercel.json` sets the cross-origin isolation headers the Miden client needs).
