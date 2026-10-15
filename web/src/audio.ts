// Music on one audio element (menus loop Boomers, the run plays the chosen station, results loop Wireline Cosmos);
// engine, skid and event sounds synthesised in WebAudio, so no sound files beyond the songs.
const MUSIC = `${import.meta.env.BASE_URL}music/`;
const music = new Audio();
let ctx: AudioContext | null = null, master: GainNode, engineOsc: OscillatorNode, engineGain: GainNode, skidGain: GainNode;
let current = "";
export let sound = true;

function ac() {
  if (ctx) return ctx;
  ctx = new AudioContext();
  master = ctx.createGain(); master.connect(ctx.destination);
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
  stop: () => { music.pause(); current = ""; },
  pause: () => { music.pause(); if (ctx) ctx.suspend(); },
  resume: () => { if (current) music.play().catch(() => {}); if (ctx) ctx.resume(); },
  fade: (v: number) => { music.volume = Math.max(0, Math.min(1, v)); },
  toggle: () => { sound = !sound; music.muted = !sound; if (ctx) master.gain.value = sound ? 1 : 0; return sound; },
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
