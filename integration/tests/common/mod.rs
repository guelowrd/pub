//! MockChain harness: a GC faucet, a champion, a rival and a stranger, all standard wallets (the
//! shape Bread creates), plus helpers to post the notes the way the clients do: as output notes
//! of a transaction from the creator's funded wallet. Copied from GeoQuizz, with the game swapped.

use std::collections::BTreeMap;

use anyhow::Result;
use integration::{
    deadline_advice,
    game::{log_advice, PubGameData},
    scripts::{scripts_for, PUB_SCORE_MASM},
    storage::ChallengeStorage,
    NOTE_TAG,
};
use miden_client::{
    account::{Account, AccountId},
    asset::FungibleAsset,
    auth::AuthSchemeId,
    note::{Note, NoteScript, NoteType, PartialNote},
    transaction::{ExecutedTransaction, RawOutputNote, TransactionExecutorError},
    Word,
};
use miden_standards::{testing::note::NoteBuilder, tx_script::SendNotesTransactionScript};
use miden_testing::{Auth, MockChain};
use rand::{rngs::StdRng, SeedableRng};

pub const STAKE: u64 = 1_000_000; // 1 GC at 6 decimals
pub const PRIZE: u64 = 5_000_000;
pub const FUNDS: u64 = 100_000_000; // every wallet starts with 100 GC
pub const EXPIRY: u32 = 100;
/// A shot must be settled before this block (well before the record expires).
pub const SHOT_DEADLINE: u32 = 40;

pub fn auth() -> Auth {
    Auth::BasicAuth { auth_scheme: AuthSchemeId::Falcon512Poseidon2 }
}

/// Builds a note with the given script/storage/asset, as the client would.
pub fn build_note(sender: AccountId, script: NoteScript, storage: &ChallengeStorage, asset: FungibleAsset, seed: u64) -> Result<Note> {
    let mut rng = StdRng::seed_from_u64(seed);
    Ok(NoteBuilder::new(sender, &mut rng)
        .script(script)
        .note_storage(storage.to_felts())?
        .add_assets([asset.into()])
        .note_type(NoteType::Public)
        .tag(NOTE_TAG)
        .build()?)
}

pub struct Setup {
    pub chain: MockChain,
    pub faucet: Account,
    pub champion: Account,
    pub rival: Account,
    #[allow(dead_code)]
    pub stranger: Account,
    pub record: Note,
    pub record_storage: ChallengeStorage,
    pub shot_script: NoteScript,
    pub game: PubGameData,
    seed: u64,
}

/// Chain with the record note posted by the champion: `target` is the score to beat on `game`'s course.
pub fn setup(target: u32, game: PubGameData) -> Result<Setup> {
    let mut builder = MockChain::builder();
    let faucet = builder.add_existing_basic_faucet(auth(), "GC", 1_000_000_000, None)?;
    let funds = |faucet: AccountId| FungibleAsset::new(faucet, FUNDS).map(Into::into);
    let champion = builder.add_existing_wallet_with_assets(auth(), [funds(faucet.id())?])?;
    let rival = builder.add_existing_wallet_with_assets(auth(), [funds(faucet.id())?])?;
    let stranger = builder.add_existing_wallet_with_assets(auth(), [funds(faucet.id())?])?;
    let chain = builder.build()?;

    let (record_script, shot_script) = scripts_for(PUB_SCORE_MASM)?;
    let record_storage = ChallengeStorage::record(EXPIRY, target, STAKE, champion.id(), Word::from(shot_script.root()), game.to_felts());
    let record = build_note(champion.id(), record_script, &record_storage, FungibleAsset::new(faucet.id(), PRIZE)?, 1)?;
    let mut s = Setup {
        chain,
        faucet,
        champion: champion.clone(),
        rival,
        stranger,
        record: record.clone(),
        record_storage,
        shot_script,
        game,
        seed: 2,
    };
    s.publish(&champion, &record)?;
    Ok(s)
}

impl Setup {
    /// A shot note by `rival` against the record, holding `amount` of `faucet`.
    pub fn shot_note(&mut self, rival: AccountId, faucet: AccountId, amount: u64, storage: &ChallengeStorage) -> Result<Note> {
        self.seed += 1;
        build_note(rival, self.shot_script.clone(), storage, FungibleAsset::new(faucet, amount)?, self.seed)
    }

    /// The rival's correct shot note for the record, already on chain.
    pub fn standard_shot(&mut self) -> Result<Note> {
        let storage = self.record_storage.shot_for(self.rival.id(), self.record.id(), SHOT_DEADLINE);
        let note = self.shot_note(self.rival.id(), self.faucet.id(), STAKE, &storage)?;
        let rival = self.rival.clone();
        self.publish(&rival, &note)?;
        Ok(note)
    }

    /// `creator` posts `note` from its vault in a transaction, which is then committed.
    pub fn publish(&mut self, creator: &Account, note: &Note) -> Result<()> {
        let script = SendNotesTransactionScript::new(&creator.code_interface(), &[PartialNote::from(note.clone())])?;
        let executed = self
            .chain
            .build_transaction(creator.id())
            .send_notes_script(&script)
            .expected_output_note(RawOutputNote::Full(note.clone()))
            .build()?
            .execute()
            .await_blocking()?;
        self.commit(&executed)
    }

    /// `account` consumes `notes` with a run (`None` on the reclaim/collect paths): the note
    /// argument is the log's commitment; the log, the course and the shot deadlines go in the
    /// advice map.
    pub async fn consume(&mut self, account: AccountId, notes: &[&Note], run: Option<(&[u64], u64)>) -> Result<ExecutedTransaction, TransactionExecutorError> {
        let owned: Vec<Note> = notes.iter().map(|n| (*n).clone()).collect();
        let mut advice = deadline_advice(Word::from(self.shot_script.root()), &owned);
        advice.push(self.game.course_advice());
        let arg = match run {
            Some((events, dist)) => {
                let entry = log_advice(events, dist);
                let key = entry.0;
                advice.push(entry);
                key
            }
            None => Word::default(),
        };
        self.consume_with_arg(account, notes, arg, advice).await
    }

    /// The raw form: one note argument for every note, whatever advice the caller brings.
    pub async fn consume_with_arg(&mut self, account: AccountId, notes: &[&Note], arg: Word, advice: Vec<(Word, Vec<miden_client::Felt>)>) -> Result<ExecutedTransaction, TransactionExecutorError> {
        let mut tx = self.chain.build_transaction(account);
        let mut args = BTreeMap::new();
        for n in notes {
            tx = tx.authenticated_input_note(n.id());
            args.insert(n.id(), arg);
        }
        for (k, v) in advice {
            tx = tx.add_advice_map_entry(k, v);
        }
        tx.extend_note_args(args).build().expect("tx builds").execute().await
    }

    pub fn commit(&mut self, executed: &ExecutedTransaction) -> Result<()> {
        self.chain.add_pending_executed_transaction(executed)?;
        self.chain.prove_next_block()?;
        Ok(())
    }

    pub fn balance(&self, account: AccountId) -> u64 {
        let asset = FungibleAsset::new(self.faucet.id(), 1).unwrap();
        self.chain.committed_account(account).unwrap().vault().get_balance(asset.id()).unwrap().as_u64()
    }

    pub fn jump_to(&mut self, block: u32) -> Result<()> {
        self.chain.prove_until_block(block)?;
        Ok(())
    }
}

/// Runs a future to completion from sync code (the harness is called from `#[tokio::test]`).
trait AwaitBlocking: core::future::Future + Sized {
    fn await_blocking(self) -> Self::Output {
        tokio::task::block_in_place(|| tokio::runtime::Handle::current().block_on(self))
    }
}
impl<F: core::future::Future> AwaitBlocking for F {}
