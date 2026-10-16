// The chain, mounted beside the game: the Miden providers and the one hook, published to the app through `onApi`. This
// module is loaded lazily (App.tsx `lazy(() => import(...))`): the SDK awaits its wasm at import time, and the game must
// not wait for that.
import { memo, useEffect } from "react";
import { AppProviders } from "./providers";
import { useChain, type ChainApi, type ChallengeNote, type Posted } from "./useChain";

function Bridge({ onApi }: { onApi: (api: ChainApi) => void }) {
  const api = useChain();
  // every render publishes a fresh object; the app stores it, and App's own renders do not reach here (memo below)
  useEffect(() => onApi(api));
  return null;
}

const ChainHost = memo(function ChainHost({ onApi, autoConnect }: { onApi: (api: ChainApi) => void; autoConnect: boolean }) {
  return (
    <AppProviders autoConnect={autoConnect}>
      <Bridge onApi={onApi} />
    </AppProviders>
  );
});
export default ChainHost;
export type { ChainApi, ChallengeNote, Posted };
