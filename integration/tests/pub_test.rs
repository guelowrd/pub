//! The scoring script on MockChain: every logged run in `rules/vectors.json` replays to its score,
//! the four challenge paths work, and the logs a car could not have driven are refused with their
//! own messages.

mod common;

use anyhow::Result;
use common::*;
use integration::game::{vectors, PubGameData, Run};
use miden_client::transaction::TransactionExecutorError;

fn game_of(run: &Run) -> PubGameData {
    PubGameData { seed: run.seed, song: run.song, course: run.course.clone() }
}

/// An event felt: kind * 2^24 + arg * 2^16 + t.
const fn ev(kind: u64, arg: u64, t: u64) -> u64 {
    kind * (1 << 24) + arg * (1 << 16) + t
}
const FORK: u64 = 0;
const PICK: u64 = 1;
const DROP: u64 = 2;
const WRECK: u64 = 3;

// --- the vectors: MASM agrees with the sim ----------------------------------------------------

/// For every run, a target of `score - 1` settles (win) and a target of `score` is refused.
#[tokio::test(flavor = "multi_thread")]
async fn masm_score_matches_the_sim_on_vectors() -> Result<()> {
    let v = vectors();
    assert!(!v.runs.is_empty(), "rules/vectors.json holds no runs; run GEN_VECTORS=1 yarn vitest run bot in web/");
    for run in &v.runs {
        for (target, wins) in [(run.score.saturating_sub(1), run.score > 0), (run.score, false)] {
            let mut s = setup(target as u32, game_of(run))?;
            let shot = s.standard_shot()?;
            let r = s.consume(s.rival.id(), &[&shot], Some((&run.events, run.dist))).await;
            assert_eq!(r.is_ok(), wins, "seed {} target {target}: {:?}", run.seed, r.err());
        }
    }
    Ok(())
}

// --- the four paths ---------------------------------------------------------------------------

#[tokio::test(flavor = "multi_thread")]
async fn claim_wins_prize_and_returns_stake() -> Result<()> {
    let run = &vectors().runs[0];
    let mut s = setup(run.score as u32 - 1, game_of(run))?;
    let shot = s.standard_shot()?;
    let before = s.balance(s.rival.id());
    let tx = s.consume(s.rival.id(), &[&s.record.clone(), &shot], Some((&run.events, run.dist))).await.expect("claim with a winning run succeeds");
    s.commit(&tx)?;
    assert_eq!(s.balance(s.rival.id()), before + PRIZE + STAKE);
    Ok(())
}

#[tokio::test(flavor = "multi_thread")]
async fn champion_collects_a_lost_shot_after_its_deadline() -> Result<()> {
    let run = &vectors().runs[0];
    let mut s = setup(run.score as u32 + 1000, game_of(run))?;
    let shot = s.standard_shot()?;
    assert!(s.consume(s.rival.id(), &[&shot], Some((&run.events, run.dist))).await.is_err(), "the run does not beat the target");
    s.jump_to(SHOT_DEADLINE + 64)?;
    let before = s.balance(s.champion.id());
    let tx = s.consume(s.champion.id(), &[&shot], None).await.expect("the champion collects");
    s.commit(&tx)?;
    assert_eq!(s.balance(s.champion.id()), before + STAKE);
    Ok(())
}

// --- logs a car could not have driven ---------------------------------------------------------

/// The first vector's course, with a log of our making.
async fn refusal(events: &[u64], dist: u64) -> TransactionExecutorError {
    let run = &vectors().runs[0];
    let mut s = setup(0, game_of(run)).expect("setup");
    let shot = s.standard_shot().expect("shot");
    s.consume(s.rival.id(), &[&shot], Some((events, dist))).await.expect_err("a broken log must be refused")
}

/// The executor reports `assert.err=MSG` failures by code; check the code is the one of `msg`.
fn assert_masm_error(e: &TransactionExecutorError, msg: &'static str) {
    let code = miden_protocol::errors::MasmError::from_static_str(msg).code();
    let text = format!("{e:#}");
    assert!(text.contains(&code.as_canonical_u64().to_string()), "expected {msg:?}, got: {text}");
}

#[tokio::test(flavor = "multi_thread")]
async fn broken_logs_are_refused_with_their_messages() -> Result<()> {
    // a fork past the last leg: seven forks
    let forks: Vec<u64> = (0..7).map(|i| ev(FORK, 1, 2000 * i + 1000)).collect();
    assert_masm_error(&refusal(&forks, 12000).await, "pub: a fork past the last leg");
    // the second stop of the first street, taken 10 ticks after the first: at least 120 m in 0.1 s
    assert_masm_error(&refusal(&[ev(PICK, 0, 1000), ev(PICK, 1, 1130)], 2000).await, "pub: that move is faster than the car");
    // the same stop twice
    assert_masm_error(&refusal(&[ev(PICK, 0, 1000), ev(PICK, 0, 3000)], 2000).await, "pub: that stop was already taken");
    // a fourth rider
    assert_masm_error(
        &refusal(&[ev(PICK, 0, 1000), ev(PICK, 1, 2000), ev(PICK, 2, 3000), ev(FORK, 0, 4000), ev(PICK, 0, 5000)], 4000).await,
        "pub: a fourth rider",
    );
    // a drop on the first street
    assert_masm_error(&refusal(&[ev(DROP, 0, 1000)], 2000).await, "pub: no drop bay on the first street");
    // a drop with nobody aboard for that bay, after a wreck
    assert_masm_error(&refusal(&[ev(PICK, 0, 1000), ev(WRECK, 0, 1500), ev(FORK, 0, 3000), ev(DROP, 0, 4000)], 4000).await, "pub: nobody aboard for this bay");
    // after 3:00
    assert_masm_error(&refusal(&[ev(PICK, 0, 18001)], 2000).await, "pub: an event after 3:00");
    // time runs backwards
    assert_masm_error(&refusal(&[ev(PICK, 0, 2000), ev(PICK, 1, 1000)], 2000).await, "pub: time runs backwards");
    // the distance claimed is shorter than where the last event happened
    assert_masm_error(&refusal(&[ev(FORK, 0, 3000)], 100).await, "pub: the distance does not fit the run");
    Ok(())
}
