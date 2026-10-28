/* La Llave del Calabozo - game logic.
   One canvas (304x240 = 19x15 tiles of 16px), scaled up with CSS for the retro look. */

(() => {
  "use strict";

  const T = 16, COLS = 19, ROWS = 15;

  // Legend: # wall  . floor  S start  K key  E exit door
  //         Q riddle gate  M rune gate  ^ timed spikes
  const MAP = [
    "###################",
    "#.^^^.....#.....#.E",
    "#.#######.#.###.#.#",
    "#M..#.......#K....#",
    "###.#.#############",
    "#...#.#...........#",
    "#.#####.....#####.#",
    "#...^^^.....#.....#",
    "#######.....#.###.#",
    "#...#.......#.#...#",
    "#.#.#.#####.#.###.#",
    "#.#Q..#.....#...#.#",
    "#.#####.#######.#.#",
    "#S#.............#.#",
    "###################",
  ];

  const MAX_HEARTS = 3;
  const MOVE_TIME = 0.13;        // seconds to slide from one tile to the next
  const SKELETON_TIME = 0.38;    // seconds between skeleton steps
  const TRIALS_TOTAL = 2;

  const RIDDLES = [
    { q: "Tengo ciudades pero no casas, ríos pero no agua. ¿Qué soy?",
      a: ["Un mapa", "Un sueño", "Un reino"], ok: 0 },
    { q: "Tengo agujas pero no coso, y números pero no hablo. ¿Qué soy?",
      a: ["Una armadura", "Un reloj", "Un mago"], ok: 1 },
    { q: "Cuanto más seca, más moja. ¿Qué es?",
      a: ["La espada", "La lluvia", "La toalla"], ok: 2 },
    { q: "Soy ligera como una pluma, pero ni el guerrero más fuerte me sostiene mucho rato. ¿Qué soy?",
      a: ["El aliento", "La armadura", "El escudo"], ok: 0 },
  ];

  const IMAGE_NAMES = [
    "wall", "floor", "floor_crack", "torch_0", "torch_1", "door_locked", "door_open",
    "gate_riddle", "gate_rune", "key", "spikes_down", "spikes_warn", "spikes_up",
    "skeleton_0", "skeleton_1", "heart_full", "heart_empty",
    "hero_down_0", "hero_down_1", "hero_up_0", "hero_up_1", "hero_right_0", "hero_right_1",
    "rune_tri", "rune_dia", "rune_cross", "rune_moon",
  ];

  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const KEYS = {
    ArrowUp: "up", w: "up", W: "up",
    ArrowDown: "down", s: "down", S: "down",
    ArrowLeft: "left", a: "left", A: "left",
    ArrowRight: "right", d: "right", D: "right",
  };

  const $ = (id) => document.getElementById(id);
  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const images = {};
  let mode = "title";            // title | play | dialog | over | win
  let grid, spikes, torches, keyPos, startPos, checkpoint;
  let hearts, hasKey, trialsDone, gameTime;
  let player, skeletons, skeletonTimer;
  let invulnerable = 0, hurtFlash = 0;
  let clock = 0;                 // always-running clock for animations
  let held = [];                 // direction keys currently pressed, in order
  let ignoreKeysUntil = 0;
  let dialogKey = null;          // key handler of the open dialog
  let trialToken = 0;            // lets async trials notice they were closed
  let toastTimer = null;
  let best = Number(localStorage.getItem("escape_best")) || 0;

  /* ------------------------------------------------------------ helpers */

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const randInt = (n) => Math.floor(Math.random() * n);
  const fmt = (s) => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(Math.floor(s % 60)).padStart(2, "0");

  function toast(msg, ms = 3200) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), ms);
  }

  function tileAt(x, y) {
    return x < 0 || y < 0 || x >= COLS || y >= ROWS ? "#" : grid[y][x];
  }

  function loadImages() {
    return Promise.all(IMAGE_NAMES.map((n) => new Promise((resolve) => {
      const img = new Image();
      img.onload = img.onerror = resolve;
      img.src = `assets/${n}.svg`;
      images[n] = img;
    })));
  }

  /* ------------------------------------------------------------ new game */

  function newGame() {
    grid = MAP.map((r) => r.split(""));
    spikes = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = grid[y][x];
        if (c === "S") { startPos = { x, y }; grid[y][x] = "."; }
        if (c === "K") { keyPos = { x, y }; grid[y][x] = "."; }
        if (c === "^") spikes.push({ x, y, group: 0 });
      }
    }
    // Spikes that touch each other share a group (and a rhythm)
    let group = 0;
    for (const s of spikes) {
      const near = spikes.find((o) => o !== s && o.group > 0 && Math.abs(o.x - s.x) + Math.abs(o.y - s.y) === 1);
      s.group = near ? near.group : ++group;
    }
    // Torches hang on some walls that face a corridor
    torches = [];
    for (let y = 0; y < ROWS - 1; y++) {
      for (let x = 1; x < COLS - 1; x++) {
        if (grid[y][x] === "#" && grid[y + 1][x] !== "#" && (x * 7 + y * 13) % 9 === 0) torches.push({ x, y });
      }
    }
    checkpoint = { ...startPos };
    hearts = MAX_HEARTS;
    hasKey = false;
    trialsDone = 0;
    gameTime = 0;
    invulnerable = 0;
    hurtFlash = 0;
    held = [];
    player = { x: startPos.x, y: startPos.y, fx: 0, fy: 0, tx: 0, ty: 0, t: 0, moving: false, dir: "right", frame: 0 };
    skeletons = [
      { x: 7, y: 7, dir: 1, axis: "x", min: 7, max: 11 },   // patrols the middle row
      { x: 9, y: 9, dir: -1, axis: "y", min: 5, max: 9 },   // patrols the middle column
    ];
    skeletonTimer = 0;
    updateHud();
  }

  /* ----------------------------------------------------------------- HUD */

  function updateHud() {
    const box = $("hearts");
    box.textContent = "";
    for (let i = 0; i < MAX_HEARTS; i++) {
      const img = el("img");
      img.src = `assets/heart_${i < hearts ? "full" : "empty"}.svg`;
      img.alt = "";
      box.appendChild(img);
    }
    box.setAttribute("aria-label", `Vidas: ${hearts}`);
    $("keyslot").classList.toggle("have", hasKey);
    $("keytext").textContent = hasKey ? "¡LLAVE!" : "SIN LLAVE";
    $("trials").textContent = `${trialsDone}/${TRIALS_TOTAL}`;
  }

  function updateMuteButton() {
    const on = Sound.isMusicOn();
    $("mute").textContent = on ? "MÚSICA: SÍ" : "MÚSICA: NO";
    $("mute").setAttribute("aria-pressed", String(on));
  }

  /* ------------------------------------------------------------- dialogs */

  function openDialog(title, text, hint) {
    mode = "dialog";
    held = [];
    $("dlg-title").textContent = title;
    $("dlg-text").textContent = text;
    $("dlg-hint").textContent = hint || "";
    $("dlg-body").textContent = "";
    $("dialog").classList.remove("hidden");
    return $("dlg-body");
  }

  function closeDialog() {
    trialToken++;
    dialogKey = null;
    $("dialog").classList.add("hidden");
    held = [];
    ignoreKeysUntil = performance.now() + 350;
    if (mode === "dialog") mode = "play";
    if (document.activeElement) document.activeElement.blur();
  }

  function openGate(gx, gy, message) {
    grid[gy][gx] = ".";
    trialsDone++;
    checkpoint = { x: gx, y: gy };
    Sound.sfx("open");
    updateHud();
    toast(message);
  }

  // Trial 1: a riddle with three answers
  function riddleTrial(gx, gy) {
    const r = RIDDLES[randInt(RIDDLES.length)];
    const body = openDialog("LA PUERTA HABLA", r.q, "Elige con el ratón o con las teclas 1, 2 y 3. ESC para salir.");
    const list = el("div", "options");
    const order = [0, 1, 2].sort(() => Math.random() - 0.5);   // shuffle the answers
    const choose = (idx) => {
      closeDialog();
      if (idx === r.ok) {
        openGate(gx, gy, "La puerta se abre con un crujido. ¡Prueba superada!");
      } else {
        Sound.sfx("wrong");
        toast("Respuesta incorrecta. La puerta te hiere... ¡pierdes una vida!");
        loseHeart();
      }
    };
    order.forEach((idx, n) => {
      const b = el("button", "opt", `${n + 1}) ${r.a[idx]}`);
      b.type = "button";
      b.onclick = () => choose(idx);
      list.appendChild(b);
    });
    body.appendChild(list);
    dialogKey = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 3) choose(order[n - 1]);
    };
    list.firstChild.focus();
  }

  // Trial 2: repeat a sequence of glowing runes (like the "Simon" game)
  function runeTrial(gx, gy) {
    const body = openDialog("RUNAS ANTIGUAS", "", "Teclas 1-4 o clic. ESC para salir.");
    const names = ["tri", "dia", "cross", "moon"];
    const seq = Array.from({ length: 5 }, () => randInt(4));
    const token = trialToken;
    const wrap = el("div", "runes");
    const buttons = names.map((n, i) => {
      const b = el("button", "rune");
      b.type = "button";
      b.disabled = true;
      b.setAttribute("aria-label", `Runa ${i + 1}`);
      const img = el("img");
      img.src = `assets/rune_${n}.svg`;
      img.alt = "";
      b.append(img, el("span", "num", String(i + 1)));
      b.onclick = () => press(i);
      wrap.appendChild(b);
      return b;
    });
    body.appendChild(wrap);

    let pos = 0, accepting = false;
    const say = (t) => { $("dlg-text").textContent = t; };
    const alive = () => token === trialToken;

    function flash(i, ms) {
      buttons[i].classList.add("lit");
      Sound.rune(i);
      setTimeout(() => buttons[i].classList.remove("lit"), ms);
    }

    async function show() {
      say("Memoriza el orden en que brillan las runas...");
      await sleep(900);
      for (const i of seq) {
        if (!alive()) return;
        flash(i, 450);
        await sleep(700);
      }
      if (!alive()) return;
      accepting = true;
      buttons.forEach((b) => (b.disabled = false));
      buttons[0].focus();
      say("Tu turno: repite la secuencia.");
    }

    function press(i) {
      if (!accepting) return;
      flash(i, 220);
      if (i !== seq[pos]) {
        accepting = false;
        setTimeout(() => {
          if (!alive()) return;
          closeDialog();
          Sound.sfx("wrong");
          toast("Las runas se apagan con un chispazo... ¡pierdes una vida!");
          loseHeart();
        }, 400);
        return;
      }
      pos++;
      if (pos === seq.length) {
        accepting = false;
        setTimeout(() => {
          if (!alive()) return;
          closeDialog();
          openGate(gx, gy, "Las runas brillan y el portón de piedra se abre. ¡Prueba superada!");
        }, 500);
      }
    }

    dialogKey = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 4) { buttons[n - 1].focus(); press(n - 1); }
    };
    show();
  }

  /* ------------------------------------------------------- damage & end */

  function loseHeart() {
    hearts--;
    updateHud();
    if (hearts <= 0) gameOver();
  }

  // Hazards (skeleton, spikes) also send the hero back to the last checkpoint
  function hurt(msg) {
    if (invulnerable > 0 || mode !== "play") return;
    Sound.sfx("hurt");
    hurtFlash = 0.4;
    invulnerable = 1.4;
    player.x = checkpoint.x; player.y = checkpoint.y;
    player.moving = false; player.t = 0;
    held = [];
    toast(msg);
    loseHeart();
  }

  function gameOver() {
    mode = "over";
    $("toast").classList.remove("show");
    Sound.sfx("over");
    $("end-h").textContent = "FIN DEL JUEGO";
    $("end-text").textContent = "El calabozo te ha vencido...";
    $("again").textContent = "▶ REINTENTAR";
    $("end").classList.remove("hidden");
    $("again").focus();
  }

  function win() {
    mode = "win";
    $("toast").classList.remove("show");
    Sound.sfx("win");
    const t = Math.floor(gameTime);
    let extra = "";
    if (!best || t < best) {
      best = t;
      localStorage.setItem("escape_best", String(t));
      extra = "\n¡NUEVO RÉCORD!";
    } else {
      extra = `\nMejor tiempo: ${fmt(best)}`;
    }
    $("end-h").textContent = "¡LIBERTAD!";
    $("end-text").textContent = `Has escapado en ${fmt(t)} con ${hearts} ${hearts === 1 ? "vida" : "vidas"}.${extra}`;
    $("end-text").style.whiteSpace = "pre-line";
    $("again").textContent = "▶ JUGAR DE NUEVO";
    $("end").classList.remove("hidden");
    $("again").focus();
  }

  function startGame() {
    Sound.start();
    updateMuteButton();
    $("title").classList.add("hidden");
    $("end").classList.add("hidden");
    $("dialog").classList.add("hidden");
    newGame();
    mode = "play";
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    toast("Encuentra la llave y escapa del calabozo.", 4500);
  }

  /* ------------------------------------------------------------ movement */

  function currentDir() {
    return held.length ? held[held.length - 1] : null;
  }

  function tryMove(dir) {
    player.dir = dir;
    const [dx, dy] = DIRS[dir];
    const nx = player.x + dx, ny = player.y + dy;
    const c = tileAt(nx, ny);
    if (c === "#") return;
    if (c === "Q") { Sound.sfx("pop"); riddleTrial(nx, ny); return; }
    if (c === "M") { Sound.sfx("pop"); runeTrial(nx, ny); return; }
    if (c === "E") {
      if (hasKey) { win(); } else {
        Sound.sfx("bump");
        toast("La puerta está cerrada con llave. Tiene que haber una por aquí...");
        held = [];
        ignoreKeysUntil = performance.now() + 500;
      }
      return;
    }
    player.fx = player.x; player.fy = player.y;
    player.tx = nx; player.ty = ny;
    player.t = 0;
    player.moving = true;
    player.frame ^= 1;
    Sound.sfx("step");
  }

  function arrive() {
    player.x = player.tx; player.y = player.ty;
    player.moving = false;
    player.t = 0;
    if (!hasKey && player.x === keyPos.x && player.y === keyPos.y) {
      hasKey = true;
      Sound.sfx("key");
      updateHud();
      toast("¡Has encontrado la llave! Ahora busca la salida.");
    }
  }

  function spikeState(s) {
    const c = (clock + s.group * 1.6) % 3.2;
    return c < 1.5 ? "down" : c < 2.0 ? "warn" : "up";
  }

  // Tile the hero is considered to stand on (halfway through a step it switches)
  function logicalTile() {
    return player.moving && player.t >= 0.5 ? { x: player.tx, y: player.ty } : { x: player.x, y: player.y };
  }

  function checkHazards() {
    const p = logicalTile();
    if (skeletons.some((s) => s.x === p.x && s.y === p.y)) { hurt("¡Un esqueleto te ha atrapado! Vuelves al último punto seguro."); return; }
    const sp = spikes.find((s) => s.x === p.x && s.y === p.y);
    if (sp && spikeState(sp) === "up") hurt("¡Los pinchos! Vuelves al último punto seguro.");
  }

  /* -------------------------------------------------------------- update */

  function update(dt) {
    clock += dt;
    if (invulnerable > 0) invulnerable -= dt;
    if (hurtFlash > 0) hurtFlash -= dt;
    if (mode !== "play" && mode !== "dialog") return;

    gameTime += dt;
    $("clock").textContent = fmt(gameTime);
    if (mode !== "play") return;

    if (player.moving) {
      player.t += dt / MOVE_TIME;
      if (player.t >= 1) arrive();
    }
    if (!player.moving && mode === "play") {
      const d = currentDir();
      if (d) tryMove(d);
    }

    skeletonTimer += dt;
    while (skeletonTimer >= SKELETON_TIME) {
      skeletonTimer -= SKELETON_TIME;
      for (const s of skeletons) {
        s[s.axis] += s.dir;
        if (s[s.axis] >= s.max) s.dir = -1;
        if (s[s.axis] <= s.min) s.dir = 1;
      }
    }
    if (mode === "play") checkHazards();
  }

  /* ---------------------------------------------------------------- draw */

  const img = (name) => images[name];

  function drawTile(x, y) {
    const c = grid[y][x];
    const px = x * T, py = y * T;
    if (c === "#") { ctx.drawImage(img("wall"), px, py); return; }
    ctx.drawImage(img((x * 31 + y * 17) % 7 === 0 ? "floor_crack" : "floor"), px, py);
    if (c === "Q") ctx.drawImage(img("gate_riddle"), px, py);
    else if (c === "M") ctx.drawImage(img("gate_rune"), px, py);
    else if (c === "E") ctx.drawImage(img(hasKey ? "door_open" : "door_locked"), px, py);
  }

  function drawSpikes() {
    for (const s of spikes) ctx.drawImage(img("spikes_" + spikeState(s)), s.x * T, s.y * T);
  }

  function drawTorches() {
    for (const t of torches) {
      ctx.drawImage(img("torch_" + (Math.floor(clock * 6 + t.x) % 2)), t.x * T, t.y * T);
    }
    // warm glow around each torch
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const t of torches) {
      const cx = t.x * T + 8, cy = t.y * T + 8;
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 34);
      g.addColorStop(0, "rgba(255,140,40,0.28)");
      g.addColorStop(1, "rgba(255,140,40,0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - 34, cy - 34, 68, 68);
    }
    ctx.restore();
  }

  function drawKey() {
    if (hasKey) return;
    const bob = Math.round(Math.sin(clock * 4) * 1.5);
    ctx.drawImage(img("key"), keyPos.x * T, keyPos.y * T + bob);
    if (Math.floor(clock * 4) % 2 === 0) {          // little sparkle
      ctx.fillStyle = "#fff";
      ctx.fillRect(keyPos.x * T + 12, keyPos.y * T + 2 + bob, 1, 1);
      ctx.fillRect(keyPos.x * T + 4, keyPos.y * T + 11 + bob, 1, 1);
    }
  }

  function drawSkeletons() {
    for (const s of skeletons) {
      ctx.drawImage(img("skeleton_" + (Math.floor(clock * 4) % 2)), s.x * T, s.y * T);
    }
  }

  function playerPixel() {
    if (!player.moving) return { x: player.x * T, y: player.y * T };
    return {
      x: Math.round((player.fx + (player.tx - player.fx) * player.t) * T),
      y: Math.round((player.fy + (player.ty - player.fy) * player.t) * T),
    };
  }

  function drawPlayer() {
    if (invulnerable > 0 && Math.floor(clock * 12) % 2 === 0) return;   // blink
    const { x, y } = playerPixel();
    const view = player.dir === "left" ? "right" : player.dir;
    const frame = player.moving ? player.frame : 0;
    const sprite = img(`hero_${view}_${frame}`);
    const bob = player.moving && player.t > 0.25 && player.t < 0.75 ? -1 : 0;
    if (player.dir === "left") {
      ctx.save();
      ctx.translate(x + T, y + bob);
      ctx.scale(-1, 1);
      ctx.drawImage(sprite, 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(sprite, x, y + bob);
    }
  }

  // Darkness around the hero, like a dungeon lit by a single torch
  function drawLight() {
    const { x, y } = playerPixel();
    const cx = x + 8, cy = y + 8;
    const g = ctx.createRadialGradient(cx, cy, 36, cx, cy, 120);
    g.addColorStop(0, "rgba(5,3,15,0)");
    g.addColorStop(1, "rgba(5,3,15,0.6)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function draw() {
    ctx.fillStyle = "#0d0a18";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!grid) return;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) drawTile(x, y);
    drawSpikes();
    drawTorches();
    drawKey();
    drawSkeletons();
    drawPlayer();
    drawLight();
    if (hurtFlash > 0) {
      ctx.fillStyle = `rgba(255,40,40,${Math.min(0.5, hurtFlash)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  let last = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  /* --------------------------------------------------------------- input */

  function holdDir(dir) { if (!held.includes(dir)) held.push(dir); }
  function releaseDir(dir) { held = held.filter((d) => d !== dir); }

  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "m" || e.key === "M") {
      Sound.toggleMusic();
      updateMuteButton();
      return;
    }
    if (mode === "title" && e.key === "Enter" && e.target.tagName !== "BUTTON") { startGame(); return; }
    if ((mode === "over" || mode === "win") && e.key === "Enter" && e.target.tagName !== "BUTTON") { startGame(); return; }
    if (mode === "dialog") {
      if (e.key === "Escape") { closeDialog(); return; }
      if (dialogKey) dialogKey(e);
      return;
    }
    if (mode === "play" && KEYS[e.key]) {
      e.preventDefault();
      if (e.repeat || performance.now() < ignoreKeysUntil) return;
      holdDir(KEYS[e.key]);
    }
  });

  window.addEventListener("keyup", (e) => { if (KEYS[e.key]) releaseDir(KEYS[e.key]); });
  window.addEventListener("blur", () => { held = []; });

  document.querySelectorAll(".dpad button").forEach((b) => {
    const dir = b.dataset.dir;
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); if (mode === "play") holdDir(dir); });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, () => releaseDir(dir)));
  });

  $("start").addEventListener("click", startGame);
  $("again").addEventListener("click", startGame);
  $("mute").addEventListener("click", () => { Sound.toggleMusic(); updateMuteButton(); $("mute").blur(); });

  /* ------------------------------------------------------------- sizing */

  // Pick a scale so the canvas fills the window; whole numbers keep pixels square
  function fit() {
    const hud = document.querySelector(".hud").offsetHeight;
    const foot = document.querySelector(".foot").offsetHeight + document.querySelector(".dpad").offsetHeight;
    const availW = window.innerWidth - 50;
    const availH = window.innerHeight - hud - foot - 70;
    let s = Math.min(availW / canvas.width, availH / canvas.height, 5);
    s = s >= 2 ? Math.floor(s) : Math.max(0.6, s);
    document.documentElement.style.setProperty("--scale", s.toFixed(3));
  }
  window.addEventListener("resize", fit);

  /* --------------------------------------------------------------- boot */

  newGame();               // so the title screen has a map behind it
  updateMuteButton();
  fit();
  loadImages().then(() => {
    fit();
    $("start").focus();
    requestAnimationFrame(frame);
  });
})();
