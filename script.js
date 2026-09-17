let bestTime = Number(localStorage.getItem("ank-yudh-best-time")) || null;

// ===== YUDH RECORD: milestones from 64 onward =====
const RECORD_TILES = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096];
let yudhRecord = JSON.parse(localStorage.getItem("ank-yudh-record")) || {
  totalYudh: 0,
  wins: 0,
  milestones: {}
};

// ===== Splash screen =====
window.addEventListener("load", () => {
  const splash = document.getElementById("splashScreen");
  if (!splash) return;
  setTimeout(() => splash.classList.add("hide"), 2400);
});

// ===== Setup / State =====
const N = 4;
let b = [];
let score = 0;
let best = Number(localStorage.getItem("4096-best")) || 0;
let playing = true;
let won = false;
let isPaused = false;

const board = document.getElementById("board");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const overlay = document.getElementById("overlay");
const title = document.getElementById("title");
const text = document.getElementById("text");
const again = document.getElementById("again");
const newBtn = document.getElementById("new");
const pauseBtn = document.getElementById("pauseBtn");
const timerEl = document.getElementById("timer");
const recordBtn = document.getElementById("recordBtn");
const recordModal = document.getElementById("recordModal");
const closeRecord = document.getElementById("closeRecord");
const startScreen = document.getElementById("startScreen");
const startGameBtn = document.getElementById("startGame");
const unlockBanner = document.getElementById("unlockBanner");
const unlockText = document.getElementById("unlockText");
const soundBtn = document.getElementById("soundBtn");
const btnUp = document.getElementById("btnUp");
const btnDown = document.getElementById("btnDown");
const btnLeft = document.getElementById("btnLeft");
const btnRight = document.getElementById("btnRight");

let selectedTime = 600; // default 10 minutes
let timeLeft = 600;
let timerInterval = null;

// ===== New-feature state =====
let highestUnlocked = 32;      // tiles up to 32 are "normal", no announcement
let unlockTimeout = null;
let soundOn = localStorage.getItem("ank-yudh-sound") !== "off";
let audioCtx = null;

// ===== YUDH RECORD POPUP =====
function openYudhRecord() {
  updateYudhRecord();
  recordModal?.classList.remove("hidden");
  recordModal?.setAttribute("aria-hidden", "false");
}

function closeYudhRecord() {
  recordModal?.classList.add("hidden");
  recordModal?.setAttribute("aria-hidden", "true");
}

recordBtn?.addEventListener("click", openYudhRecord);
closeRecord?.addEventListener("click", closeYudhRecord);
recordModal?.addEventListener("click", (e) => {
  if (e.target === recordModal) closeYudhRecord();
});

// ===== Time selection on start screen =====
document.querySelectorAll(".time-btn").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".time-btn").forEach(btn => btn.classList.remove("selected"));
    button.classList.add("selected");
    selectedTime = Number(button.dataset.time);
    timeLeft = selectedTime;
    updateTimer();
  });
});

// ===== Start game =====
startGameBtn?.addEventListener("click", () => {
  startScreen.style.display = "none";
  start();
  beginTimer();
});

newBtn?.addEventListener("click", () => {
  startScreen.style.display = "flex";
  clearInterval(timerInterval);
  hide();
});

// ===== D-pad controls =====
btnUp?.addEventListener("click", () => move("up"));
btnDown?.addEventListener("click", () => move("down"));
btnLeft?.addEventListener("click", () => move("left"));
btnRight?.addEventListener("click", () => move("right"));

// ===== Sound toggle =====
function setSoundBtnLabel() {
  soundBtn.textContent = soundOn ? "🔊" : "🔇";
  soundBtn.classList.toggle("muted", !soundOn);
}
soundBtn?.addEventListener("click", () => {
  soundOn = !soundOn;
  localStorage.setItem("ank-yudh-sound", soundOn ? "on" : "off");
  setSoundBtnLabel();
  if (soundOn) playTone(520, 0.08, "sine");
});
setSoundBtnLabel();

function ensureAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { audioCtx = null; }
  }
  return audioCtx;
}

function playTone(freq, dur, type = "triangle", delay = 0) {
  if (!soundOn) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.001, ctx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + delay + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + dur + 0.05);
}

function sfxMerge() { playTone(440, 0.12, "triangle"); }
function sfxUnlock() {
  playTone(523, 0.12, "square");
  playTone(659, 0.12, "square", 0.1);
  playTone(784, 0.18, "square", 0.2);
}
function sfxWin() {
  [523, 659, 784, 1046].forEach((f, i) => playTone(f, 0.22, "square", i * 0.12));
}
function sfxGameOver() {
  playTone(220, 0.3, "sawtooth");
  playTone(160, 0.35, "sawtooth", 0.18);
}

function vibrate(pattern) {
  if (navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch (e) {}
  }
}

// ===== Tile unlock announcement =====
function announceUnlock(value) {
  clearTimeout(unlockTimeout);
  unlockText.textContent = `🔓 ${value} UNLOCK HUA!`;
  unlockBanner.classList.remove("show");
  // force reflow so the animation restarts if triggered again quickly
  void unlockBanner.offsetWidth;
  unlockBanner.classList.add("show");
  sfxUnlock();
  vibrate([40, 40, 80]);
  unlockTimeout = setTimeout(() => unlockBanner.classList.remove("show"), 2000);
}

// ===== Floating score popup =====
function showScorePop(amount) {
  if (!amount) return;
  const host = scoreEl.parentElement;
  const pop = document.createElement("span");
  pop.className = "score-pop";
  pop.textContent = "+" + amount;
  host.appendChild(pop);
  setTimeout(() => pop.remove(), 900);
}

// ===== Confetti burst =====
function confettiBurst() {
  const colors = ["#ffb838", "#ff6a2b", "#ffe680", "#ff2b2b", "#fff3c4"];
  for (let i = 0; i < 34; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = (1.6 + Math.random() * 1.2) + "s";
    piece.style.animationDelay = (Math.random() * 0.4) + "s";
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 3200);
  }
}

// ===== Pause / Play =====
pauseBtn?.addEventListener("click", togglePause);

function togglePause() {
  if (!b.length || !playing) return; // nothing to pause before start or after game ends

  isPaused = !isPaused;

  if (isPaused) {
    pauseBtn.textContent = "▶ YUDH CHALU";
    title.textContent = "Game Paused";
    text.textContent = "Press YUDH CHALU to continue.";
    overlay.classList.remove("hidden");
    again.textContent = "YUDH CHALU";
    again.onclick = togglePause;
  } else {
    pauseBtn.textContent = "⏸YUDH VIRAM";
    hide();
  }
}

function beginTimer() {
  timeLeft = selectedTime;
  updateTimer();
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (isPaused || !playing) return;
    timeLeft--;
    updateTimer();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      playing = false;
      timeUp();
    }
  }, 1000);
}

function updateTimer() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  timerEl.textContent =
    String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
}

function timeUp() {
  show("SAMAY SAMAPT! ⏰", "AAPKA SAMAY SAMAPT HUA. DOBARA KOSHISH KARE!");
}

// ===== YUDH RECORD FUNCTIONS =====
function saveYudhRecord() {
  localStorage.setItem("ank-yudh-record", JSON.stringify(yudhRecord));
  updateYudhRecord();
}

function updateYudhRecord() {
  const el = document.getElementById("yudhRecord");
  if (!el) return;

  const reached64 = !!yudhRecord.milestones[64];
  if (!reached64) {
    el.innerHTML = `<div class="record-locked"></div>`;
    return;
  }

  el.innerHTML = `
    <div class="record-stats">
      <span>⚔️ Yudh: <b>${yudhRecord.totalYudh}</b></span>
      <span>🏆 Wins: <b>${yudhRecord.wins}</b></span>
    </div>
    <div class="record-milestones">
      ${RECORD_TILES.map(tile => `
        <div class="record-row">
          <span>⚔️ ${tile}</span>
          <strong>${yudhRecord.milestones[tile] ? formatTime(yudhRecord.milestones[tile]) : "🔒"}</strong>
        </div>
      `).join("")}
    </div>`;
}

function recordMilestones() {
  const elapsed = selectedTime - timeLeft;
  const maxTile = Math.max(...b.flat());
  RECORD_TILES.forEach(tile => {
    if (maxTile >= tile &&
        (yudhRecord.milestones[tile] === undefined || elapsed < yudhRecord.milestones[tile])) {
      yudhRecord.milestones[tile] = elapsed;
    }
  });
  saveYudhRecord();
}

// ===== Core game logic =====
function start() {
  yudhRecord.totalYudh++;
  saveYudhRecord();
  isPaused = false;
  pauseBtn.textContent = "⏸ YUDH VIRAM";

  b = Array.from({ length: N }, () => Array(N).fill(0));
  score = 0;
  won = false;
  playing = true;
  highestUnlocked = 32;
  unlockBanner.classList.remove("show");
  add();
  add();
  render();
  hide();
}

function add() {
  let e = [];
  b.forEach((r, i) => r.forEach((v, j) => { if (!v) e.push([i, j]); }));
  if (e.length) {
    let [r, c] = e[Math.floor(Math.random() * e.length)];
    b[r][c] = Math.random() < 0.9 ? 2 : 4;
  }
}

function line(a) {
  let x = a.filter(Boolean), out = [], gain = 0;
  for (let i = 0; i < x.length; i++) {
    if (x[i] === x[i + 1]) {
      out.push(x[i] * 2);
      gain += x[i] * 2;
      i++;
    } else out.push(x[i]);
  }
  while (out.length < N) out.push(0);
  return [out, gain];
}

function eq(a, c) {
  return a.every((v, i) => v === c[i]);
}

function move(d) {
  if (isPaused) return;
  if (!b.length || !playing || !overlay.classList.contains("hidden")) return;
  let changed = false, gain = 0;

  if (d === "left") {
    for (let r = 0; r < N; r++) {
      let [x, g] = line(b[r]);
      changed |= !eq(b[r], x);
      b[r] = x;
      gain += g;
    }
  }
  if (d === "right") {
    for (let r = 0; r < N; r++) {
      let a = [...b[r]].reverse(), z = line(a), x = z[0].reverse();
      changed |= !eq(b[r], x);
      b[r] = x;
      gain += z[1];
    }
  }
  if (d === "up" || d === "down") {
    for (let c = 0; c < N; c++) {
      let a = b.map(r => r[c]);
      if (d === "down") a.reverse();
      let z = line(a), x = z[0];
      if (d === "down") x.reverse();
      let old = b.map(r => r[c]);
      changed |= !eq(old, x);
      for (let r = 0; r < N; r++) b[r][c] = x[r];
      gain += z[1];
    }
  }

  if (!changed) {
    if (!can()) gameover();
    return;
  }

  score += gain;
  add();
  if (score > best) {
    best = score;
    localStorage.setItem("4096-best", best);
  }
  render();
  recordMilestones();

  if (gain > 0) {
    sfxMerge();
    vibrate(25);
    showScorePop(gain);
  }

  const maxTile = Math.max(...b.flat());
  if (maxTile > highestUnlocked && maxTile >= 64) {
    highestUnlocked = maxTile;
    announceUnlock(maxTile);
  }

  if (!won && b.flat().includes(4096)) win();
  else if (!can()) gameover();
}

function can() {
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (!b[r][c]) return true;
      if (c < N - 1 && b[r][c] === b[r][c + 1]) return true;
      if (r < N - 1 && b[r][c] === b[r + 1][c]) return true;
    }
  }
  return false;
}

function render() {
  board.innerHTML = "";
  b.flat().forEach(v => {
    let el = document.createElement("div");
    el.className = "cell";
    if (v) {
      el.classList.add("tile", "pop");
      el.dataset.value = v;
      el.textContent = v;
    }
    board.appendChild(el);
  });
  scoreEl.textContent = score;
  bestEl.textContent = best;
}

function show(t, msg, win = false) {
  title.textContent = t;
  text.textContent = msg;
  overlay.classList.remove("hidden");
  again.textContent = win ? "Keep Playing" : "Try Again";
  again.onclick = win
    ? () => { playing = true; hide(); }
    : () => { start(); beginTimer(); };
}

function win() {
  clearInterval(timerInterval);
  yudhRecord.wins++;
  recordMilestones();
  
  const completionTime = selectedTime - timeLeft;

  if (bestTime === null || completionTime < bestTime) {
    bestTime = completionTime;
    localStorage.setItem("ank-yudh-best-time", bestTime);
  }

  won = true;
  playing = false;
  sfxWin();
  vibrate([80, 60, 80, 60, 160]);
  confettiBurst();

  const bestText = formatTime(bestTime);

  show(
    "AAPKO IJAY PRAPT HUI! 🎉",
    `4096 completed in ${formatTime(completionTime)}! 🏆 Best Time: ${bestText}`,
    true
  );

  updateBestTime();
updateYudhRecord();
  saveYudhRecord();
}
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return String(minutes).padStart(2, "0") + ":" +
         String(secs).padStart(2, "0");
}

function updateBestTime() {
  const bestTimeEl = document.getElementById("bestTime");

  if (bestTimeEl) {
    bestTimeEl.textContent =
      bestTime === null ? "--:--" : formatTime(bestTime);
  }
}

function gameover() {
  clearInterval(timerInterval);
  playing = false;
  sfxGameOver();
  vibrate([120, 60, 120]);
  show("AAP YUDH HAAR GAYE!", "DOBARA KOSHISH KARE! KOSHISH KARNE WALO KI HAAR NAHI HOTI.");
}

function hide() {
  overlay.classList.add("hidden");
}

// ===== Input: keyboard =====
document.addEventListener("keydown", e => {
  const map = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
  if (map[e.key]) {
    e.preventDefault();
    move(map[e.key]);
  }
});

// ===== Input: swipe (mobile) =====
let sx = 0, sy = 0;
board?.addEventListener("touchstart", e => {
  sx = e.touches[0].clientX;
  sy = e.touches[0].clientY;
}, { passive: true });

board?.addEventListener("touchend", e => {
  const dx = e.changedTouches[0].clientX - sx;
  const dy = e.changedTouches[0].clientY - sy;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
  if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "right" : "left");
  else move(dy > 0 ? "down" : "up");
}, { passive: true });

// ===== Init =====
bestEl.textContent = best;
document.getElementById("year").textContent = new Date().getFullYear();
updateBestTime();
updateYudhRecord();