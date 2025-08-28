"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const scorePlayerEl = document.getElementById("scorePlayer");
const scoreCpuEl = document.getElementById("scoreCpu");
const btnStart = document.getElementById("btnStart");
const btnPause = document.getElementById("btnPause");
const btnReset = document.getElementById("btnReset");
const difficultySelect = document.getElementById("difficulty");

const state = {
	width: canvas.width,
	height: canvas.height,
	running: false,
	lastTs: 0,
	playerY: 0,
	cpuY: 0,
	padWidth: 12,
	padHeight: 90,
	ballX: 0,
	ballY: 0,
	ballVX: 0,
	ballVY: 0,
	ballR: 8,
	scorePlayer: 0,
	scoreCpu: 0,
	serveDir: 1, // 1 to player, -1 to CPU
	difficulty: "normal",
};

function resetPositions() {
	state.playerY = (state.height - state.padHeight) / 2;
	state.cpuY = (state.height - state.padHeight) / 2;
	state.ballX = state.width / 2;
	state.ballY = state.height / 2;
	const speed = 360;
	const angle = (Math.random() * 0.6 - 0.3); // slight up/down
	state.ballVX = Math.cos(angle) * speed * state.serveDir;
	state.ballVY = Math.sin(angle) * speed;
}

function setDifficulty(d) {
	state.difficulty = d;
}

function start() {
	if (state.running) return;
	state.running = true;
	state.lastTs = performance.now();
	statusEl.textContent = "";
	requestAnimationFrame(loop);
}

function pause() {
	state.running = false;
	statusEl.textContent = "Paused";
}

function resetGame() {
	state.scorePlayer = 0;
	state.scoreCpu = 0;
	state.serveDir = Math.random() < 0.5 ? -1 : 1;
	resetPositions();
	updateScores();
	statusEl.textContent = "Press Start";
}

function updateScores() {
	scorePlayerEl.textContent = String(state.scorePlayer);
	scoreCpuEl.textContent = String(state.scoreCpu);
}

function loop(ts) {
	if (!state.running) return;
	const dt = Math.min(32, ts - state.lastTs) / 1000;
	state.lastTs = ts;
	update(dt);
	draw();
	requestAnimationFrame(loop);
}

function update(dt) {
	// Ball physics
	state.ballX += state.ballVX * dt;
	state.ballY += state.ballVY * dt;

	// Collide top/bottom
	if (state.ballY - state.ballR < 0 && state.ballVY < 0) { state.ballY = state.ballR; state.ballVY *= -1; }
	if (state.ballY + state.ballR > state.height && state.ballVY > 0) { state.ballY = state.height - state.ballR; state.ballVY *= -1; }

	// Player paddle collision
	const pX = 20, pY = state.playerY, pW = state.padWidth, pH = state.padHeight;
	if (state.ballX - state.ballR < pX + pW && state.ballX > pX && state.ballY > pY && state.ballY < pY + pH && state.ballVX < 0) {
		state.ballX = pX + pW + state.ballR;
		state.ballVX *= -1;
		// add spin based on offset
		const offset = (state.ballY - (pY + pH / 2)) / (pH / 2);
		state.ballVY = (state.ballVY + offset * 240);
	}

	// CPU paddle collision
	const cX = state.width - 20 - pW, cY = state.cpuY;
	if (state.ballX + state.ballR > cX && state.ballX < cX + pW && state.ballY > cY && state.ballY < cY + pH && state.ballVX > 0) {
		state.ballX = cX - state.ballR;
		state.ballVX *= -1;
		const offset = (state.ballY - (cY + pH / 2)) / (pH / 2);
		state.ballVY = (state.ballVY + offset * 240);
	}

	// Score conditions
	if (state.ballX < -30) { // CPU scores
		state.scoreCpu += 1; updateScores(); pointOver(-1);
	}
	if (state.ballX > state.width + 30) { // Player scores
		state.scorePlayer += 1; updateScores(); pointOver(1);
	}

	// CPU AI
	const aiReact = state.difficulty === "easy" ? 3.5 : state.difficulty === "hard" ? 7.5 : 5.5;
	const aiSpeed = 160 + (state.difficulty === "hard" ? 80 : state.difficulty === "easy" ? -40 : 0);
	const target = state.ballY - state.padHeight / 2 + (Math.sin(performance.now() / 250) * aiReact);
	if (Math.abs(target - state.cpuY) > 2) {
		state.cpuY += Math.sign(target - state.cpuY) * aiSpeed * dt;
	}
	state.cpuY = Math.max(0, Math.min(state.height - state.padHeight, state.cpuY));
}

function pointOver(servingDir) {
	state.serveDir = servingDir;
	resetPositions();
	statusEl.textContent = "Point! Press Start";
	state.running = false;
}

function draw() {
	ctx.clearRect(0, 0, state.width, state.height);
	// Middle net
	ctx.strokeStyle = "#334155";
	ctx.setLineDash([8, 12]);
	ctx.beginPath();
	ctx.moveTo(state.width / 2, 0);
	ctx.lineTo(state.width / 2, state.height);
	ctx.stroke();
	ctx.setLineDash([]);

	// Paddles
	ctx.fillStyle = "#e5e7eb";
	ctx.fillRect(20, state.playerY, state.padWidth, state.padHeight);
	ctx.fillRect(state.width - 20 - state.padWidth, state.cpuY, state.padWidth, state.padHeight);

	// Ball
	ctx.beginPath();
	ctx.arc(state.ballX, state.ballY, state.ballR, 0, Math.PI * 2);
	ctx.fillStyle = "#22c55e";
	ctx.fill();
}

// Input: keyboard
const keys = new Set();
window.addEventListener("keydown", (e) => { if (e.key === "w" || e.key === "ArrowUp" || e.key === "s" || e.key === "ArrowDown") { keys.add(e.key); e.preventDefault(); }});
window.addEventListener("keyup", (e) => { keys.delete(e.key); });

function handleKeys(dt) {
	const speed = 300;
	if (keys.has("w") || keys.has("ArrowUp")) state.playerY -= speed * dt;
	if (keys.has("s") || keys.has("ArrowDown")) state.playerY += speed * dt;
	state.playerY = Math.max(0, Math.min(state.height - state.padHeight, state.playerY));
}

// Touch/mouse drag on left half
let dragging = false;
canvas.addEventListener("pointerdown", (e) => {
	const rect = canvas.getBoundingClientRect();
	const x = e.clientX - rect.left;
	if (x < rect.width * 0.5) { dragging = true; }
});
window.addEventListener("pointerup", () => dragging = false);
window.addEventListener("pointermove", (e) => {
	if (!dragging) return;
	const rect = canvas.getBoundingClientRect();
	const y = e.clientY - rect.top;
	state.playerY = y - state.padHeight / 2;
	state.playerY = Math.max(0, Math.min(state.height - state.padHeight, state.playerY));
});

// Integrate key control into update
const _update = update;
update = function(dt) { handleKeys(dt); _update(dt); };

// Controls
btnStart.addEventListener("click", () => { start(); });
btnPause.addEventListener("click", () => { pause(); });
btnReset.addEventListener("click", () => { resetGame(); draw(); });
difficultySelect.addEventListener("change", (e) => { setDifficulty(e.target.value); });

// Init
resetGame();
resetPositions();
draw();

