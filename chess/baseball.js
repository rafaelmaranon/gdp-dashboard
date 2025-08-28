"use strict";

// Quick Baseball: 1 inning (extras if tied). You are Home and always bat bottom.

const state = {
	inning: 1,
	half: "top", // 'top' | 'bottom'
	outs: 0,
	balls: 0,
	strikes: 0,
	scoreAway: 0,
	scoreHome: 0,
	bases: { first: false, second: false, third: false },
	gameOver: false,
	message: "Top 1st — CPU batting",
	whoAtBat: "away", // 'away' (CPU) or 'home' (Human)
	locked: false,
};

const el = {
	status: document.getElementById("status"),
	scoreAway: document.getElementById("scoreAway"),
	scoreHome: document.getElementById("scoreHome"),
	inning: document.getElementById("inning"),
	half: document.getElementById("half"),
	balls: document.getElementById("balls"),
	strikes: document.getElementById("strikes"),
	outs: document.getElementById("outs"),
	base1: document.getElementById("base1"),
	base2: document.getElementById("base2"),
	base3: document.getElementById("base3"),
	btnSwing: document.getElementById("btnSwing"),
	btnTake: document.getElementById("btnTake"),
	btnNew: document.getElementById("btnNew"),
};

function render() {
	el.status.textContent = state.message;
	el.scoreAway.textContent = String(state.scoreAway);
	el.scoreHome.textContent = String(state.scoreHome);
	el.inning.textContent = String(state.inning);
	el.half.textContent = state.half === "top" ? "Top" : "Bottom";
	el.balls.textContent = String(state.balls);
	el.strikes.textContent = String(state.strikes);
	el.outs.textContent = String(state.outs);

	el.base1.classList.toggle("occupied", state.bases.first);
	el.base2.classList.toggle("occupied", state.bases.second);
	el.base3.classList.toggle("occupied", state.bases.third);

	const humanTurn = state.whoAtBat === "home" && !state.gameOver && !state.locked;
	el.btnSwing.disabled = !humanTurn;
	el.btnTake.disabled = !humanTurn;
	el.btnNew.disabled = false;
}

function resetGame() {
	Object.assign(state, {
		inning: 1,
		half: "top",
		outs: 0,
		balls: 0,
		strikes: 0,
		scoreAway: 0,
		scoreHome: 0,
		bases: { first: false, second: false, third: false },
		gameOver: false,
		message: "Top 1st — CPU batting",
		whoAtBat: "away",
		locked: false,
	});
	render();
	setTimeout(cpuAction, 400);
}

function advanceHalfInning() {
	state.outs = 0;
	state.balls = 0;
	state.strikes = 0;
	state.bases = { first: false, second: false, third: false };
	if (state.half === "top") {
		state.half = "bottom";
		state.whoAtBat = "home";
		state.message = labelInning() + " — You are batting";
	} else {
		state.half = "top";
		state.inning += 1;
		state.whoAtBat = "away";
		state.message = labelInning() + " — CPU batting";
	}
	checkGameOverIfNeeded();
	render();
	if (!state.gameOver && state.whoAtBat === "away") setTimeout(cpuAction, 500);
}

function labelInning() {
	const n = state.inning;
	const ord = (n) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);
	return (state.half === "top" ? "Top " : "Bottom ") + ord(n);
}

function pitchOutcome(isSwing) {
	// Simple RNG: pitch roughly 60% strike, 40% ball.
	const isStrike = Math.random() < 0.6;
	if (!isSwing) {
		if (isStrike) {
			addStrike();
			state.message = labelInning() + " — Taken strike";
		} else {
			addBall();
			state.message = labelInning() + " — Ball";
		}
		return;
	}

	// If swing: 65% contact on strikes, 30% contact on balls
	const contactChance = isStrike ? 0.65 : 0.3;
	const madeContact = Math.random() < contactChance;
	if (!madeContact) {
		addStrike();
		state.message = labelInning() + " — Swing and miss";
		return;
	}

	// If contact, outcomes: 65% out, 25% single, 8% double, 2% HR
	const r = Math.random();
	if (r < 0.02) {
		// HR
		homer();
		state.message = labelInning() + " — Home run!";
		return;
	} else if (r < 0.10) {
		double();
		state.message = labelInning() + " — Double";
		return;
	} else if (r < 0.35) {
		single();
		state.message = labelInning() + " — Single";
		return;
	}
	// Out in play
	addOut();
	state.message = labelInning() + " — Out";
}

function addBall() {
	state.balls += 1;
	if (state.balls >= 4) {
		state.balls = 0; state.strikes = 0;
		walk();
	}
}
function addStrike() {
	state.strikes += 1;
	if (state.strikes >= 3) {
		state.balls = 0; state.strikes = 0;
		addOut();
	}
}
function addOut() {
	state.outs += 1;
	state.balls = 0; state.strikes = 0;
	if (state.outs >= 3) advanceHalfInning();
}

function walk() {
	advanceRunners(1);
}
function single() { advanceRunners(1); }
function double() { advanceRunners(2); }
function homer() { advanceRunners(4); }

function advanceRunners(basesTaken) {
	let runs = 0;
	const on = state.bases;
	// Move from third to home
	if (on.third) {
		if (basesTaken >= 1) { runs += 1; on.third = false; }
	}
	// Second to third/home depending on basesTaken
	if (on.second) {
		if (basesTaken === 1) { on.third = true; on.second = false; }
		else if (basesTaken >= 2) { runs += 1; on.second = false; }
	}
	// First to second/third/home
	if (on.first) {
		if (basesTaken === 1) { on.second = true; on.first = false; }
		else if (basesTaken === 2) { on.third = true; on.first = false; }
		else if (basesTaken >= 3) { runs += 1; on.first = false; }
	}
	// Batter
	if (basesTaken === 1) on.first = true;
	else if (basesTaken === 2) on.second = true;
	else if (basesTaken === 3) on.third = true;
	else if (basesTaken >= 4) { /* HR, batter scores too */ runs += 1; }

	if (runs > 0) addRuns(runs);
}

function addRuns(n) {
	if (state.whoAtBat === "away") state.scoreAway += n; else state.scoreHome += n;
}

// CPU when away (top): decides swing or take based on count
function cpuAction() {
	if (state.gameOver || state.whoAtBat !== "away") return;
	state.locked = true;
	render();
	setTimeout(() => {
		const shouldSwing = decideCpuSwing();
		pitchOutcome(shouldSwing);
		state.locked = false;
		render();
		// If inning didn't advance and still CPU batting, queue next
		if (!state.gameOver && state.whoAtBat === "away") setTimeout(cpuAction, 600);
	}, 500);
}

function decideCpuSwing() {
	// Simple: more likely to take on 3-0, less likely to take with 2 strikes
	if (state.strikes === 2) return true;
	if (state.balls >= 3 && state.strikes === 0) return Math.random() < 0.2;
	return Math.random() < 0.6;
}

function checkGameOverIfNeeded() {
	// Game ends after bottom of 1 if not tied; extras continue until lead after a half-inning switches
	if (state.inning === 1 && state.half === "top") return; // need bottom to decide
	if (state.inning >= 1) {
		if (state.half === "top") {
			// starting a top half; if home already leads after previous bottom and inning > 1, game over
			return;
		} else {
			// completed a bottom half — can end if not tied
			if (state.scoreHome !== state.scoreAway) {
				state.gameOver = true;
				state.message = state.scoreHome > state.scoreAway ? "Final — You win" : "Final — CPU wins";
			}
		}
	}
}

// Event wiring
el.btnSwing.addEventListener("click", () => {
	if (state.gameOver || state.whoAtBat !== "home" || state.locked) return;
	pitchOutcome(true);
	render();
});

el.btnTake.addEventListener("click", () => {
	if (state.gameOver || state.whoAtBat !== "home" || state.locked) return;
	pitchOutcome(false);
	render();
});

el.btnNew.addEventListener("click", () => {
	resetGame();
});

// Kick off
render();
setTimeout(cpuAction, 400);

