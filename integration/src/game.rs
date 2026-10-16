//! Pick Up Boomers' note data and advice, host side. The on-chain truth is
//! `masm/games/pub_score.masm`; the web app's `game/chain.ts` packs the same felts, and
//! `rules/vectors.json` pins all three to the same runs.
//!
//! Game data (12 felts after the 16-felt header): SEED(4) | song, rules version, 0, 0 | COURSE
//! commitment (4). The course itself (28 streets x 8 felts) and the decision log travel in the
//! advice map under their commitments: the chain cannot regenerate a course from a seed, so a
//! rival's client regenerates it and refuses a record whose commitment does not match.
//!
//! Course felt per street: `district * 16 + stop_count`, then up to 7 stops as
//! `dest * 2^24 + points * 2^12 + z / 5`. Log felts: `[n, distance_m, e0..]` with an event as
//! `kind * 2^24 + arg * 2^16 + t_10ms` (kind 0 fork with side 0/1, 1 pick with the stop index,
//! 2 drop, 3 wreck).

use miden_client::{note::NoteStorage, Felt, Word};

use crate::felt;

pub const RULES_VERSION: u64 = 1;
pub const LEGS: usize = 7;
pub const NODES: usize = LEGS * (LEGS + 1) / 2;
pub const NODE_FELTS: usize = 8;
pub const COURSE_FELTS: usize = NODES * NODE_FELTS;

/// A record's game data.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PubGameData {
    pub seed: u64,
    pub song: u32,
    /// The packed course, `COURSE_FELTS` values.
    pub course: Vec<u64>,
}

/// Commitment to a list of felts, the way a note storage of them would be committed.
pub fn commitment(values: &[u64]) -> Word {
    let felts: Vec<Felt> = values.iter().map(|&v| felt(v)).collect();
    NoteStorage::new(felts).expect("fits a note storage").commitment()
}

impl PubGameData {
    pub fn to_felts(&self) -> Vec<Felt> {
        assert_eq!(self.course.len(), COURSE_FELTS, "a course is {COURSE_FELTS} felts");
        let mut out = vec![felt(self.seed), felt(0), felt(0), felt(0), felt(self.song as u64), felt(RULES_VERSION), felt(0), felt(0)];
        out.extend_from_slice(commitment(&self.course).as_elements());
        out
    }

    /// The advice entry carrying the course under its commitment.
    pub fn course_advice(&self) -> (Word, Vec<Felt>) {
        (commitment(&self.course), self.course.iter().map(|&v| felt(v)).collect())
    }
}

/// The log felts a run submits: count, distance in whole metres, then the events.
pub fn pack_log(events: &[u64], distance_m: u64) -> Vec<u64> {
    let mut v = vec![events.len() as u64, distance_m];
    v.extend_from_slice(events);
    v
}

/// The advice entry carrying a run's log under its commitment, which is the note argument.
pub fn log_advice(events: &[u64], distance_m: u64) -> (Word, Vec<Felt>) {
    let packed = pack_log(events, distance_m);
    (commitment(&packed), packed.iter().map(|&v| felt(v)).collect())
}

/// One run from `rules/vectors.json`, as the web app writes it.
#[derive(Clone, Debug, serde::Deserialize)]
pub struct Run {
    pub seed: u64,
    pub song: u32,
    pub dist: u64,
    pub banked: u64,
    pub score: u64,
    pub course: Vec<u64>,
    pub events: Vec<u64>,
}

#[derive(Clone, Debug, serde::Deserialize)]
pub struct Vectors {
    pub version: u32,
    pub rate: f64,
    pub legs: usize,
    pub runs: Vec<Run>,
}

pub fn vectors() -> Vectors {
    serde_json::from_str(include_str!("../../rules/vectors.json")).expect("rules/vectors.json parses")
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Prints the commitments the web app must compute for the first vector (game.test.ts pins them).
    #[test]
    fn print_vector_commitments() {
        let v = vectors();
        let run = &v.runs[0];
        println!("COURSE_COMMIT {}", commitment(&run.course).to_hex());
        println!("LOG_COMMIT {}", log_advice(&run.events, run.dist).0.to_hex());
    }
}
