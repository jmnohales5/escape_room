/* Chiptune music + sound effects, all generated with the Web Audio API.
   No audio files: square/triangle oscillators and noise, like an old console. */

const Sound = (() => {
  const BPM = 104;
  const STEP = 60 / BPM / 2;             // one eighth note, in seconds
  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // Eight bars in A minor: Am F C G Am F G E
  const BASS   = [45, 41, 48, 43, 45, 41, 43, 40];
  const CHORDS = [[69, 72, 76], [65, 69, 72], [72, 76, 79], [67, 71, 74],
                  [69, 72, 76], [65, 69, 72], [67, 71, 74], [64, 68, 71]];
  const ARP = [0, 1, 2, 1, 0, 1, 2, 1];  // which chord note on each eighth
  // Melody: [step in bar, midi note, length in steps]
  const MELODY = [
    [[0, 76, 3], [3, 72, 1], [4, 74, 2], [6, 72, 2]],
    [[0, 69, 3], [3, 72, 1], [4, 77, 2], [6, 76, 2]],
    [[0, 76, 2], [2, 79, 2], [4, 76, 2], [6, 72, 2]],
    [[0, 74, 3], [3, 71, 1], [4, 74, 2], [6, 79, 2]],
    [[0, 76, 2], [2, 81, 2], [4, 79, 2], [6, 76, 2]],
    [[0, 77, 3], [3, 76, 1], [4, 72, 2], [6, 69, 2]],
    [[0, 71, 2], [2, 74, 2], [4, 79, 2], [6, 74, 2]],
    [[0, 68, 2], [2, 71, 2], [4, 76, 3]],
  ];

  let ctx = null, musicGain = null, sfxGain = null, noise = null;
  let timer = null, nextTime = 0, step = 0;
  let musicOn = localStorage.getItem("escape_music") !== "off";

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    musicGain = ctx.createGain();
    musicGain.gain.value = musicOn ? 0.5 : 0;
    musicGain.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.7;
    sfxGain.connect(ctx.destination);
    // one second of white noise, reused for drums and hit sounds
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  // A single note with a quick attack and an exponential fade
  function tone(type, freq, t, dur, vol, out) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function hat(t, vol, out, dur = 0.04) {
    const s = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    s.buffer = noise;
    f.type = "highpass";
    f.frequency.value = 6000;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  function kick(t) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g).connect(musicGain);
    o.start(t);
    o.stop(t + 0.17);
  }

  function scheduleStep(t, s) {
    const bar = Math.floor(s / 8) % 8;
    const i = s % 8;
    if (i % 2 === 0) tone("triangle", midi(BASS[bar] + (i === 4 ? 12 : 0)), t, STEP * 1.8, 0.3, musicGain);
    tone("square", midi(CHORDS[bar][ARP[i]]), t, STEP * 0.9, 0.04, musicGain);
    for (const [at, note, len] of MELODY[bar]) {
      if (at === i) tone("square", midi(note), t, STEP * len * 0.95, 0.075, musicGain);
    }
    if (i === 0 || i === 4) kick(t);
    if (i % 2 === 1) hat(t, 0.05, musicGain);
  }

  // Look-ahead scheduler: queue notes a little before they must play
  function tick() {
    while (nextTime < ctx.currentTime + 0.25) {
      scheduleStep(nextTime, step++);
      nextTime += STEP;
    }
  }

  function start() {
    init();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    if (timer) return;
    nextTime = ctx.currentTime + 0.1;
    timer = setInterval(tick, 60);
  }

  function setMusic(on) {
    musicOn = on;
    localStorage.setItem("escape_music", on ? "on" : "off");
    if (musicGain) musicGain.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.05);
  }

  // Play a list of midi notes one after another
  function jingle(notes, type = "square", gap = 0.09, vol = 0.14) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    notes.forEach((n, k) => tone(type, midi(n), t0 + k * gap, gap * 2.2, vol, sfxGain));
  }

  const SFX = {
    step:  () => jingle([45], "triangle", 0.05, 0.05),
    bump:  () => jingle([40], "square", 0.06, 0.1),
    key:   () => jingle([72, 76, 79, 84, 88], "square", 0.08, 0.14),
    open:  () => jingle([60, 64, 67, 72, 76], "square", 0.09, 0.14),
    wrong: () => jingle([50, 45, 40], "sawtooth", 0.12, 0.14),
    hurt() {
      if (!ctx) return;
      hat(ctx.currentTime, 0.25, sfxGain, 0.25);
      jingle([55, 48, 41], "sawtooth", 0.08, 0.14);
    },
    win:   () => jingle([67, 72, 76, 79, 76, 79, 84, 84, 88], "square", 0.12, 0.15),
    over:  () => jingle([64, 62, 60, 57, 52, 45], "triangle", 0.18, 0.25),
    pop:   () => jingle([76], "square", 0.05, 0.08),
  };

  const RUNE_NOTES = [64, 67, 71, 76];

  return {
    start,
    toggleMusic() { init(); setMusic(!musicOn); return musicOn; },
    isMusicOn: () => musicOn,
    sfx: (name) => { if (SFX[name]) SFX[name](); },
    rune: (i) => jingle([RUNE_NOTES[i]], "square", 0.25, 0.2),
  };
})();
