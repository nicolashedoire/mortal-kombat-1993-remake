/* ============================================================
   MORTAL KOMBAT — Remake natif (1993) · moteur de jeu
   100 % original, sans émulateur. Contrôles clavier PC.
   ============================================================ */
"use strict";

/* ---------- utilitaires ---------- */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;

/* ---------- état global ---------- */
const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");
const W = 1280, H = 720;
const GROUND = 600;

const S = {
  scene: null,             // objet scène courant
  name: null,
  paused: false,
  muted: false,
  time: 0,
  shake: 0,
  mode: "solo",            // solo | versus | ai
  ladder: [],
  ladderIndex: 0,
  p1: null, p2: null,
  winner: null,
};

const urlQ = new URLSearchParams(location.search);

/* ---------- bibliothèque de jeux (interface gaming) ---------- */
const GAME_LIBRARY = [
  { id: "mk1", title: "Mortal Kombat", year: "1993", genre: "Combat", status: "playable",
    desc: "Le tournoi Shaolin. Remake natif — moteur original, contrôles clavier." },
  { id: "mk2", title: "Mortal Kombat II", year: "1993", genre: "Combat", status: "soon",
    desc: "Outworld vous attend… bientôt disponible dans la collection." },
  { id: "mk3", title: "Mortal Kombat 3", year: "1995", genre: "Combat", status: "soon",
    desc: "La Terre est envahie… bientôt disponible dans la collection." },
];

/* ---------- personnages ---------- */
const CHARACTERS = {
  scorpion: {
    id: "scorpion", name: "SCORPION", short: "Scorpion",
    accent: "#ffd23f", accent2: "#ff9e00", hood: true,
    special: "spear", specialName: "HARPOON", specialInput: "←,←,POING BAS",
    ending: "SCORPION a vaincu le tournoi. Le spectre venu des enfers retourne dans l'ombre, sa vengeance accomplie… pour cette fois. Le feu qui brûle en lui ne s'éteint jamais vraiment. GET OVER HERE… et à la prochaine !",
  },
  subzero: {
    id: "subzero", name: "SUB-ZERO", short: "Sub-Zero",
    accent: "#29c7ff", accent2: "#3f7fff", hood: true,
    special: "freeze", specialName: "FREEZE BALL", specialInput: "↓,→,POING BAS",
    ending: "SUB-ZERO, assassin du Lin Kuei, a gelé ses derniers adversaires. Le clan lui confie une nouvelle mission… mais le guerrier de glace commence à douter de sa voie. Le froid ne trompe personne.",
  },
  reptile: {
    id: "reptile", name: "REPTILE", short: "Reptile",
    accent: "#4fe04f", accent2: "#2e9e2e", hood: true,
    special: "acid", specialName: "ACID SPIT", specialInput: "→,→,POING HAUT",
    ending: "REPTILE, créature de l'Outworld, a craché son venin sur le tournoi. Discret et mortel, il disparaît dans la nuit verte… son maître Shang Tsung l'attend déjà pour une nouvelle mission.",
  },
  liukang: {
    id: "liukang", name: "LIU KANG", short: "Liu Kang",
    accent: "#ff4136", accent2: "#ff8a00", hood: false,
    special: "fireball", specialName: "FIREBALL", specialInput: "→,→,POING HAUT",
    ending: "LIU KANG remporte le tournoi et protège le royaume de la Terre. Le moine Shaolin regarde le temple brûler d'une flamme de victoire… le prochain défi ne saurait tarder.",
  },
  kano: {
    id: "kano", name: "KANO", short: "Kano",
    accent: "#ff7a3d", accent2: "#d4542a", hood: false,
    special: "knife", specialName: "KNIFE THROW", specialInput: "←,→,POING HAUT",
    ending: "KANO, mercenaire du Dragon Noir, encaisse sa paie en pièces d'or. Le tournoi n'était qu'un contrat de plus… mais l'Outworld, lui, n'oublie pas ses débiteurs.",
  },
  raiden: {
    id: "raiden", name: "RAIDEN", short: "Raiden",
    accent: "#7fb2ff", accent2: "#e8f0ff", hood: false,
    special: "lightning", specialName: "LIGHTNING BOLT", specialInput: "↓,→,POING BAS",
    ending: "RAIDEN, dieu du tonnerre et protecteur de la Terre, a repoussé les forces de l'Outworld. L'orage gronde au-dessus du temple… l'équilibre des royaumes est, pour l'instant, préservé.",
  },
};

/* ---------- moteur audio (synthèse WebAudio) ---------- */
const AudioSys = {
  ctx: null, master: null, musicGain: null, unlocked: false, samples: {},
  init() {
    if (this.ctx && this.ctx.state !== "closed") return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.syncControl(); return false; }
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = S.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.36;
      this.musicGain.connect(this.master);
      this.unlocked = false;
      this.ctx.onstatechange = () => this.syncControl();
      this.loadSamples();
      this.syncControl();
      return true;
    } catch (_) {
      this.ctx = this.master = this.musicGain = null;
      this.syncControl();
      return false;
    }
  },
  resume() {
    if (!this.ctx || this.ctx.state === "closed") {
      if (!this.init()) return;
    }
    // Safari et les navigateurs mobiles peuvent suspendre le contexte avant
    // un geste utilisateur ou après une interruption du système.
    if (this.ctx.state !== "running") {
      try {
        const result = this.ctx.resume();
        if (result && result.catch) result.catch(() => {});
      } catch (_) { /* Un prochain geste permettra de réessayer. */ }
    }
    if (!this.unlocked) {
      try {
        const source = this.ctx.createBufferSource();
        source.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
        source.connect(this.ctx.destination); source.start(0);
        this.unlocked = true;
      } catch (_) { /* Le séquenceur peut fonctionner sans ce déverrouillage. */ }
    }
  },
  status() {
    if (S.muted) return "SON COUPÉ · M";
    if (!this.ctx || this.ctx.state === "closed") return "SON INDISPONIBLE";
    if (this.ctx.state !== "running") return "SON EN ATTENTE · CLIQUER";
    return "SON ACTIVÉ · M";
  },
  syncControl() {
    const button = document.getElementById("sound-toggle");
    if (!button) return;
    button.textContent = S.muted ? "🔇 Son coupé" :
      (!this.ctx || this.ctx.state !== "running") ? "🔊 Activer le son" : "🔊 Son actif";
    button.setAttribute("aria-pressed", String(!S.muted));
    button.setAttribute("title", this.status());
  },
  loadSamples() {
    const context = this.ctx;
    this.samples = {};
    if (!context || !context.decodeAudioData || !window.MK_SOUND_ASSETS) return;
    for (const [name, encoded] of Object.entries(window.MK_SOUND_ASSETS)) {
      try {
        const binary = atob(encoded);
        const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
        context.decodeAudioData(bytes.buffer, buffer => {
          if (this.ctx === context) this.samples[name] = buffer;
        }, () => {});
      } catch (_) { /* Synthèse disponible si le décodage échoue. */ }
    }
  },
  announce(name) {
    const buffer = this.samples[name];
    if (!buffer || !this.ctx || !this.master) return false;
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    gain.gain.value = 1.5;
    source.buffer = buffer; source.connect(gain); gain.connect(this.master);
    source.start(0);
    return true;
  },
  toggleMute() {
    if (!S.muted && (!this.ctx || this.ctx.state !== "running")) {
      this.resume(); this.syncControl(); return S.muted;
    }
    S.muted = !S.muted;
    if (this.master) this.master.gain.value = S.muted ? 0 : 0.55;
    if (this.musicElement) this.musicElement.muted = S.muted || S.paused;
    if (!S.muted) this.resume();
    this.syncControl();
    return S.muted;
  },
  env(g, t0, a, d, peak, end) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(Math.max(end, 0.0001), t0 + a + d);
  },
  tone(freq, dur, type, vol, slide = 0, dest) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(slide, 20), t0 + dur);
    this.env(g, t0, 0.004, dur, vol, 0.0001);
    o.connect(g); g.connect(dest || this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  },
  noise(dur, vol, filterFreq, type = "lowpass", slideTo = 0, dest) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = type;
    f.frequency.setValueAtTime(filterFreq, t0);
    if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 20), t0 + dur);
    const g = this.ctx.createGain();
    this.env(g, t0, 0.003, dur, vol, 0.0001);
    src.connect(f); f.connect(g); g.connect(dest || this.master);
    src.start(t0);
  },
  /* ---- effets ---- */
  gong() { this.tone(196, 1.6, "sine", 0.5); this.tone(294, 1.4, "sine", 0.3); this.tone(98, 1.8, "triangle", 0.35); },
  punch() { if (this.announce("impact1")) return; this.noise(0.09, 0.5, 900, "lowpass", 200); this.tone(150, 0.1, "sine", 0.4, 60); },
  kick() { if (this.announce("impact2")) return; this.noise(0.11, 0.55, 700, "lowpass", 150); this.tone(110, 0.12, "sine", 0.45, 50); },
  uppercut() { this.noise(0.14, 0.6, 1000, "lowpass", 120); this.tone(90, 0.16, "sawtooth", 0.3, 40); this.tone(300, 0.1, "square", 0.12, 100); },
  block() { this.noise(0.05, 0.4, 3000, "highpass"); this.tone(1200, 0.05, "square", 0.1, 700); },
  whoosh() { this.noise(0.18, 0.25, 1600, "bandpass", 300); },
  freeze() { this.tone(1800, 0.35, "sine", 0.2, 300); this.tone(900, 0.4, "triangle", 0.15, 150); this.noise(0.2, 0.12, 5000, "highpass"); },
  iceBreak() { this.noise(0.2, 0.35, 4000, "highpass", 1000); this.tone(2000, 0.15, "sine", 0.1, 500); },
  fire() { this.noise(0.25, 0.3, 500, "lowpass", 100); this.tone(200, 0.2, "sawtooth", 0.15, 70); },
  spear() { this.noise(0.16, 0.3, 2000, "bandpass", 800); this.tone(400, 0.1, "sawtooth", 0.1, 200); },
  thunk() { this.noise(0.07, 0.5, 500, "lowpass", 100); this.tone(80, 0.12, "sine", 0.5, 40); },
  ko() { this.noise(0.4, 0.6, 400, "lowpass", 60); this.tone(60, 0.5, "sine", 0.5, 30); },
  victory() { const n = [392, 494, 587, 784]; n.forEach((f, i) => setTimeout(() => this.tone(f, 0.25, "triangle", 0.25), i * 130)); },
  select() { this.tone(660, 0.08, "square", 0.15); this.tone(880, 0.08, "square", 0.12); },
  /* ---- musique (séquenceur sombre) ---- */
  musicTimer: null, musicElement: null, musicStep: 0,
  bass: [55, 55, 65.4, 49, 55, 55, 73.4, 65.4],
  arp: [220, 261.6, 329.6, 392, 329.6, 261.6, 246.9, 293.7],
  startMusic(kind) {
    this.stopMusic();
    if (typeof Audio === "undefined") { this.startSynthMusic(kind); return; }
    let track;
    try { track = new Audio(kind === "fight" ? "assets/audio/combat.wav" : "assets/audio/menu.wav"); }
    catch (_) { this.startSynthMusic(kind); return; }
    this.musicElement = track;
    track.loop = true;
    track.volume = 0.8;
    track.muted = S.muted || S.paused;
    const fallback = () => {
      if (this.musicElement !== track) return;
      this.stopMusic();
      this.startSynthMusic(kind);
    };
    track.onerror = fallback;
    this.musicTimer = setInterval(() => { track.muted = S.muted || S.paused; }, 150);
    try {
      const playing = track.play();
      if (playing && playing.catch) playing.catch(fallback);
    } catch (_) { fallback(); }
  },
  startSynthMusic(kind) {
    if (!this.ctx) return;
    this.musicStep = 0;
    const spb = 0.32;
    const tick = () => {
      if (S.paused || !this.ctx || this.ctx.state !== "running") return;
      const st = this.musicStep % 16, bar = Math.floor(this.musicStep / 16) % 2;
      if (st % 4 === 0) this.tone(this.bass[(this.musicStep >> 2) % 8], 0.5, "sawtooth", 0.55, 0, this.musicGain);
      if (st % 2 === 0) this.tone(this.arp[Math.floor(st / 2) % 8] * (bar ? 1.0 : 0.5), 0.16, "triangle", 0.16, 0, this.musicGain);
      if (st % 8 === 4) this.noise(0.06, 0.22, 300, "lowpass", 80, this.musicGain);
      if (kind === "fight" && st % 16 === 8) this.noise(0.1, 0.18, 2500, "highpass", 0, this.musicGain);
      this.musicStep++;
    };
    tick();
    this.musicTimer = setInterval(tick, spb * 1000);
  },
  stopMusic() {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
    if (this.musicElement) {
      const track = this.musicElement;
      this.musicElement = null;
      track.onerror = null;
      track.pause();
    }
  },
};

/* ============================================================
   MOTEUR DE POSE — combattants « silhouette néon »
   Dessine un humanoïde stylisé à partir de positions d'articulations.
   ============================================================ */
const Pose = {
  /* joints: hx,hy tête · nx,ny cou · sx,sy épaule · ex,ey coude · fx,fy poing
             hpx,hpy hanche · kx,ky genou · tx,ty pied  (idem avec 2 = membre arrière) */
  draw(g, J, o = {}) {
    const accent = o.accent || "#ffd23f", cloth = o.cloth || "#16131a",
          skin = o.skin || "#2a1e12", glow = o.glow !== false;
    g.save();
    if (o.flip) { g.scale(-1, 1); }
    if (glow) { g.shadowColor = accent; g.shadowBlur = o.blur ?? 10; }

    const limb = (p1, p2, w, col) => {
      g.strokeStyle = col; g.lineWidth = w; g.lineCap = "round";
      g.beginPath(); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.stroke();
    };
    const joint = (p, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(p[0], p[1], r, 0, TAU); g.fill(); };

    // ombre au sol
    if (o.shadow) {
      g.shadowBlur = 0;
      g.fillStyle = "rgba(0,0,0,.45)";
      g.beginPath(); g.ellipse(o.shadowX ?? J.hpx, o.shadowY ?? 200, 46, 10, 0, 0, TAU); g.fill();
    }

    // jambe arrière
    limb([J.hpx, J.hpy], [J.k2x, J.k2y], o.lw ?? 16, cloth);
    limb([J.k2x, J.k2y], [J.t2x, J.t2y], (o.lw ?? 16) - 2, cloth);
    joint([J.t2x, J.t2y], 7, cloth);
    // torse
    limb([J.hpx, J.hpy], [J.nx, J.ny], o.tw ?? 26, cloth);
    // jambe avant
    limb([J.hpx, J.hpy], [J.kx, J.ky], o.lw ?? 16, cloth);
    limb([J.kx, J.ky], [J.tx, J.ty], (o.lw ?? 16) - 2, cloth);
    joint([J.tx, J.ty], 7, cloth);
    // bras arrière
    limb([J.sx, J.sy], [J.e2x, J.e2y], o.aw ?? 13, cloth);
    limb([J.e2x, J.e2y], [J.f2x, J.f2y], (o.aw ?? 13) - 2, skin);
    joint([J.f2x, J.f2y], 6, skin);
    // bras avant
    limb([J.sx, J.sy], [J.ex, J.ey], o.aw ?? 13, cloth);
    limb([J.ex, J.ey], [J.fx, J.fy], (o.aw ?? 13) - 2, skin);
    joint([J.fx, J.fy], 6, skin);

    // liseré accent (côté lumière)
    g.shadowBlur = 0;
    g.globalAlpha = 0.9;
    limb([J.hpx, J.hpy], [J.nx, J.ny], 3, accent);
    limb([J.sx, J.sy], [J.ex, J.ey], 2.5, accent);

    // tête
    joint([J.hx, J.hy], o.hr ?? 15, skin);
    if (o.hood) { // capuche de ninja
      g.fillStyle = cloth;
      g.beginPath();
      g.moveTo(J.hx - 20, J.hy - 6);
      g.quadraticCurveTo(J.hx - 16, J.hy - 26, J.hx + 2, J.hy - 26);
      g.quadraticCurveTo(J.hx + 20, J.hy - 24, J.hx + 21, J.hy - 2);
      g.quadraticCurveTo(J.hx + 16, J.hy + 8, J.hx - 4, J.hy + 6);
      g.closePath(); g.fill();
      g.fillStyle = skin;
      g.beginPath(); g.ellipse(J.hx + 2, J.hy + 1, 9, 7, 0, 0, TAU); g.fill(); // masque/visage
      g.fillStyle = o.maskGlow || "#ffd23f";
      g.beginPath(); g.arc(J.hx - 1, J.hy - 3, 1.8, 0, TAU); g.fill();
      g.beginPath(); g.arc(J.hx + 6, J.hy - 3, 1.8, 0, TAU); g.fill();
    } else { // visage nu (Liu Kang) + bandeau
      g.fillStyle = accent;
      g.fillRect(J.hx - 17, J.hy - 20, 34, 6);
      g.fillStyle = "#1a0f0a";
      g.beginPath(); g.arc(J.hx - 5, J.hy + 2, 1.8, 0, TAU); g.fill();
      g.beginPath(); g.arc(J.hx + 6, J.hy + 2, 1.8, 0, TAU); g.fill();
      g.strokeStyle = "#1a0f0a"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(J.hx - 3, J.hy + 9); g.lineTo(J.hx + 3, J.hy + 9); g.stroke();
    }
    // ceinture
    g.strokeStyle = accent; g.lineWidth = 4;
    g.beginPath(); g.moveTo(J.hpx - 10, J.hpy - 2); g.lineTo(J.hpx + 10, J.hpy - 2); g.stroke();
    g.restore();
  },

  /* position neutre de référence (debout, garde) — les poses dérivent de celle-ci */
  base: { hx: 0, hy: 26, nx: 0, ny: 52, sx: -2, sy: 56, ex: 6, ey: 82, fx: 12, fy: 96,
          e2x: -14, e2y: 80, f2x: -18, f2y: 98, hpx: 0, hpy: 112, kx: 8, ky: 144, tx: 12, ty: 176,
          k2x: -10, k2y: 144, t2x: -14, t2y: 176 },
};

/* poses = interpolations du neutre ; chaque pose = liste de frames */
const POSES = {
  idle:   [ { d: { hy: 26 }, t: 0 }, { d: { hy: 27, ny: 53, hpy: 113 }, t: 1 } ],
  walk:   [
    { d: { kx: 14, ky: 142, tx: 22, ty: 172, k2x: -18, k2y: 150, t2x: -22, t2y: 178, hpx: 0, hpy: 110, ex: 8, ey: 80 }, t: 0 },
    { d: { kx: 2, ky: 146, tx: 0, ty: 178, k2x: -4, k2y: 140, t2x: -8, t2y: 170, hpx: 0, hpy: 114, ex: 4, ey: 84 }, t: 1 },
    { d: { kx: -16, ky: 150, t2x: -20, t2y: 172, k2x: 16, k2y: 142, tx: 24, ty: 176, hpx: 0, hpy: 110, ex: 8, ey: 80 }, t: 2 },
    { d: { kx: -2, ky: 140, tx: -6, ty: 170, k2x: 2, k2y: 146, t2x: 0, t2y: 178, hpx: 0, hpy: 114, ex: 4, ey: 84 }, t: 3 },
  ],
  crouch: [ { d: { hy: 30, ny: 54, hpy: 132, kx: 22, ky: 152, tx: 26, ty: 172, k2x: -6, k2y: 158, t2x: -10, t2y: 176, sx: -4, sy: 66, ex: 8, ey: 92, fx: 14, fy: 108, e2x: -16, e2y: 94, f2x: -22, f2y: 110 }, t: 0 } ],
  jump:   [ { d: { hy: 24, kx: 20, ky: 128, tx: 26, ty: 120, k2x: -16, k2y: 136, t2x: -22, t2y: 152, hpx: 0, hpy: 104, ex: 16, ey: 74, fx: 26, fy: 64, e2x: -18, e2y: 78, f2x: -26, f2y: 70 }, t: 0 } ],
  punchHi1: [ { d: { ex: 16, ey: 76, fx: 22, fy: 68, e2x: -20, e2y: 84, f2x: -24, f2y: 96, nx: 3, ny: 50, hpx: 0, hpy: 114 }, t: 0 } ],
  punchHi2: [ { d: { ex: 34, ey: 66, fx: 52, fy: 58, e2x: -16, e2y: 88, f2x: -22, f2y: 100, nx: 6, ny: 48, hpx: 2, hpy: 116 }, t: 0 } ],
  punchLo1: [ { d: { ex: 16, ey: 92, fx: 24, fy: 108, e2x: -18, e2y: 86, f2x: -24, f2y: 100, hpy: 116 }, t: 0 } ],
  punchLo2: [ { d: { ex: 34, ey: 98, fx: 52, fy: 112, e2x: -16, e2y: 90, f2x: -22, f2y: 104, hpy: 118 }, t: 0 } ],
  kickHi1:  [ { d: { kx: 16, ky: 118, tx: 20, ty: 92, k2x: -10, k2y: 146, t2x: -14, t2y: 176, hpx: 0, hpy: 112, e2x: -22, e2y: 80, f2x: -28, f2y: 70, ex: -6, ey: 88, fx: -12, fy: 102, nx: 2, ny: 52 }, t: 0 } ],
  kickHi2:  [ { d: { kx: 24, ky: 96, tx: 40, ty: 70, k2x: -8, k2y: 148, t2x: -12, t2y: 178, hpx: 4, hpy: 114, e2x: -26, e2y: 76, f2x: -32, f2y: 64, ex: -8, ey: 92, fx: -14, fy: 106, nx: 6, ny: 54 }, t: 0 } ],
  kickLo1:  [ { d: { kx: 24, ky: 140, tx: 40, ty: 128, k2x: -10, k2y: 148, t2x: -14, t2y: 178, hpx: 2, hpy: 116, ex: 10, ey: 78, fx: 16, fy: 68, e2x: -20, e2y: 84, f2x: -26, f2y: 96 }, t: 0 } ],
  kickLo2:  [ { d: { kx: 34, ky: 132, tx: 56, ty: 122, k2x: -10, k2y: 150, t2x: -14, t2y: 178, hpx: 6, hpy: 118, ex: 12, ey: 76, fx: 18, fy: 64, e2x: -22, e2y: 82, f2x: -28, f2y: 94 }, t: 0 } ],
  up1: [ { d: { hy: 38, ny: 62, hpy: 128, kx: 18, ky: 150, tx: 22, ty: 174, ex: 2, ey: 96, fx: -2, fy: 118, e2x: -14, e2y: 96, f2x: -18, f2y: 114 }, t: 0 } ],
  up2: [ { d: { hy: 42, ny: 68, hpy: 130, kx: 22, ky: 152, tx: 28, ty: 176, ex: 6, ey: 62, fx: 10, fy: 34, e2x: -14, e2y: 70, f2x: -20, f2y: 46, nx: 3, ny: 58 }, t: 0 } ],
  hit:   [ { d: { hy: 33, nx: -4, ny: 56, hpx: -2, hpy: 118, ex: 14, ey: 88, fx: 20, fy: 104, e2x: -20, e2y: 92, f2x: -28, f2y: 106, kx: 12, ky: 146, tx: 18, ty: 176 }, t: 0 } ],
  block: [ { d: { hy: 29, ny: 52, ex: 16, ey: 70, fx: 22, fy: 62, e2x: -16, e2y: 72, f2x: -22, f2y: 64, hpx: 0, hpy: 116 }, t: 0 } ],
  throw1: [ { d: { ex: 20, ey: 74, fx: 28, fy: 66, e2x: -18, e2y: 86, f2x: -24, f2y: 100, nx: 4, ny: 50 }, t: 0 } ],
  throw2: [ { d: { ex: 40, ey: 62, fx: 60, fy: 54, e2x: -14, e2y: 92, f2x: -20, f2y: 106, nx: 8, ny: 48, hpx: 3, hpy: 114 }, t: 0 } ],
  ko:    [ { d: { hy: 40, ny: 58, hpx: 0, hpy: 168, kx: 16, ky: 168, tx: 26, ty: 174, k2x: -14, k2y: 166, t2x: -22, t2y: 172, ex: 14, ey: 96, fx: 26, fy: 108, e2x: -16, e2y: 100, f2x: -26, f2y: 114 }, t: 0 } ],
  win:   [ { d: { hy: 24, ex: 0, ey: 34, fx: 0, fy: 10, e2x: -18, e2y: 78, f2x: -24, f2y: 92, nx: 0, ny: 50 }, t: 0 } ],
};

function poseFrame(poseName, frameIdx, o) {
  const P = POSES[poseName]; if (!P) return { ...Pose.base };
  const f = P[frameIdx % P.length];
  const out = { ...Pose.base };
  for (const k in f.d) out[k] = f.d[k];
  if (o) for (const k in o) out[k] = o[k];
  return out;
}

/* rend un combattant dans un canvas (frame pré-rendue) */
function renderPoseFrame(poseName, frameIdx, o) {
  const c = document.createElement("canvas");
  c.width = 130; c.height = 210;
  const g = c.getContext("2d");
  g.translate(65, 14);
  const J = poseFrame(poseName, frameIdx, o);
  Pose.draw(g, J, { accent: o.accent, cloth: o.cloth, skin: o.skin, hood: o.hood });
  return c;
}

/* ============================================================
   COMBATTANT
   ============================================================ */
const ATTACKS = {
  hp:  { name: "HP", startup: 0.10, active: 0.10, recover: 0.22, dmg: 5,  height: "high", knock: 150, pose: ["punchHi1", "punchHi2"], snd: "punch" },
  lp:  { name: "LP", startup: 0.08, active: 0.09, recover: 0.18, dmg: 3,  height: "high", knock: 90,  pose: ["punchLo1", "punchLo2"], snd: "punch" },
  hk:  { name: "HK", startup: 0.16, active: 0.11, recover: 0.30, dmg: 7,  height: "high", knock: 220, pose: ["kickHi1", "kickHi2"], snd: "kick" },
  lk:  { name: "LK", startup: 0.10, active: 0.10, recover: 0.22, dmg: 5,  height: "low",  knock: 160, pose: ["kickLo1", "kickLo2"], snd: "kick" },
  cup: { name: "UPPERCUT", startup: 0.14, active: 0.12, recover: 0.34, dmg: 12, height: "high", launch: true, knock: 120, pose: ["up1", "up2"], snd: "uppercut" },
  jk:  { name: "JUMP KICK", startup: 0.08, active: 0.22, recover: 0.20, dmg: 6, height: "high", knock: 180, pose: ["jump"], snd: "kick", air: true },
  jp:  { name: "JUMP PUNCH", startup: 0.06, active: 0.20, recover: 0.20, dmg: 5, height: "high", knock: 150, pose: ["jump"], snd: "punch", air: true },
};

class Fighter {
  constructor(charId, side) {
    this.cid = charId;
    this.def = CHARACTERS[charId];
    this.side = side;                 // 1 = gauche (P1), 2 = droite (P2)
    this.reset(true);
    this.specialUsed = false;         // pour fatality
    this.winPose = false;
  }
  reset(full) {
    this.x = this.side === 1 ? 380 : 900;
    this.y = GROUND;
    this.vx = 0; this.vy = 0;
    this.facing = this.side === 1 ? 1 : -1;
    this.state = "idle"; this.stateT = 0;
    this.hp = 100;
    if (full) this.rounds = 0;
    this.atk = null;
    this.stunT = 0; this.frozenT = 0;
    this.blocking = false;
    this.buffer = [];
    this.bufferAt = 0;
    for (const key of ["hp", "lp", "hk", "lk", "left", "right", "up", "down"]) this[key + "Held"] = false;
    // L'IA appartient au combattant et doit survivre à la remise à zéro d'un round.
    if (full) this.ai = null;
    this.pullT = 0; this.pullFrom = null;
    this.hitCooldown = 0;
  }
  get grounded() { return this.y >= GROUND; }
  get busy() {
    return this.state === "attack" || this.state === "hitstun" || this.state === "launched" ||
           this.state === "frozen" || this.state === "ko" || this.state === "win" || this.frozenT > 0 || this.pullT > 0;
  }
  move(dir) {
    if (this.state === "walk") {
      this.facing = dir;
      this.x += dir * 250 * DT;
    }
  }
  jump() {
    if (this.grounded && !this.busy) { this.y = GROUND - 0.01; this.vy = -980; this.state = "jump"; this.stateT = 0; }
  }
  crouch() {
    if (this.grounded && !this.busy) { this.state = "crouch"; }
  }
  startAttack(key, airOk = false) {
    if (this.busy) return;
    const atk = ATTACKS[key];
    if (!atk) return;
    if (atk.air && !airOk) return;
    if (!atk.air && !this.grounded) return;
    if (this.grounded && this.state === "crouch" && key === "hp") { this.doAttack("cup"); return; }
    this.doAttack(key);
  }
  doAttack(key) {
    const atk = ATTACKS[key];
    this.atk = atk; this.state = "attack"; this.stateT = 0;
    this.atkHit = false;
    if (atk.air) { this.vy = Math.min(this.vy, -200); }
  }
  hasSpecialBuffered() {
    const seq = this.buffer.join(",");
    const def = this.def;
    switch (def.special) {
      case "spear": return seq.endsWith("B,B,LP");
      case "freeze": return seq.endsWith("D,F,LP");
      case "acid": return seq.endsWith("F,F,HP");
      case "fireball": return seq.endsWith("F,F,HP") || seq.endsWith("F,F,HK");
      case "knife": return seq.endsWith("B,F,HP");
      case "lightning": return seq.endsWith("D,F,LP");
    }
    return false;
  }
  trySpecial() {
    if (this.busy || !this.grounded) return false;
    if (!this.hasSpecialBuffered()) return false;
    const def = this.def;
    if (def.special === "fireball") {
      const seq = this.buffer.join(",");
      this.doSpecial(seq.endsWith("F,F,HK") ? "flykick" : "fireball");
    } else {
      this.doSpecial(def.special);
    }
    return true;
  }
  doSpecial(kind) {
    this.specialUsed = true;
    this.atk = { special: kind, startup: 0.22, active: 0.16, recover: 0.30, dmg: 0, height: "high", knock: 0, pose: ["throw1", "throw2"], snd: kind === "spear" ? "spear" : kind === "freeze" ? "freeze" : "fire" };
    this.state = "attack"; this.stateT = 0; this.atkHit = false;
    if (kind === "flykick") { this.vx = this.facing * 700; this.vy = -300; }
  }
  hitBy(atk, attacker) {
    const d = atk.dmg;
    this.hp = Math.max(0, this.hp - d);
    this.stunT = atk.launch ? 0.9 : 0.34 + d * 0.02;
    this.state = atk.launch ? "launched" : "hitstun";
    this.stateT = 0;
    this.vx = attacker.facing * atk.knock;
    if (atk.launch) { this.vy = -620; this.y = Math.min(this.y, GROUND - 2); }
    FX.hitStop(0.085);
    FX.blood(this.x + attacker.facing * 26, this.y - 120, 14);
    if (d >= 5) FX.goreSplat(this.x + attacker.facing * 20, this.y - 118, attacker.facing);
    FX.shake(6);
    S.shake = 6;
    if (this.hp <= 0) { this.state = "ko"; this.stateT = 0; this.vx *= 0.4; AudioSys.ko(); FX.hitStop(0.35); FX.blood(this.x, this.y - 100, 40); FX.shake(14); S.shake = 14; }
  }
  update(dt) {
    if (this.hitCooldown > 0) this.hitCooldown -= dt;
    if (this.pullT > 0) {
      this.pullT -= dt;
      const t = 1 - this.pullT / 0.45;
      this.x = lerp(this.pullFrom, this.pullTo, easeIn(clamp(t, 0, 1)));
      if (this.pullT <= 0) { this.state = "hitstun"; this.stateT = 0; this.stunT = 1.15; }
    }
    if (this.frozenT > 0) {
      this.frozenT -= dt;
      if (this.frozenT <= 0) {
        this.frozenT = 0;
        if (this.state === "frozen") this.state = "idle";
        FX.iceBurst(this.x, this.y - 110); AudioSys.iceBreak();
      }
    }
    if (this.stunT > 0) {
      this.stunT -= dt;
      if (this.stunT <= 0 && this.state === "hitstun") this.state = "idle";
    }
    // physique
    if (!this.grounded || this.vy < 0 || this.state === "launched") {
      this.vy += 2400 * dt;
      this.y += this.vy * dt;
      if (this.y >= GROUND) {
        this.y = GROUND;
        if (this.state === "jump") this.state = "idle";
        if (this.state === "launched") { this.state = "hitstun"; this.stunT = 0.25; this.vx *= 0.3; }
        this.vy = 0;
      }
    }
    this.x += this.vx * dt;
    this.vx *= Math.pow(0.002, dt);   // friction
    this.x = clamp(this.x, 90, W - 90);

    // états temporisés
    if (this.state === "walk") this.stateT += dt;
    if (this.state === "attack") {
      this.stateT += dt;
      const t = this.stateT;
      if (!this.atk) { this.state = this.grounded ? "idle" : "jump"; return; }
      if (this.atk.special && t >= this.atk.startup && !this.atkHit) {
        this.atkHit = true;
        this.spawnSpecial();
      }
      if (!this.atk.special && t >= this.atk.startup && t < this.atk.startup + this.atk.active) {
        if (!this.atkHit || this.atk.name === "UPPERCUT") this.checkHit();
      }
      if (t >= this.atk.startup + this.atk.active + this.atk.recover) {
        if (this.atk.special === "flykick" && !this.grounded) { /* retombe */ }
        this.state = this.grounded ? "idle" : "jump";
        this.atk = null;
      }
    }
    if (this.state === "ko" || this.state === "win") this.vx *= Math.pow(0.01, dt);
  }
  checkHit() {
    const a = this.atk;
    const reach = a.special ? 60 : (a.name === "HK" || a.name === "JUMP KICK" ? 62 : 48);
    const hx = this.x + this.facing * reach;
    const hy = a.height === "low" ? this.y - 40 : this.y - 120;
    const hw = 44, hh = a.height === "low" ? 60 : 110;
    const op = this.opponent;
    const ox = op.x, oy = op.y - 150;
    if (Math.abs(hx - ox) < hw + 20 && Math.abs(hy + hh / 2 - (oy + 90)) < hh / 2 + 90) {
      // l'adversaire bloque ?
      if (op.state === "block" && op.facing === -this.facing && op.grounded && !a.launch) {
        if (op.hitCooldown <= 0) {
          op.hitCooldown = 0.25;
          op.hp = Math.max(0, op.hp - Math.max(1, Math.round(a.dmg * 0.12)));
          if (op.hp <= 0) { op.state = "ko"; AudioSys.ko(); }
          op.vx = this.facing * 90;
          FX.spark((hx + ox) / 2, hy + hh / 2, 8);
          AudioSys.block();
          S.shake = 3;
          this.vx = -this.facing * 120;
          this.atkHit = true;
        }
        return;
      }
      if (op.state !== "ko" && op.state !== "launched" && op.pullT <= 0) {
        op.hitBy(a, this);
        if (a.launch) op.vx = this.facing * 60;
        AudioSys[a.snd]();
        this.atkHit = true;
      }
    }
  }
  spawnSpecial() {
    const k = this.atk.special;
    if (k === "spear") {
      PROJS.push(new Projectile(this, "spear", this.x + this.facing * 40, this.y - 122, this.facing * 950, 0));
    } else if (k === "freeze") {
      PROJS.push(new Projectile(this, "freeze", this.x + this.facing * 40, this.y - 122, this.facing * 720, 0));
    } else if (k === "fireball") {
      PROJS.push(new Projectile(this, "fireball", this.x + this.facing * 40, this.y - 118, this.facing * 1000, 0));
      AudioSys.fire();
    } else if (k === "acid") {
      PROJS.push(new Projectile(this, "acid", this.x + this.facing * 40, this.y - 118, this.facing * 850, -120));
      AudioSys.whoosh();
    } else if (k === "knife") {
      PROJS.push(new Projectile(this, "knife", this.x + this.facing * 40, this.y - 112, this.facing * 1100, 0));
      AudioSys.whoosh();
    } else if (k === "lightning") {
      PROJS.push(new Projectile(this, "lightning", this.x + this.facing * 40, this.y - 112, this.facing * 1300, 0));
      AudioSys.fire();
    } else if (k === "flykick") {
      this.vx = this.facing * 750; this.vy = -350;
      this.atk.air = true;
    }
  }
  drawFighter(g) {
    const f = this;
    const flip = f.facing === -1;
    g.save();
    g.translate(f.x, f.y);
    // rétro-éclairage (lisibilité)
    const bg = g.createRadialGradient(0, -110, 20, 0, -110, 150);
    bg.addColorStop(0, "rgba(255,240,220,.16)");
    bg.addColorStop(1, "rgba(255,240,220,0)");
    g.fillStyle = bg;
    g.fillRect(-160, -300, 320, 320);
    // ombre au sol
    g.fillStyle = "rgba(0,0,0,.4)";
    g.beginPath(); g.ellipse(0, GROUND - f.y + 5, 46, 10, 0, 0, TAU); g.fill();
    // choix de l'animation
    let pose = "idle", frame = 0;
    if (f.state === "walk") { pose = "walk"; frame = Math.floor(f.stateT / 0.12); }
    else if (f.state === "crouch") pose = "crouch";
    else if (f.state === "jump" || f.state === "launched") { pose = "jump"; frame = f.vy >= 0 ? 1 : 0; }
    else if (f.state === "hitstun" || f.state === "pull") pose = "hit";
    else if (f.state === "ko") pose = "ko";
    else if (f.state === "win") pose = "win";
    else if (f.state === "block") pose = "block";
    else if (f.state === "attack") {
      const a = f.atk;
      pose = a.special ? "special" : (a.name === "HK" || a.name === "LK" || a.name === "JUMP KICK" ? "kick" : "punch");
      frame = f.stateT < a.startup ? 0 : 1;
    } else { pose = "idle"; frame = Math.floor(S.time / 0.25); }
    const imgs = SPRITE.anim(f.cid, pose);
    const img = imgs ? imgs[frame % imgs.length] : null;
    const frozen = f.frozenT > 0;
    if (img && img.complete && img.naturalWidth) {
      // Les images modernes ont une résolution supérieure, mais conservent
      // une taille logique comparable aux sprites arcade d'origine.
      const scale = img.isModern ? 0.6 : 2.35;
      const w = img.width * scale, h = img.height * scale;
      g.save();
      if (flip) g.scale(-1, 1);
      if (frozen) {
        g.globalAlpha = 0.9;
        g.drawImage(img, -w / 2, -h, w, h);
        g.globalCompositeOperation = "source-atop";
        g.fillStyle = "rgba(110,200,255,.55)";
        g.fillRect(-w / 2, -h, w, h);
        g.globalCompositeOperation = "source-over";
      } else {
        g.drawImage(img, -w / 2, -h, w, h);
      }
      g.restore();
      if (frozen) {
        g.globalAlpha = 1;
        g.strokeStyle = "rgba(220,245,255,.85)"; g.lineWidth = 3;
        for (let i = 0; i < 7; i++) {
          const a2 = i / 7 * TAU;
          g.beginPath();
          g.moveTo(Math.cos(a2) * 28, Math.sin(a2) * 70 - 110);
          g.lineTo(Math.cos(a2) * (36 + Math.sin(S.time * 9 + i) * 5), Math.sin(a2) * (84 + Math.cos(S.time * 7 + i) * 5) - 110);
          g.stroke();
        }
      }
    } else {
      // repli : silhouette procédurale (si un asset manque)
      const J = poseFrame(pose, frame);
      Pose.draw(g, J, { accent: f.def.accent, cloth: "#171312", skin: "#2a1e12", hood: f.def.hood, flip, shadow: false });
    }
    g.restore();
  }
  inputPose(dir) {
    if (this.state === "attack" || this.state === "hitstun" || this.state === "launched" || this.state === "ko" ||
        this.state === "pull" || this.frozenT > 0 || this.pullT > 0) return;
    this.blocking = false;
    if (dir.block && this.grounded) { this.state = "block"; this.blocking = true; return; }
    if (dir.up && !this.upHeld) this.jump();
    // On garde la direction de l'adversaire : reculer ne retourne pas le personnage.
    if (!this.grounded) {
      if (dir.left !== dir.right) this.x = clamp(this.x + (dir.left ? -1 : 1) * 250 * DT, 90, W - 90);
      return;
    }
    if (dir.down) { this.crouch(); return; }
    if (dir.left !== dir.right) {
      const d = dir.left ? -1 : 1;
      if (this.state !== "walk") this.stateT = 0;
      this.state = "walk";
      this.x = clamp(this.x + d * 250 * DT, 90, W - 90);
      return;
    }
    if (this.state === "walk" || this.state === "crouch" || this.state === "block") this.state = "idle";
  }
}

/* ---------- projectile ---------- */
class Projectile {
  constructor(owner, kind, x, y, vx, vy) {
    this.owner = owner; this.kind = kind; this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.dead = false; this.t = 0; this.pullTarget = null;
  }
  update(dt) {
    this.t += dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.x < 60 || this.x > W - 60 || this.t > 4) { this.dead = true; return; }
    const op = this.owner.opponent;
    if (!op || op.state === "ko") return;
    if (Math.abs(this.x - op.x) < 30 && Math.abs(this.y - (op.y - 120)) < 90) {
      if (op.state === "crouch" && this.kind !== "spear" && this.y > op.y - 90) { return; } // passe au-dessus si accroupi
      this.hit(op);
    }
  }
  hit(op) {
    this.dead = true;
    if (this.kind === "spear") {
      FX.spark(op.x, op.y - 120, 10);
      AudioSys.thunk();
      op.pullT = 0.45; op.pullFrom = op.x; op.pullTo = this.owner.x + this.owner.facing * 60;
      op.state = "pull"; op.stunT = 0;
    } else if (this.kind === "freeze") {
      op.frozenT = 1.7; op.state = "frozen";
      FX.iceBurst(op.x, op.y - 110);
      AudioSys.freeze();
      op.hp = Math.max(0, op.hp - 2);
    } else if (this.kind === "fireball" || this.kind === "acid" || this.kind === "knife") {
      op.hitBy({ dmg: this.kind === "acid" ? 6 : this.kind === "knife" ? 5 : 9, launch: false, knock: 260 }, this.owner);
      if (this.kind === "acid") FX.acidSplash(op.x + this.owner.facing * 20, op.y - 115, 14);
      else if (this.kind === "fireball") FX.fireBurst(op.x + this.owner.facing * 20, op.y - 115, 16);
      else FX.spark(op.x, op.y - 110, 8);
      AudioSys.fire();
      FX.shake(7); S.shake = 7;
    } else if (this.kind === "lightning") {
      op.hitBy({ dmg: 10, launch: false, knock: 300 }, this.owner);
      FX.lightningBurst(op.x, op.y - 110);
      AudioSys.ko();
      FX.shake(10); S.shake = 10;
    }
  }
  draw(g) {
    if (this.kind === "spear") {
      // corde depuis le lanceur
      g.strokeStyle = "rgba(200,190,160,.9)"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(this.owner.x + this.owner.facing * 30, this.owner.y - 116);
      const sag = Math.sin(this.t * 18) * 6;
      g.quadraticCurveTo((this.x + this.owner.x) / 2, this.y + 30 + sag, this.x, this.y);
      g.stroke();
      // harpon
      g.save(); g.translate(this.x, this.y); g.rotate(Math.atan2(this.vx, 0));
      g.fillStyle = "#cfd6dd";
      g.beginPath();
      g.moveTo(14, 0); g.lineTo(-6, -5); g.lineTo(-2, 0); g.lineTo(-6, 5); g.closePath(); g.fill();
      g.fillStyle = "#8f9aa6";
      g.fillRect(-12, -2, 8, 4);
      g.restore();
    } else if (this.kind === "freeze") {
      g.save(); g.translate(this.x, this.y);
      g.shadowColor = "#29c7ff"; g.shadowBlur = 16;
      g.fillStyle = "#bfeaff";
      g.beginPath(); g.arc(0, 0, 11, 0, TAU); g.fill();
      g.fillStyle = "#7fd8ff";
      g.beginPath(); g.arc(-3, -3, 5, 0, TAU); g.fill();
      g.restore();
      FX.trail(this.x - this.vx * 0.03, this.y, "rgba(120,220,255,.35)", 6);
    } else if (this.kind === "fireball") {
      g.save(); g.translate(this.x, this.y);
      g.shadowColor = "#ff8a00"; g.shadowBlur = 22;
      g.fillStyle = "#ffd166";
      g.beginPath(); g.arc(0, 0, 13, 0, TAU); g.fill();
      g.fillStyle = "#ff8a00";
      g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fill();
      g.fillStyle = "#fff";
      g.beginPath(); g.arc(-2, -2, 3, 0, TAU); g.fill();
      g.restore();
      FX.trail(this.x - this.vx * 0.03, this.y, "rgba(255,140,40,.4)", 8);
    } else if (this.kind === "acid") {
      const img = SPRITE.fx("acid", Math.floor(this.t * 14));
      if (img) g.drawImage(img, this.x - img.width / 2, this.y - img.height / 2);
      FX.trail(this.x - this.vx * 0.03, this.y, "rgba(90,220,60,.4)", 6);
    } else if (this.kind === "knife") {
      g.save(); g.translate(this.x, this.y); g.rotate(this.t * 30);
      g.fillStyle = "#cfd6dd";
      g.fillRect(-10, -2, 20, 4);
      g.fillStyle = "#5a4632";
      g.fillRect(-14, -3, 5, 6);
      g.restore();
    } else if (this.kind === "lightning") {
      g.save();
      g.shadowColor = "#7fb2ff"; g.shadowBlur = 18;
      g.strokeStyle = "#e8f4ff"; g.lineWidth = 4;
      g.beginPath();
      const dir = Math.sign(this.vx) || 1;
      let lx = this.x - dir * 40, ly = this.y;
      g.moveTo(lx, ly);
      for (let i = 0; i < 4; i++) {
        lx += dir * 22; ly = this.y + rand(-24, 24);
        g.lineTo(lx, ly);
      }
      g.stroke();
      g.fillStyle = "#fff";
      g.beginPath(); g.arc(this.x, this.y, 7, 0, TAU); g.fill();
      g.restore();
      FX.trail(this.x - this.vx * 0.02, this.y, "rgba(160,200,255,.5)", 5);
    }
  }
}

/* ---------- sprites extraits (assets.js) ---------- */
const SPRITE = {
  cache: {}, ready: false,
  load(onDone) {
    const src = (window.GAME_ASSETS && GAME_ASSETS.sprites) ? GAME_ASSETS.sprites : {};
    const queue = [];
    const modernFighters = new Set(["scorpion", "subzero", "reptile", "liukang", "kano", "raiden"]);
    const makeImage = (uri, fallback = null) => {
      const im = new Image();
      im.isModern = !!fallback;
      queue.push({ im, uri, fallback });
      return im;
    };
    for (const key in src) {
      const obj = src[key];
      if (Array.isArray(obj)) {
        this.cache[key] = { frames: obj.map((uri) => makeImage(uri)) };
      } else if (obj && typeof obj === "object") {
        this.cache[key] = {};
        if (modernFighters.has(key)) {
          const hit = key === "scorpion" ? "block" : "hit";
          const block = key === "scorpion" ? "block" : "crouch";
          const poses = { idle: ["idle"], walk: ["idle", "walk"], crouch: ["crouch"],
            jump: ["jump"], hit: [hit], ko: ["ko"], win: ["idle"], block: [block],
            punch: ["idle", "punch"], kick: ["idle", "kick"], special: ["idle", "punch"] };
          for (const [anim, frames] of Object.entries(poses)) {
            const original = obj[anim] || (anim === "block" ? obj.crouch : null) || obj.idle;
            this.cache[key][anim] = frames.map((frame, i) =>
              makeImage(`assets/sprites-modern/${key}/${frame}.png`, original[i % original.length]));
          }
        } else {
          for (const anim in obj) this.cache[key][anim] = obj[anim].map(uri => makeImage(uri));
        }
      }
    }
    let done = 0;
    const finish = () => { this.ready = true; onDone && onDone(); };
    if (!queue.length) { finish(); return; }
    queue.forEach(({ im, uri, fallback }) => {
      const complete = () => { done++; if (done === queue.length) finish(); };
      im.onload = complete;
      im.onerror = () => {
        if (fallback) {
          const original = fallback; fallback = null;
          im.isModern = false;
          im.src = original;
        } else complete();
      };
      im.src = uri;
    });
  },
  anim(cid, anim) {
    const c = this.cache[cid];
    if (!c) return null;
    if (c.frames) return c.frames;
    const a = c[anim];
    if (!a || !a.length) {
      for (const k in c) { if (c[k] && c[k].length) return c[k]; }
      return null;
    }
    return a;
  },
  fx(kind, i) {
    const c = this.cache["fx_" + kind];
    if (!c || !c.frames || !c.frames.length) return null;
    return c.frames[i % c.frames.length];
  },
};

/* ---------- FX : particules ---------- */
const FX = {
  parts: [],
  gore: [],
  shakeT: 0,
  blood(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.parts.push({ x, y, vx: rand(-160, 160), vy: rand(-320, 60), g: 1400, t: 0, life: rand(0.25, 0.6), size: rand(2, 5), col: pick(["#d4141e", "#a80f18", "#ff3b30"]) });
    }
  },
  goreSplat(x, y, dir) {
    const img = SPRITE.fx("blood", randi(0, 5));
    if (img && img.complete && img.naturalWidth) {
      this.gore.push({ x, y, dir, t: 0, life: 0.5, img });
    }
  },
  acidSplash(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.parts.push({ x, y, vx: rand(-200, 200), vy: rand(-260, 60), g: 1500, t: 0, life: rand(0.2, 0.5), size: rand(2, 6), col: pick(["#4fe04f", "#8fe04f", "#2e9e2e"]) });
    }
  },
  lightningBurst(x, y) {
    for (let i = 0; i < 16; i++) {
      this.parts.push({ x, y, vx: rand(-320, 320), vy: rand(-300, 100), g: 700, t: 0, life: rand(0.1, 0.3), size: rand(2, 5), col: pick(["#e8f4ff", "#7fb2ff", "#fff"]) });
    }
  },
  spark(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.parts.push({ x, y, vx: rand(-260, 260), vy: rand(-320, 120), g: 900, t: 0, life: rand(0.12, 0.3), size: rand(1.5, 3), col: pick(["#fff6c8", "#ffd166", "#fff"]) });
    }
  },
  iceBurst(x, y) {
    for (let i = 0; i < 22; i++) {
      this.parts.push({ x, y, vx: rand(-280, 280), vy: rand(-380, 60), g: 1600, t: 0, life: rand(0.3, 0.7), size: rand(2, 6), col: pick(["#bfeaff", "#7fd8ff", "#eafcff"]) });
    }
  },
  fireBurst(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.parts.push({ x, y, vx: rand(-240, 240), vy: rand(-280, 40), g: 500, t: 0, life: rand(0.2, 0.5), size: rand(3, 7), col: pick(["#ffd166", "#ff8a00", "#ff5c00"]) });
    }
  },
  trail(x, y, col, size) {
    this.parts.push({ x, y, vx: 0, vy: 0, g: 0, t: 0, life: 0.18, size, col });
  },
  hitStop(t) { this.stopT = t; },
  shake(n) { this.shakeT = Math.max(this.shakeT, n); },
  update(dt) {
    for (let i = this.gore.length - 1; i >= 0; i--) {
      const p = this.gore[i];
      p.t += dt;
      if (p.t >= p.life) this.gore.splice(i, 1);
    }
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.t += dt;
      if (p.t >= p.life) { this.parts.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  },
  draw(g) {
    for (const p of this.gore) {
      g.globalAlpha = 1 - p.t / p.life;
      const img = p.img;
      g.save();
      g.translate(p.x, p.y);
      if (p.dir < 0) g.scale(-1, 1);
      g.drawImage(img, -img.width / 2, -img.height / 2);
      g.restore();
    }
    for (const p of this.parts) {
      g.globalAlpha = 1 - p.t / p.life;
      g.fillStyle = p.col;
      g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    g.globalAlpha = 1;
  },
};

/* ---------- IA ---------- */
class AI {
  constructor(tier) {
    this.tier = tier;               // 0 facile, 1 normal, 2 difficile
    this.decideT = 0;
    this.mode = "approach";
    this.blockT = 0;
  }
  step(f, op, dt) {
    const d = {
      left: false, right: false, up: false, down: false,
      hp: false, lp: false, hk: false, lk: false, block: false,
    };
    this.decideT -= dt;
    const dist = Math.abs(op.x - f.x);
    const tier = this.tier;
    if (this.decideT <= 0) {
      this.decideT = rand(0.28, 0.7) - tier * 0.08;
      const r = Math.random();
      if (dist > 300) this.mode = "approach";
      else if (dist < 90) this.mode = r < 0.45 ? "attack" : (r < 0.65 ? "retreat" : "block");
      else this.mode = r < 0.35 ? "attack" : (r < 0.5 ? "approach" : (r < 0.68 ? "block" : "idle"));
      if (tier === 2 && Math.random() < 0.12) this.mode = "special";
      if (op.state === "attack" && Math.random() < 0.5 - tier * 0.1) this.mode = "block";
    }
    const dirTo = op.x > f.x ? 1 : -1;
    switch (this.mode) {
      case "approach": d.left = dirTo < 0; d.right = dirTo > 0; break;
      case "retreat": d.left = dirTo > 0; d.right = dirTo < 0; break;
      case "attack": {
        if (op.grounded) {
          if (Math.random() < 0.08 && tier > 0) d.up = true;
          else {
            const moves = ["hp", "lp", "hk", "lk"];
            const m = moves[randi(0, tier >= 1 ? 3 : 2)];
            d[m] = true;
          }
        }
        break;
      }
      case "block": d.block = true; break;
      case "special": {
        if (op.grounded && !f.busy) {
          f.doSpecial(f.def.special);
        }
        break;
      }
      case "idle": break;
    }
    // éviter de sortir de l'arène
    if (f.x < 150) d.right = true;
    if (f.x > W - 150) d.left = true;
    // anti-aérien
    if (!op.grounded && dist < 130 && Math.random() < 0.4) d.block = true;
    return d;
  }
}

/* ============================================================
   SCÈNES
   ============================================================ */
function sceneText(g, txt, x, y, size, col, opts = {}) {
  g.save();
  g.font = `900 ${size}px "SF Mono", Menlo, Consolas, monospace`;
  g.textAlign = opts.align || "center";
  g.textBaseline = "middle";
  g.letterSpacing = "4px";
  if (opts.glow) { g.shadowColor = opts.glow; g.shadowBlur = 22; }
  g.fillStyle = col;
  g.fillText(txt, x, y);
  g.restore();
}

/* ---------- arrière-plan d'arène ---------- */
const arenaImage = new Image();
arenaImage.src = "assets/arenas/courtyard-modern.png";
function drawArena(g) {
  if (arenaImage.complete && arenaImage.naturalWidth && arenaImage.naturalHeight) {
    // Remplir le canvas sans déformer l'image, en centrant le recadrage.
    const scale = Math.max(W / arenaImage.naturalWidth, H / arenaImage.naturalHeight);
    const w = arenaImage.naturalWidth * scale, h = arenaImage.naturalHeight * scale;
    g.drawImage(arenaImage, (W - w) / 2, (H - h) / 2, w, h);
    return;
  }
  const sky = g.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, "#05030f");
  sky.addColorStop(0.55, "#1a0f2e");
  sky.addColorStop(1, "#2e1440");
  g.fillStyle = sky;
  g.fillRect(0, 0, W, GROUND);
  // lune
  g.save();
  g.shadowColor = "rgba(255,240,200,.8)"; g.shadowBlur = 40;
  g.fillStyle = "#f5ead0";
  g.beginPath(); g.arc(1050, 130, 52, 0, TAU); g.fill();
  g.restore();
  g.fillStyle = "rgba(10,5,20,.35)";
  g.beginPath(); g.arc(1030, 120, 46, 0, TAU); g.fill();
  // montagnes / silhouettes
  g.fillStyle = "#0d0720";
  g.beginPath(); g.moveTo(0, GROUND);
  for (let x = 0; x <= W; x += 40) g.lineTo(x, GROUND - 120 - Math.sin(x * 0.011) * 60 - Math.cos(x * 0.023) * 30);
  g.lineTo(W, GROUND); g.closePath(); g.fill();
  // plateforme
  const stone = g.createLinearGradient(0, GROUND, 0, H);
  stone.addColorStop(0, "#241640"); stone.addColorStop(1, "#0d0720");
  g.fillStyle = stone;
  g.fillRect(0, GROUND, W, H - GROUND);
  g.strokeStyle = "#3a2560"; g.lineWidth = 2;
  for (let x = 0; x < W; x += 80) {
    g.beginPath(); g.moveTo(x, GROUND); g.lineTo(x + 80, GROUND);
    for (let y = GROUND; y < H; y += 24) { g.beginPath(); g.moveTo(x + ((y / 24) % 2) * 40, y); g.lineTo(x + 40 + ((y / 24) % 2) * 40, y); g.stroke(); }
  }
  // torches
  const torch = (x, dir) => {
    g.fillStyle = "#3a2a18";
    g.fillRect(x - 4, GROUND - 110, 8, 110);
    g.fillStyle = "#5a4020";
    g.fillRect(x - 10, GROUND - 118, 20, 10);
    const fx2 = x + Math.sin(S.time * 9 + x) * 3;
    const fl = 34 + Math.sin(S.time * 13 + x * 2) * 6;
    g.save();
    g.shadowColor = "#ff8a00"; g.shadowBlur = 26;
    g.fillStyle = "#ffd166";
    g.beginPath(); g.ellipse(fx2, GROUND - 130 - fl / 2, 7, fl / 2, 0, 0, TAU); g.fill();
    g.fillStyle = "#ff5c00";
    g.beginPath(); g.ellipse(fx2, GROUND - 128 - fl / 4, 4, fl / 3, 0, 0, TAU); g.fill();
    g.restore();
  };
  torch(140, 1); torch(W - 140, -1);
  // brume au sol
  g.fillStyle = "rgba(90,60,160,.08)";
  g.fillRect(0, GROUND - 24, W, 24);
}

/* ---------- HUD ---------- */
function drawHUD(g, a, b, round, timeLeft) {
  // noms
  sceneText(g, a.def.name, 240, 46, 20, "#e8e2f5", { glow: a.def.accent, align: "left" });
  sceneText(g, b.def.name, W - 240, 46, 20, "#e8e2f5", { glow: b.def.accent, align: "right" });
  // barres de vie
  const barW = 420, bh = 26, by = 64;
  const drawBar = (x, hp, col, flip) => {
    g.fillStyle = "#0a0616";
    g.fillRect(x, by, barW, bh);
    g.strokeStyle = "#3a2560"; g.lineWidth = 2;
    g.strokeRect(x, by, barW, bh);
    const w = barW * clamp(hp / 100, 0, 1);
    const grad = g.createLinearGradient(0, by, 0, by + bh);
    grad.addColorStop(0, col[0]); grad.addColorStop(1, col[1]);
    g.fillStyle = grad;
    if (flip) g.fillRect(x + barW - w, by, w, bh);
    else g.fillRect(x, by, w, bh);
    g.fillStyle = "rgba(255,255,255,.18)";
    if (flip) g.fillRect(x + barW - w, by, w, 5); else g.fillRect(x, by, w, 5);
  };
  drawBar(60, a.hp, ["#ffe684", "#d69518"], false);
  drawBar(W - 60 - barW, b.hp, ["#ffe684", "#d69518"], true);
  // portrait mini (tête stylisée)
  const mini = (x, def, flip) => {
    g.save(); g.translate(x, by + bh / 2);
    g.fillStyle = "#0a0616";
    g.beginPath(); g.arc(0, 0, 24, 0, TAU); g.fill();
    g.strokeStyle = def.accent; g.lineWidth = 2;
    g.stroke();
    g.fillStyle = def.cloth;
    g.beginPath(); g.arc(0, -2, 14, 0, TAU); g.fill();
    g.fillStyle = def.accent;
    g.beginPath(); g.arc(-4, -7, 2, 0, TAU); g.arc(5, -7, 2, 0, TAU); g.fill();
    g.restore();
  };
  mini(60 + barW + 40, a.def); mini(W - 60 - barW - 40, b.def);
  // timer
  g.fillStyle = "#0a0616";
  g.beginPath(); g.arc(W / 2, 78, 30, 0, TAU); g.fill();
  g.strokeStyle = "#3a2560"; g.lineWidth = 3; g.stroke();
  sceneText(g, String(Math.max(0, Math.ceil(timeLeft))), W / 2, 78, 26, timeLeft < 10 ? "#ff4d5e" : "#ffd166");
  // pips de rounds (2 par joueur)
  const pip = (x, side, idx, won) => {
    g.beginPath(); g.arc(x, 130, 8, 0, TAU);
    g.fillStyle = won ? "#ffd166" : "rgba(255,255,255,.08)";
    g.fill();
    g.strokeStyle = won ? "#ffd166" : "#3a2560"; g.lineWidth = 2; g.stroke();
  };
  pip(210, 1, 0, a.rounds > 0); pip(240, 1, 1, a.rounds > 1);
  pip(W - 210, 2, 0, b.rounds > 0); pip(W - 240, 2, 1, b.rounds > 1);
  // petit rappel commandes
  g.globalAlpha = 0.5;
  sceneText(g, "H = aide", W / 2, H - 26, 12, "#9b8fc4");
  g.globalAlpha = 1;
}

/* ---------- scène : TITRE + MENU ---------- */
const TitleScene = {
  name: "title",
  items: ["SOLO", "VERSUS", "COMMANDES", "RETOUR À LA COLLECTION"],
  sel: 0,
  enter() { S.sel = 0; AudioSys.startMusic("title"); },
  update(dt) {
    if (Input.pressed("up")) { this.sel = (this.sel + 3) % 4; AudioSys.select(); }
    if (Input.pressed("down")) { this.sel = (this.sel + 1) % 4; AudioSys.select(); }
    if (Input.pressed("start")) this.activate(this.sel);
  },
  activate(i) {
    AudioSys.select();
    if (i === 0) { S.mode = "solo"; switchScene(SelectScene); }
    else if (i === 1) { S.mode = "versus"; switchScene(SelectScene); }
    else if (i === 2) { toggleHelp(true); }
    else { leaveGame(); }
  },
  click(x, y) {
    for (let i = 0; i < 4; i++) {
      const r = { x: W / 2 - 250, y: 380 + i * 66, w: 500, h: 50 };
      if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) { this.sel = i; this.activate(i); return; }
    }
  },
  draw(g) {
    drawArena(g);
    g.fillStyle = "rgba(5,3,12,.55)";
    g.fillRect(0, 0, W, H);
    // emblème dragon (original stylisé)
    g.save(); g.translate(W / 2, 190);
    g.rotate(Math.sin(S.time * 0.5) * 0.02);
    g.shadowColor = "#ffd166"; g.shadowBlur = 30;
    g.strokeStyle = "#ffd166"; g.lineWidth = 5;
    g.beginPath(); g.arc(0, 0, 62, 0, TAU); g.stroke();
    g.lineWidth = 8;
    g.beginPath(); g.moveTo(-38, -26); g.quadraticCurveTo(-10, -52, 26, -40);
    g.quadraticCurveTo(44, -20, 34, 8); g.quadraticCurveTo(20, 26, -4, 24);
    g.quadraticCurveTo(-24, 22, -30, 4); g.quadraticCurveTo(-36, -8, -38, -26); g.stroke();
    g.fillStyle = "#ff2a6d";
    g.beginPath(); g.arc(26, -40, 5, 0, TAU); g.fill();
    g.restore();
    sceneText(g, "MORTAL KOMBAT", W / 2, 310, 72, "#ffd166", { glow: "#ff2a6d" });
    sceneText(g, "— REMAKE NATIF · 1993 —", W / 2, 352, 16, "#cfc3f0");
    this.items.forEach((it, i) => {
      const on = i === this.sel;
      if (on) {
        g.fillStyle = "rgba(74, 34, 18, .85)";
        g.fillRect(W / 2 - 250, 380 + i * 66, 500, 50);
        g.strokeStyle = "#ffd166"; g.lineWidth = 3;
        g.strokeRect(W / 2 - 250, 380 + i * 66, 500, 50);
      }
      sceneText(g, (on ? "► " : "   ") + it, W / 2, 405 + i * 66, 26, on ? "#fff" : "#c8bcd8", { glow: on ? "#ff8a00" : null });
    });
    sceneText(g, "ENTRÉE = valider · ↑↓ = naviguer", W / 2, H - 40, 13, "#7c6fa8");
  },
};

/* ---------- scène : SÉLECTION ---------- */
const SelectScene = {
  name: "select",
  roster: Object.keys(CHARACTERS),
  cur: 0, picked: [],
  side: 1,
  cursorT: 0,
  enter() { this.cur = 0; this.picked = []; this.side = 1; },
  update(dt) {
    this.cursorT += dt;
    const n = this.roster.length;
    if (Input.pressed("left")) { this.cur = (this.cur + n - 1) % n; AudioSys.select(); }
    if (Input.pressed("right")) { this.cur = (this.cur + 1) % n; AudioSys.select(); }
    if (Input.pressed("start") || Input.pressed("hp")) this.pickCurrent();
    if (Input.pressed("esc")) switchScene(TitleScene);
  },
  pickCurrent() {
    const cid = this.roster[this.cur];
    this.picked.push(cid);
    AudioSys.victory();
    if (this.picked.length === 2 || (S.mode === "solo" && this.picked.length === 1)) {
      S.p1 = new Fighter(this.picked[0], 1);
      const opponents = this.roster.filter(c => c !== this.picked[0]);
      // Mélange sans doublons : trois adversaires différents à chaque parcours.
      for (let i = opponents.length - 1; i > 0; i--) {
        const j = randi(0, i);
        [opponents[i], opponents[j]] = [opponents[j], opponents[i]];
      }
      S.ladder = S.mode === "solo" ? opponents.slice(0, 3) : [];
      const p2c = S.mode === "versus" ? this.picked[1] : S.ladder[0];
      S.p2 = new Fighter(p2c, 2);
      S.ladderIndex = 0;
      switchScene(FightScene);
      return;
    }
    this.side = 2;
  },
  click(x, y) {
    const n = this.roster.length;
    const w = 170, gap = 30, total = n * w + (n - 1) * gap;
    let sx = W / 2 - total / 2;
    for (let i = 0; i < n; i++) {
      if (x > sx && x < sx + w && y > 260 && y < 640) { this.cur = i; this.pickCurrent(); return; }
      sx += w + gap;
    }
  },
  draw(g) {
    drawArena(g);
    g.fillStyle = "rgba(5,3,12,.72)";
    g.fillRect(0, 0, W, H);
    sceneText(g, S.mode === "versus" ? "CHOISISSEZ VOS COMBATTANTS" : "CHOISISSEZ VOTRE COMBATTANT", W / 2, 70, 30, "#ffd166", { glow: "#ff2a6d" });
    sceneText(g, this.side === 1 ? "JOUEUR 1" : "JOUEUR 2", W / 2, 118, 20, this.side === 1 ? "#3ddc84" : "#ff4d5e");
    const n = this.roster.length;
    const w = 170, gap = 30, total = n * w + (n - 1) * gap;
    let sx = W / 2 - total / 2;
    this.roster.forEach((cid, i) => {
      const def = CHARACTERS[cid];
      const on = i === this.cur;
      g.save();
      if (on) { g.shadowColor = def.accent; g.shadowBlur = 30; }
      g.fillStyle = on ? "rgba(35,20,60,.95)" : "rgba(12,8,24,.9)";
      g.strokeStyle = on ? def.accent : "#3a2560";
      g.lineWidth = on ? 3 : 1;
      g.beginPath(); g.roundRect(sx, 260, w, 360, 14); g.fill(); g.stroke();
      g.restore();
      // aperçu du combattant (sprite extrait)
      const imgs = SPRITE.anim(cid, "idle");
      const img = imgs ? imgs[0] : null;
      if (img && img.complete && img.naturalWidth) {
        const sc = Math.min((w - 40) / img.width, 220 / img.height);
        g.drawImage(img, sx + w / 2 - img.width * sc / 2, 300, img.width * sc, img.height * sc);
      }
      sceneText(g, def.name, sx + w / 2, 550, 18, on ? def.accent : "#cfc3f0");
      sceneText(g, def.specialName, sx + w / 2, 576, 11, "#9b8fc4");
      sceneText(g, def.specialInput, sx + w / 2, 596, 11, "#7c6fa8");
      if (this.picked[0] === cid) {
        g.fillStyle = "rgba(61,220,132,.9)";
        g.beginPath(); g.arc(sx + w - 22, 282, 11, 0, TAU); g.fill();
        sceneText(g, "1", sx + w - 22, 282, 13, "#04210f");
      }
      sx += w + gap;
    });
    sceneText(g, "← → = choisir · ENTRÉE = valider", W / 2, H - 40, 13, "#7c6fa8");
  },
};

/* ---------- scène : COMBAT ---------- */
const FightScene = {
  name: "fight",
  state: "intro",     // intro | fight | finish | fatality | roundend | match
  t: 0, roundTime: 60, roundNum: 1,
  fatalityT: 0,
  enter() {
    this.t = 0; this.roundTime = 60; this.roundNum = 1; this.fatalityDone = false; this.fightAnnounced = false;
    S.p1.reset(false); S.p2.reset(false);
    this.link();
    this.state = "intro";
    PROJS.length = 0; FX.parts.length = 0;
    AudioSys.startMusic("fight");
    // mode démo (IA vs IA) via URL ?mode=ai
    if (S.mode === "ai") {
      S.p1.ai = new AI(2); S.p2.ai = new AI(2);
    } else if (S.mode === "solo") {
      S.p2.ai = new AI(Math.min(2, S.ladderIndex));
    }
  },
  link() { S.p1.opponent = S.p2; S.p2.opponent = S.p1; },
  roundStart() {
    this.state = "intro"; this.t = 0; this.roundTime = 60; this.fightAnnounced = false;
    S.p1.reset(false); S.p2.reset(false);
    S.p1.x = 380; S.p2.x = 900;
    this.link();
    PROJS.length = 0; FX.parts.length = 0;
    AudioSys.gong();
  },
  update(dt) {
    this.t += dt;
    const a = S.p1, b = S.p2;
    if (this.state === "intro") {
      if (this.t >= 1.4 && !this.fightAnnounced) {
        this.fightAnnounced = true;
        AudioSys.announce("fight");
      }
      if (this.t > 2.2) { this.state = "fight"; this.t = 0; }
      return;
    }
    if (this.state === "fight") {
      this.roundTime -= dt;
      // contrôles
      const dir1 = S.mode === "ai" ? a.ai.step(a, b, dt) : Input.player1();
      const dir2 = S.mode === "versus" ? Input.player2() : (b.ai ? b.ai.step(b, a, dt) : Input.player1());
      if (!a.busy && a.grounded) a.facing = b.x >= a.x ? 1 : -1;
      if (!b.busy && b.grounded) b.facing = a.x >= b.x ? 1 : -1;
      a.inputPose(dir1);
      b.inputPose(dir2);
      // boutons
      const btns1 = S.mode === "ai" ? dir1 : Input.player1();
      const btns2 = S.mode === "versus" ? Input.player2() : dir2;
      this.handleButtons(a, btns1, dt);
      this.handleButtons(b, btns2, dt);
      // IA spéciale
      if (b.ai && S.mode !== "ai") { /* buffer géré par handleButtons via dir */ }
      a.update(dt); b.update(dt);
      for (const p of PROJS) p.update(dt);
      PROJS = PROJS.filter(p => !p.dead);
      // timer écoulé
      if (this.roundTime <= 0) {
        const w = a.hp >= b.hp ? a : b;
        this.endRound(w);
        return;
      }
      // KO
      if (a.state === "ko" || b.state === "ko") {
        const loser = a.state === "ko" ? a : b;
        const winner = loser === a ? b : a;
        winner.state = "win"; winner.stateT = 0;
        this.state = "finish"; this.t = 0;
        AudioSys.victory();
      }
      return;
    }
    if (this.state === "finish") {
      a.update(dt); b.update(dt);
      const winner = a.state === "win" ? a : b;
      const loser = winner === a ? b : a;
      winner.state = "win";
      if (this.t > 1.6) {
        const needs = winner.rounds + 1 >= 2;
        if (needs) { this.state = "fatality"; this.fatalityT = 0; this.t = 0; AudioSys.announce("finish"); }
        else { this.endRound(winner); }
      }
      return;
    }
    if (this.state === "fatality") {
      this.fatalityT += dt;
      const winner = a.state === "win" ? a : b;
      const loser = winner === a ? b : a;
      a.update(dt); b.update(dt);
      winner.state = "win"; loser.state = "ko";
      // fenêtre de fatality : refaire son spécial
      if (winner === a) {
        this.handleButtons(winner, S.mode === "ai" ? winner.ai.step(winner, loser, dt) : Input.player1(), dt);
      } else if (S.mode === "versus" || S.mode === "ai") {
        this.handleButtons(winner, S.mode === "ai" ? winner.ai.step(winner, loser, dt) : Input.player2(), dt);
      }
      if (this.fatalityT > 0.5 && this.fatalityT < 6 && winner.hasSpecialBuffered()) {
        this.doFatality(winner, loser);
      }
      if (this.fatalityT > 6) { this.endMatch(winner); }
      return;
    }
    if (this.state === "roundend") {
      if (this.t > 2.0) this.roundStart();
      return;
    }
    if (this.state === "match") {
      if (this.t > 2.4) {
        if (S.mode === "solo" && S.winner !== S.p1) {
          switchScene(TitleScene);
        } else if (S.mode === "solo" && S.ladderIndex < S.ladder.length - 1) {
          S.ladderIndex++;
          S.p1.rounds = 0;
          this.fatalityDone = false;
          S.p2 = new Fighter(S.ladder[S.ladderIndex], 2);
          S.p2.ai = new AI(Math.min(2, S.ladderIndex));
          this.roundNum = 1;
          this.link();
          this.roundStart();
        } else if (S.mode === "solo") {
          switchScene(EndingScene);
        } else if (S.mode === "versus" || S.mode === "ai") {
          switchScene(VersusEndScene);
        }
      }
      return;
    }
  },
  handleButtons(f, dir, dt) {
    // Une séquence doit être saisie rapidement ; les directions sont lues avant
    // les boutons afin que direction + coup sur la même frame fonctionne.
    if (S.time - f.bufferAt > 0.8) f.buffer.length = 0;
    const record = (value) => {
      f.buffer.push(value);
      if (f.buffer.length > 8) f.buffer.shift();
      f.bufferAt = S.time;
    };
    for (const [key, value] of [
      ["left", f.facing === 1 ? "B" : "F"],
      ["right", f.facing === 1 ? "F" : "B"],
      ["down", "D"], ["up", "U"],
    ]) {
      if (dir[key] && !f[key + "Held"]) record(value);
      f[key + "Held"] = !!dir[key];
    }
    let pressed = null;
    for (const key of ["hp", "lp", "hk", "lk"]) {
      if (dir[key] && !f[key + "Held"] && !pressed) pressed = key;
      f[key + "Held"] = !!dir[key];
    }
    if (pressed) {
      record(pressed.toUpperCase());
      if (f.trySpecial()) f.buffer.length = 0;
      else if (!f.grounded) f.startAttack(pressed === "hp" || pressed === "lp" ? "jp" : "jk", true);
      else f.startAttack(pressed);
    }
  },
  endRound(winner) {
    winner.rounds++;
    winner.state = "win";
    this.t = 0;
    if (winner.rounds >= 2) this.endMatch(winner);
    else { this.state = "roundend"; this.roundNum++; }
    AudioSys.victory();
  },
  doFatality(winner, loser) {
    this.state = "match"; this.t = 0;
    AudioSys.announce("fatality");
    S.winner = winner;
    FX.blood(loser.x, loser.y - 100, 60);
    FX.shake(16); S.shake = 16;
    AudioSys.ko();
    this.fatalityDone = true;
  },
  endMatch(winner) {
    this.state = "match"; this.t = 0;
    S.winner = winner;
  },
  draw(g) {
    drawArena(g);
    // projectiles
    for (const p of PROJS) p.draw(g);
    // combattants
    const a = S.p1, b = S.p2;
    b.drawFighter(g);
    a.drawFighter(g);
    // particules
    FX.draw(g);
    // HUD
    drawHUD(g, a, b, this.roundNum, this.roundTime);
    // textes d'état
    const c = g;
    if (this.state === "intro") {
      c.fillStyle = "rgba(5,3,12,.6)"; c.fillRect(0, 0, W, H);
      if (this.t < 1.4) {
        const k = 1 + easeOut(clamp(this.t / 0.4, 0, 1)) * 1.6;
        c.save(); c.translate(W / 2, H / 2 - 40); c.scale(k, k);
        sceneText(c, "ROUND " + this.roundNum, 0, 0, 44, "#ffd166", { glow: "#ff2a6d" });
        c.restore();
      } else {
        sceneText(c, "FIGHT !", W / 2, H / 2 - 40, 80, "#ff2a6d", { glow: "#ffd166" });
        if (this.t > 1.9) sceneText(c, "FIGHT !", W / 2, H / 2 - 40, 80, "#ffd166", { glow: "#ff2a6d" });
      }
    }
    if (this.state === "finish") {
      sceneText(c, "K.O.", W / 2, H / 2 - 60, 90, "#ff2a6d", { glow: "#fff" });
    }
    if (this.state === "fatality") {
      const loser = a.state === "ko" ? a : b;
      sceneText(c, "FINISH " + (loser.def.name === "SCORPION" ? "HIM" : "HIM") + " !", W / 2, H / 2 - 60, 56, "#ff2a6d", { glow: "#ffd166" });
      sceneText(c, "refaites votre spécial : " + (a.state === "win" ? a.def.specialInput : b.def.specialInput), W / 2, H / 2 + 10, 18, "#cfc3f0");
      if (this.fatalityDone) {
        c.fillStyle = "rgba(160,10,30,.25)"; c.fillRect(0, 0, W, H);
        sceneText(c, "FATALITY", W / 2, H / 2, 100, "#ffd166", { glow: "#ff2a6d" });
      }
    }
    if (this.state === "roundend") {
      const w = a.state === "win" ? a : b;
      c.fillStyle = "rgba(5,3,12,.55)"; c.fillRect(0, 0, W, H);
      sceneText(c, w.def.name + " GAGNE LE ROUND", W / 2, H / 2 - 20, 40, w.def.accent, { glow: w.def.accent });
      if (w.rounds >= 2 && this.t > 0.8) {
        sceneText(c, w.def.name + " REMPORTE LE COMBAT", W / 2, H / 2 + 40, 30, "#ffd166", { glow: "#ff2a6d" });
      }
    }
    if (this.state === "match") {
      c.fillStyle = "rgba(5,3,12,.6)"; c.fillRect(0, 0, W, H);
      const w = S.winner || a;
      sceneText(c, w.def.name + " REMPORTE LE COMBAT", W / 2, H / 2 - 20, 44, w.def.accent, { glow: "#ffd166" });
      sceneText(c, this.fatalityDone ? "FATALITY !" : "VICTOIRE !", W / 2, H / 2 + 40, 34, "#ff2a6d", { glow: "#ff2a6d" });
    }
  },
  click(x, y) { },
};

/* ---------- scène : FIN (solo) ---------- */
const EndingScene = {
  name: "ending",
  t: 0,
  enter() { this.t = 0; AudioSys.startMusic("title"); },
  update(dt) {
    this.t += dt;
    if (Input.pressed("start") || this.t > 14) switchScene(TitleScene);
  },
  draw(g) {
    g.fillStyle = "#05030f"; g.fillRect(0, 0, W, H);
    const w = S.winner || S.p1;
    const imgs = SPRITE.anim(w.cid, "win");
    const img = imgs ? imgs[0] : null;
    g.save(); g.translate(W / 2, 150 + Math.sin(this.t * 2) * 4);
    if (img && img.complete && img.naturalWidth) {
      const sc = Math.min(300 / img.width, 320 / img.height);
      g.drawImage(img, -img.width * sc / 2, 0, img.width * sc, img.height * sc);
    }
    g.restore();
    sceneText(g, w.def.name + " — VICTOIRE", W / 2, 330, 40, w.def.accent, { glow: "#ffd166" });
    // texte défilant
    const lines = w.def.ending.split(". ");
    g.save();
    g.beginPath(); g.rect(180, 380, W - 360, 260); g.clip();
    let y = 700 - this.t * 26;
    g.fillStyle = "#cfc3f0";
    g.font = '700 19px "SF Mono", Menlo, Consolas, monospace';
    g.textAlign = "center";
    for (const ln of lines) {
      g.fillText(ln, W / 2, y);
      y += 40;
    }
    g.restore();
    sceneText(g, "ENTRÉE = retour au menu", W / 2, H - 40, 14, "#7c6fa8");
  },
  click() { switchScene(TitleScene); },
};

/* ---------- scène : FIN DE VERSUS ---------- */
const VersusEndScene = {
  name: "versusend",
  sel: 0, items: ["REVANCHE", "CHANGER DE PERSONNAGE", "MENU PRINCIPAL"],
  enter() { this.sel = 0; },
  update(dt) {
    if (Input.pressed("up")) { this.sel = (this.sel + 2) % 3; AudioSys.select(); }
    if (Input.pressed("down")) { this.sel = (this.sel + 1) % 3; AudioSys.select(); }
    if (Input.pressed("start")) this.activate();
  },
  activate() {
    if (this.sel === 0) { FightScene.roundNum = 1; S.p1.reset(true); S.p2.reset(true); S.p1.rounds = 0; S.p2.rounds = 0; switchScene(FightScene); }
    else if (this.sel === 1) switchScene(SelectScene);
    else switchScene(TitleScene);
  },
  click(x, y) {
    for (let i = 0; i < 3; i++) {
      const r = { x: W / 2 - 200, y: 320 + i * 70, w: 400, h: 50 };
      if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) { this.sel = i; this.activate(); }
    }
  },
  draw(g) {
    drawArena(g);
    g.fillStyle = "rgba(5,3,12,.72)"; g.fillRect(0, 0, W, H);
    const w = S.winner;
    sceneText(g, w.def.name + " REMPORTE LE COMBAT", W / 2, 200, 44, w.def.accent, { glow: "#ffd166" });
    this.items.forEach((it, i) => {
      const on = i === this.sel;
      sceneText(g, (on ? "► " : "   ") + it, W / 2, 350 + i * 70, 24, on ? "#fff" : "#9b8fc4", { glow: on ? "#ff2a6d" : null });
    });
  },
};

/* ============================================================
   ENTRÉES
   ============================================================ */
const Input = {
  keys: {}, pressedKeys: new Set(),
  init() {
    // Les lettres suivent la disposition du clavier (AZERTY comme QWERTY).
    const eventKey = (e) => /^[a-z]$/i.test(e.key) && !e.code.startsWith("Numpad")
      ? "Key" + e.key.toUpperCase() : e.code;
    const keydown = (e) => {
      const key = eventKey(e);
      const preplay = document.getElementById("preplay");
      if (preplay && preplay.classList.contains("show")) {
        if (key === "Escape") { e.preventDefault(); cancelStartGame(); }
        if (key === "Tab") {
          const first = document.getElementById("preplay-cancel"), last = document.getElementById("preplay-start");
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
        // Les boutons natifs gèrent Entrée/Espace et le jeu ne reçoit aucune touche.
        return;
      }
      if (!S.scene && key === "Enter" && !document.getElementById("help").classList.contains("show") &&
          !(e.target && e.target.closest && e.target.closest("button, a, input, select, textarea"))) {
        e.preventDefault(); startGame("mk1"); return;
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(key) ||
          (S.name === "fight" && key.startsWith("Numpad"))) e.preventDefault();
      const firstPress = !this.keys[key];
      if (firstPress) this.pressedKeys.add(key);
      this.keys[key] = true;
      AudioSys.resume();
      if (firstPress && key === "Escape") this.onEscape();
      if (firstPress && key === "KeyH") toggleHelp();
      if (firstPress && key === "KeyM") AudioSys.toggleMute();
      if (firstPress && key === "Enter" && S.name === "fight" && S.paused &&
          !document.getElementById("help").classList.contains("show")) {
        this.pressedKeys.delete(key);
        switchScene(TitleScene);
      }
    };
    const keyup = (e) => { this.keys[eventKey(e)] = false; };
    const releaseAll = () => { this.keys = {}; this.pressedKeys.clear(); };
    window.addEventListener("blur", releaseAll);
    window.addEventListener("pointerdown", () => { if (AudioSys.ctx) AudioSys.resume(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden) releaseAll(); });
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    cv.addEventListener("mousedown", (e) => {
      const r = cv.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width * W;
      const y = (e.clientY - r.top) / r.height * H;
      if (S.scene && S.scene.click) S.scene.click(x, y);
    });
    cv.addEventListener("mousemove", (e) => {
      const r = cv.getBoundingClientRect();
      S.mouse = { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
    });
  },
  onEscape() {
    const help = document.getElementById("help");
    if (help && help.classList.contains("show")) { toggleHelp(false); return; }
    if (S.name === "title") { leaveGame(); return; }
    if (S.name === "fight") { S.paused = !S.paused; return; }
    if (S.name === "select" || S.name === "versusend") { switchScene(TitleScene); return; }
    if (S.name === "ending") switchScene(TitleScene);
  },
  pressed(code) {
    const aliases = { up: ["ArrowUp"], down: ["ArrowDown"], left: ["ArrowLeft"], right: ["ArrowRight"],
      start: ["Enter", "Space"], hp: ["KeyA"], esc: ["Escape"] };
    return (aliases[code] || [code]).some(key => this.pressedKeys.has(key));
  },
  isDown(...codes) { return codes.some(c => this.keys[c]); },
  player1() {
    return {
      left: this.isDown("ArrowLeft"), right: this.isDown("ArrowRight"),
      up: this.isDown("ArrowUp"), down: this.isDown("ArrowDown"),
      hp: this.isDown("KeyA"), lp: this.isDown("KeyZ"),
      hk: this.isDown("KeyE"), lk: this.isDown("KeyC"),
      block: this.isDown("KeyS"),
    };
  },
  player2() {
    return {
      left: this.isDown("Numpad4"), right: this.isDown("Numpad6"),
      up: this.isDown("Numpad8"), down: this.isDown("Numpad2"),
      hp: this.isDown("Numpad7"), lp: this.isDown("Numpad1"),
      hk: this.isDown("Numpad9"), lk: this.isDown("Numpad3"),
      block: this.isDown("Numpad5"),
    };
  },
  endFrame() { this.pressedKeys.clear(); },
};

/* ============================================================
   CHANGEMENT DE SCÈNE + BOUCLE
   ============================================================ */
let PROJS = [];
let DT = 1 / 60;

function switchScene(scene) {
  S.paused = false;
  S.scene = scene;
  S.name = scene.name;
  if (scene.enter) scene.enter();
  setSceneTitle(scene.name);
}

function leaveGame() {
  AudioSys.stopMusic();
  document.body.classList.remove("playing");
  S.scene = null; S.name = "hub";
}

let pausedBeforeHelp = false;
function toggleHelp(show) {
  const h = document.getElementById("help");
  const opening = show === undefined ? !h.classList.contains("show") : show;
  if (opening === h.classList.contains("show")) return;
  h.classList.toggle("show", opening);
  if (S.name === "fight") {
    if (opening) { pausedBeforeHelp = S.paused; S.paused = true; }
    else S.paused = pausedBeforeHelp;
  }
}

let pendingStartGame = null;
let focusBeforeStart = null;
function startGame(id) {
  // Initialiser lors de la première interaction autorisée par le navigateur.
  AudioSys.init(); AudioSys.resume();
  pendingStartGame = id;
  focusBeforeStart = document.activeElement;
  const modal = document.getElementById("preplay");
  document.getElementById("hub").inert = true;
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  document.getElementById("preplay-start").focus();
}

function closeStartGame() {
  const modal = document.getElementById("preplay");
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
  document.getElementById("hub").inert = false;
  Input.keys = {};
  Input.pressedKeys.clear();
}

function cancelStartGame() {
  pendingStartGame = null;
  closeStartGame();
  if (focusBeforeStart && focusBeforeStart.focus) focusBeforeStart.focus();
}

function confirmStartGame() {
  if (!pendingStartGame) return;
  pendingStartGame = null;
  closeStartGame();
  AudioSys.init(); AudioSys.resume();
  document.body.classList.add("playing");
  switchScene(TitleScene);
  cv.focus();
}

/* ---------- hub (interface gaming) ---------- */
function makeCover(def, i) {
  const c = document.createElement("canvas");
  c.width = 300; c.height = 400;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 400);
  if (i === 0) { grad.addColorStop(0, "#2b0f3a"); grad.addColorStop(0.6, "#4a1233"); grad.addColorStop(1, "#12081f"); }
  else if (i === 1) { grad.addColorStop(0, "#0a1f3a"); grad.addColorStop(0.6, "#12334a"); grad.addColorStop(1, "#08121f"); }
  else { grad.addColorStop(0, "#1f1a3a"); grad.addColorStop(0.6, "#331a4a"); grad.addColorStop(1, "#0f0a1f"); }
  g.fillStyle = grad; g.fillRect(0, 0, 300, 400);
  // dragon emblème
  g.save(); g.translate(150, 160);
  g.shadowColor = "#ffd166"; g.shadowBlur = 24;
  g.strokeStyle = "#ffd166"; g.lineWidth = 4;
  g.beginPath(); g.arc(0, 0, 70, 0, TAU); g.stroke();
  g.lineWidth = 7;
  g.beginPath(); g.moveTo(-44, -30); g.quadraticCurveTo(-12, -60, 30, -46);
  g.quadraticCurveTo(52, -24, 40, 10); g.quadraticCurveTo(24, 30, -4, 28);
  g.quadraticCurveTo(-28, 26, -34, 6); g.quadraticCurveTo(-42, -10, -44, -30); g.stroke();
  g.fillStyle = i === 1 ? "#29c7ff" : "#ff2a6d";
  g.beginPath(); g.arc(30, -46, 6, 0, TAU); g.fill();
  g.restore();
  // titre
  g.font = '900 30px "SF Mono", Menlo, monospace';
  g.textAlign = "center"; g.fillStyle = "#fff";
  g.shadowColor = "#ff2a6d"; g.shadowBlur = 16;
  g.fillText("MORTAL", 150, 300);
  g.fillText("KOMBAT", 150, 336);
  g.shadowBlur = 0;
  g.fillStyle = "#9b8fc4";
  g.font = '700 16px "SF Mono", Menlo, monospace';
  g.fillText(i === 0 ? "— 1993 —" : i === 1 ? "— II · 1993 —" : "— 3 · 1995 —", 150, 372);
  return c.toDataURL("image/png");
}

function buildHub() {
  const box = document.getElementById("games");
  box.innerHTML = "";
  GAME_LIBRARY.forEach((game, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.tabIndex = 0;
    const cover = makeCover(game, i);
    card.innerHTML = `
      <div class="cover" style="background-image:url('${cover}')">
        <div class="badge ${game.status === "playable" ? "playable" : "soon"}">${game.status === "playable" ? "jouable" : "bientôt"}</div>
      </div>
      <div class="meta">
        <div class="title">${game.title}</div>
        <div class="details">${game.year} · ${game.genre} · Remake natif</div>
        <div style="font-size:11px;color:#9b8fc4;line-height:1.5">${game.desc}</div>
        <div class="actions">
          ${game.status === "playable" ? '<button class="btn primary">Jouer</button>' : '<button class="btn ghost">Bientôt</button>'}
          <button class="btn ghost">Détails</button>
        </div>
      </div>`;
    card.addEventListener("click", () => {
      if (game.status === "playable") startGame(game.id);
      else AudioSys.resume();
    });
    box.appendChild(card);
  });
}

/* ---------- boucle principale ---------- */
let lastT = performance.now();
function loop(now) {
  const dt = clamp((now - lastT) / 1000, 0, 0.05);
  lastT = now;
  DT = dt;
  if (!S.paused && !document.getElementById("help").classList.contains("show")) {
    S.time += dt;
    if (FX.stopT > 0) FX.stopT = Math.max(0, FX.stopT - dt);
    else if (S.scene) {
      S.scene.update(dt);
      if (!(FX.stopT > 0)) FX.update(dt);
    }
  }
  // rendu
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (S.shake > 0) {
    S.shake = Math.max(0, S.shake - 40 * dt);
    ctx.translate(rand(-S.shake, S.shake) * 0.7, rand(-S.shake, S.shake) * 0.7);
  }
  if (S.scene) S.scene.draw(ctx);
  if (S.paused && S.name === "fight") {
    ctx.fillStyle = "rgba(5, 3, 12, .76)"; ctx.fillRect(0, 0, W, H);
    sceneText(ctx, "PAUSE", W / 2, H / 2 - 10, 64, "#ffd166", { glow: "#ff2a6d" });
    sceneText(ctx, "ÉCHAP : REPRENDRE · ENTRÉE : MENU", W / 2, H / 2 + 45, 19, "#fff");
  }
  Input.endFrame();
  requestAnimationFrame(loop);
}

/* ---------- démarrage ---------- */
window.addEventListener("error", (e) => {
  document.title = "ERR: " + (e.message || "unknown");
});
function setSceneTitle(t) { document.title = "SCENE: " + t; }

window.addEventListener("load", () => {
  buildHub();
  Input.init();
  SPRITE.load(() => {
    const loading = document.getElementById("loading");
    loading.classList.add("hide");
    setTimeout(() => loading.remove(), 600);
  // raccourcis URL (démo / captures)
  const scene = urlQ.get("scene");
  if (scene === "title") { AudioSys.init(); document.body.classList.add("playing"); switchScene(TitleScene); }
  else if (scene === "select") { AudioSys.init(); document.body.classList.add("playing"); switchScene(SelectScene); }
  else if (scene === "fight") {
    AudioSys.init();
    document.body.classList.add("playing");
    const p1c = urlQ.get("p1") || "scorpion";
    const p2c = urlQ.get("p2") || "subzero";
    S.p1 = new Fighter(p1c, 1); S.p2 = new Fighter(p2c, 2);
    S.mode = urlQ.get("mode") === "ai" ? "ai" : "versus";
    S.ladder = []; S.ladderIndex = 0;
    switchScene(FightScene);
  } else if (scene === "ending") {
    AudioSys.init(); document.body.classList.add("playing");
    S.winner = new Fighter(urlQ.get("p1") || "scorpion", 1);
    switchScene(EndingScene);
  }
  requestAnimationFrame(loop);
  });
});
