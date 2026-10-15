pub mod auth_args;
pub mod faucet_api;
pub mod funding;
pub mod game;
pub mod helpers;
pub mod scripts;
pub mod storage;

/// One tag for every note of this app ("PB"); clients sync it and filter by script root.
pub const NOTE_TAG: u32 = 0x5042_0001;

/// Infallible `Felt` from a value known to be below the field modulus.
pub fn felt(v: u64) -> miden_client::Felt {
    miden_client::Felt::new(v).expect("value below the field modulus")
}

/// The advice-map entries a claim needs, whatever the game: under each shot note's id (shot
/// script root `shot_root`), that note's `shot_deadline` (storage item 7), which the record script
/// verifies by commitment.
pub fn deadline_advice(shot_root: miden_client::Word, notes: &[miden_client::note::Note]) -> Vec<(miden_client::Word, Vec<miden_client::Felt>)> {
    notes
        .iter()
        .filter(|n| Word::from(n.script().root()) == shot_root)
        .map(|n| (n.id().as_word(), vec![n.recipient().storage().items()[storage::SHOT_DEADLINE_INDEX]]))
        .collect()
}

use miden_client::Word;
