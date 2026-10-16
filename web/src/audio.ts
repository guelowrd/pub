// Music on one audio element (menus loop Omotesando, the run plays the chosen station, results loop Wireline Cosmos);
// engine, skid and event sounds synthesised in WebAudio, so no sound files beyond the songs.
const MUSIC = `${import.meta.env.BASE_URL}music/`;
const music = new Audio();
let ctx: AudioContext | null = null, master: GainNode, engineOsc: OscillatorNode, engineGain: GainNode, skidGain: GainNode;
let analysers: AnalyserNode[] = [], musicGain: GainNode;
const samples = new Uint8Array(256); // reused every frame by levels()
const freq = new Uint8Array(128), NONE = [0, 0, 0, 0, 0, 0];
// the head unit's meter: six bands, octave-ish bins of the left analyser (fftSize 256: 172 Hz per bin), 0..1 above a floor
const BANDS = [[1, 2], [2, 4], [4, 8], [8, 16], [16, 32], [32, 64]];
let current = "";
export let sound = true, volume = 0.7;
/** The effects bus gain as it stands (dev checks of the mute). */
export const level = () => (ctx ? master.gain.value : null);

function ac() {
  if (ctx) return ctx;
  ctx = new AudioContext();
  master = ctx.createGain(); master.gain.value = sound ? 1 : 0; master.connect(ctx.destination); // a mute set before the first gesture holds for the effects too
  // the music runs through the context so its level can drive the beat-reactive glow
  const src = ctx.createMediaElementSource(music), split = ctx.createChannelSplitter(2);
  musicGain = ctx.createGain(); musicGain.gain.value = volume;
  src.connect(musicGain).connect(master); musicGain.connect(split);
  analysers = [0, 1].map((ch) => { const a = ctx!.createAnalyser(); a.fftSize = 256; split.connect(a, ch); return a; });
  engineOsc = ctx.createOscillator(); engineOsc.type = "sawtooth";
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 400;
  engineGain = ctx.createGain(); engineGain.gain.value = 0;
  engineOsc.connect(lp).connect(engineGain).connect(master); engineOsc.start();
  // looping white noise behind a gain for the skid
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
  const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1200;
  skidGain = ctx.createGain(); skidGain.gain.value = 0;
  noise.connect(hp).connect(skidGain).connect(master); noise.start();
  return ctx;
}

function play(track: string, loop: boolean) {
  if (current === track && !music.paused) return;
  current = track;
  music.src = `${MUSIC}${track}.mp3`; music.loop = loop; music.volume = 1; music.muted = !sound;
  music.play().catch(() => {}); // no gesture yet or no file: the game drives silent
}
export const audio = {
  menu: (track: string) => play(track, true),
  run: (track: string) => play(track, false),
  results: (track: string) => play(track, true),
  pause: () => { music.pause(); if (ctx) ctx.suspend(); },
  resume: () => { if (current) music.play().catch(() => {}); if (ctx) ctx.resume(); },
  fade: (v: number) => { music.volume = Math.max(0, Math.min(1, v)); },
  toggle: () => { sound = !sound; music.muted = !sound; if (ctx) master.gain.value = sound ? 1 : 0; return sound; },
  volume: (v: number) => { volume = v; if (ctx) musicGain.gain.value = v; },
  // left and right music levels, 0..1 (render.ts setBeat reads the left one)
  levels: (): number[] => analysers.map((a) => {
    a.getByteTimeDomainData(samples);
    let sum = 0; for (const x of samples) sum += (x - 128) ** 2;
    return Math.min(1, Math.sqrt(sum / samples.length) / 40);
  }).concat([0, 0]).slice(0, 2),
  bands: (): number[] => {
    if (!analysers.length || !sound || music.paused) return NONE;
    analysers[0].getByteFrequencyData(freq);
    return BANDS.map(([lo, hi]) => { let m = 0; for (let i = lo; i < hi; i++) m = Math.max(m, freq[i]); return Math.max(0, (m / 255 - 0.35) / 0.65); });
  },
  // per frame while driving: pitch follows speed, volume the throttle; off the road screens call engine(0, false)
  engine: (speed: number, gas: boolean) => {
    if (!ctx) return;
    engineOsc.frequency.value = 50 + speed * 240;
    engineGain.gain.setTargetAtTime(speed > 0 || gas ? 0.03 + (gas ? 0.03 : 0) + speed * 0.02 : 0, ctx.currentTime, 0.05);
  },
  skid: (on: boolean) => { if (ctx) skidGain.gain.setTargetAtTime(on ? 0.08 : 0, ctx.currentTime, 0.03); },
  sfx: (name: "pick" | "drop" | "crash" | "thud") => {
    const c = ac(), t = c.currentTime;
    const blip = (f0: number, f1: number, at: number, len: number, vol = 0.15) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = "square"; o.frequency.setValueAtTime(f0, t + at); o.frequency.exponentialRampToValueAtTime(f1, t + at + len);
      g.gain.setValueAtTime(vol, t + at); g.gain.exponentialRampToValueAtTime(0.001, t + at + len);
      o.connect(g).connect(master); o.start(t + at); o.stop(t + at + len);
    };
    const burst = (len: number, cutoff: number, vol: number) => {
      const buf = c.createBuffer(1, c.sampleRate * len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
      const src = c.createBufferSource(), lp = c.createBiquadFilter(), g = c.createGain();
      src.buffer = buf; lp.type = "lowpass"; lp.frequency.value = cutoff; g.gain.value = vol;
      src.connect(lp).connect(g).connect(master); src.start(t);
    };
    if (name === "pick") { blip(880, 1320, 0, 0.12); }
    else if (name === "drop") { blip(1046, 1046, 0, 0.1); blip(1568, 1568, 0.1, 0.25, 0.18); }
    else if (name === "crash") burst(0.5, 900, 0.5);
    else burst(0.12, 500, 0.3);
  },
  unlock: () => { ac().resume(); },
};
