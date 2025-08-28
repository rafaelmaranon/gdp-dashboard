"use strict";

// Baseball-themed icons per piece type (same icons for both colors)
const UNICODE_PIECE = {
	w: { k: "🧢", q: "🏆", r: "🧤", b: "⚾", n: "📣", p: "🥎" },
	b: { k: "🧢", q: "🏆", r: "🧤", b: "⚾", n: "📣", p: "🥎" },
};

/**
 * Board representation:
 * 8x8 array of either null or { type: 'p'|'r'|'n'|'b'|'q'|'k', color: 'w'|'b', hasMoved: boolean }
 * (0,0) is top-left when not flipped (rank 8, file a visually)
 */

const state = {
	board: createStartingBoard(),
	currentPlayer: "w",
	selected: null, // { row, col }
	legalTargets: [], // array of { row, col }
	gameOver: false,
	winner: null, // 'w' | 'b' | 'draw'
	flip: false,
};

const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const newGameBtn = document.getElementById("newGame");
const flipBoardCheckbox = document.getElementById("flipBoard");

// Initialize UI
buildBoardSquares();
renderAll();

newGameBtn.addEventListener("click", () => {
	resetGame();
});

flipBoardCheckbox.addEventListener("change", (e) => {
	state.flip = !!e.target.checked;
	renderAll();
});

function resetGame() {
	state.board = createStartingBoard();
	state.currentPlayer = "w";
	state.selected = null;
	state.legalTargets = [];
	state.gameOver = false;
	state.winner = null;
	renderAll();
}

function createStartingBoard() {
	const emptyRow = () => Array.from({ length: 8 }, () => null);
	const board = Array.from({ length: 8 }, emptyRow);

	// Place pawns
	for (let c = 0; c < 8; c += 1) {
		board[1][c] = { type: "p", color: "b", hasMoved: false };
		board[6][c] = { type: "p", color: "w", hasMoved: false };
	}

	// Back ranks
	const back = (color) => [
		{ type: "r", color, hasMoved: false },
		{ type: "n", color, hasMoved: false },
		{ type: "b", color, hasMoved: false },
		{ type: "q", color, hasMoved: false },
		{ type: "k", color, hasMoved: false },
		{ type: "b", color, hasMoved: false },
		{ type: "n", color, hasMoved: false },
		{ type: "r", color, hasMoved: false },
	];

	board[0] = back("b");
	board[7] = back("w");

	return board;
}

function buildBoardSquares() {
	boardEl.innerHTML = "";
	for (let r = 0; r < 8; r += 1) {
		for (let c = 0; c < 8; c += 1) {
			const sq = document.createElement("div");
			sq.className = `square ${(r + c) % 2 === 0 ? "light" : "dark"}`;
			sq.setAttribute("role", "gridcell");
			sq.dataset.row = String(r);
			sq.dataset.col = String(c);
			sq.addEventListener("click", onSquareClick);
			boardEl.appendChild(sq);
		}
	}
}

function onSquareClick(e) {
	if (state.gameOver) return;
	const target = e.currentTarget;
	const row = Number(target.dataset.row);
	const col = Number(target.dataset.col);

	const [visRow, visCol] = fromVisualToModel(row, col);
	const piece = state.board[visRow][visCol];

	if (!state.selected) {
		if (piece && piece.color === state.currentPlayer) {
			state.selected = { row: visRow, col: visCol };
			state.legalTargets = generateLegalMoves(visRow, visCol, state.board, state.currentPlayer);
			renderAll();
		}
		return;
	}

	// If clicking a square that's a legal target, move
	const move = state.legalTargets.find((m) => m.row === visRow && m.col === visCol);
	if (move) {
		applyMove(state.selected.row, state.selected.col, move.row, move.col);
		state.selected = null;
		state.legalTargets = [];
		afterMoveUpdate();
		renderAll();
		return;
	}

	// If clicked on another own piece, change selection; else clear
	if (piece && piece.color === state.currentPlayer) {
		state.selected = { row: visRow, col: visCol };
		state.legalTargets = generateLegalMoves(visRow, visCol, state.board, state.currentPlayer);
	} else {
		state.selected = null;
		state.legalTargets = [];
	}
	renderAll();
}

function afterMoveUpdate() {
	// Switch turn
	state.currentPlayer = state.currentPlayer === "w" ? "b" : "w";

	const inCheck = isKingInCheck(state.currentPlayer, state.board);
	const hasAny = playerHasAnyLegalMoves(state.currentPlayer, state.board);

	if (!hasAny) {
		state.gameOver = true;
		if (inCheck) {
			state.winner = state.currentPlayer === "w" ? "b" : "w";
		} else {
			state.winner = "draw";
		}
	}
}

function renderAll() {
	// Status text
	if (state.gameOver) {
		if (state.winner === "draw") {
			statusEl.textContent = "Game over: stalemate";
		} else {
			statusEl.textContent = `Game over: ${state.winner === "w" ? "White" : "Black"} wins`;
		}
	} else {
		const checkNote = isKingInCheck(state.currentPlayer, state.board) ? " (check)" : "";
		statusEl.textContent = `${state.currentPlayer === "w" ? "White" : "Black"} to move${checkNote}`;
	}

	// Squares
	const squares = boardEl.children;
	for (let r = 0; r < 8; r += 1) {
		for (let c = 0; c < 8; c += 1) {
			const idx = r * 8 + c;
			const sqEl = squares[idx];
			const [mr, mc] = fromVisualToModel(r, c);
			const piece = state.board[mr][mc];

			sqEl.textContent = piece ? UNICODE_PIECE[piece.color][piece.type] : "";
			if (piece) {
				sqEl.setAttribute("data-color", piece.color);
			} else {
				sqEl.removeAttribute("data-color");
			}
			sqEl.classList.toggle("selectable", !!piece && piece.color === state.currentPlayer && !state.gameOver);

			sqEl.classList.remove("highlight-move", "highlight-capture", "king-in-check");
			if (state.selected) {
				const hl = state.legalTargets.find((m) => m.row === mr && m.col === mc);
				if (hl) {
					const capture = !!state.board[mr][mc];
					sqEl.classList.add(capture ? "highlight-capture" : "highlight-move");
				}
			}
		}
	}

	// Highlight king in check
	["w", "b"].forEach((color) => {
		const pos = findKing(color, state.board);
		if (!pos) return;
		const [vr, vc] = fromModelToVisual(pos.row, pos.col);
		const idx = vr * 8 + vc;
		const sqEl = boardEl.children[idx];
		if (isKingInCheck(color, state.board)) {
			sqEl.classList.add("king-in-check");
		}
	});
}

function applyMove(fr, fc, tr, tc) {
	const board = state.board;
	const piece = board[fr][fc];
	if (!piece) return;

	// Move and possible capture
	board[tr][tc] = { ...piece, hasMoved: true };
	board[fr][fc] = null;

	// Promotion: auto-queen
	if (piece.type === "p") {
		if ((piece.color === "w" && tr === 0) || (piece.color === "b" && tr === 7)) {
			board[tr][tc] = { type: "q", color: piece.color, hasMoved: true };
		}
	}
}

function generateLegalMoves(row, col, board, color) {
	const piece = board[row][col];
	if (!piece || piece.color !== color) return [];
	const pseudo = generatePseudoLegalMoves(row, col, board);
	const legal = [];
	for (const mv of pseudo) {
		const cloned = cloneBoard(board);
		// Apply move on clone
		cloned[mv.row][mv.col] = { ...cloned[row][col], hasMoved: true };
		cloned[row][col] = null;
		// Promotion in simulation
		if (piece.type === "p") {
			if ((piece.color === "w" && mv.row === 0) || (piece.color === "b" && mv.row === 7)) {
				cloned[mv.row][mv.col] = { type: "q", color: piece.color, hasMoved: true };
			}
		}
		if (!isKingInCheck(color, cloned)) {
			legal.push(mv);
		}
	}
	return legal;
}

function generatePseudoLegalMoves(row, col, board) {
	const piece = board[row][col];
	if (!piece) return [];
	const color = piece.color;
	const result = [];

	const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
	const pushIfFree = (r, c) => {
		if (!inside(r, c)) return false;
		if (board[r][c] === null) {
			result.push({ row: r, col: c });
			return true;
		}
		return false;
	};
	const pushIfCapture = (r, c) => {
		if (!inside(r, c)) return false;
		const target = board[r][c];
		if (target && target.color !== color) {
			result.push({ row: r, col: c });
			return true;
		}
		return false;
	};

	if (piece.type === "p") {
		const dir = color === "w" ? -1 : 1;
		// forward one
		if (pushIfFree(row + dir, col)) {
			// forward two from start
			const startRow = color === "w" ? 6 : 1;
			if (row === startRow && board[row + 2 * dir] && board[row + 2 * dir][col] === null) {
				pushIfFree(row + 2 * dir, col);
			}
		}
		// captures
		pushIfCapture(row + dir, col - 1);
		pushIfCapture(row + dir, col + 1);
		return result;
	}

	if (piece.type === "n") {
		const steps = [
			[+2, +1], [+2, -1], [-2, +1], [-2, -1],
			[+1, +2], [+1, -2], [-1, +2], [-1, -2],
		];
		for (const [dr, dc] of steps) {
			const r = row + dr, c = col + dc;
			if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
			const t = board[r][c];
			if (!t || t.color !== color) result.push({ row: r, col: c });
		}
		return result;
	}

	if (piece.type === "b" || piece.type === "r" || piece.type === "q") {
		const rays = [];
		if (piece.type === "b" || piece.type === "q") {
			rays.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
		}
		if (piece.type === "r" || piece.type === "q") {
			rays.push([1, 0], [-1, 0], [0, 1], [0, -1]);
		}
		for (const [dr, dc] of rays) {
			let r = row + dr, c = col + dc;
			while (r >= 0 && r < 8 && c >= 0 && c < 8) {
				const t = board[r][c];
				if (!t) {
					result.push({ row: r, col: c });
					r += dr; c += dc;
					continue;
				}
				if (t.color !== color) result.push({ row: r, col: c });
				break;
			}
		}
		return result;
	}

	if (piece.type === "k") {
		for (let dr = -1; dr <= 1; dr += 1) {
			for (let dc = -1; dc <= 1; dc += 1) {
				if (dr === 0 && dc === 0) continue;
				const r = row + dr, c = col + dc;
				if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
				const t = board[r][c];
				if (!t || t.color !== color) result.push({ row: r, col: c });
			}
		}
		return result;
	}

	return result;
}

function isKingInCheck(color, board) {
	const kingPos = findKing(color, board);
	if (!kingPos) return false;
	return squareAttackedBy(kingPos.row, kingPos.col, opposite(color), board);
}

function playerHasAnyLegalMoves(color, board) {
	for (let r = 0; r < 8; r += 1) {
		for (let c = 0; c < 8; c += 1) {
			const p = board[r][c];
			if (!p || p.color !== color) continue;
			const moves = generateLegalMoves(r, c, board, color);
			if (moves.length > 0) return true;
		}
	}
	return false;
}

function squareAttackedBy(row, col, attackerColor, board) {
	// Knights
	const knightSteps = [
		[+2, +1], [+2, -1], [-2, +1], [-2, -1],
		[+1, +2], [+1, -2], [-1, +2], [-1, -2],
	];
	for (const [dr, dc] of knightSteps) {
		const r = row + dr, c = col + dc;
		if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
		const t = board[r][c];
		if (t && t.color === attackerColor && t.type === "n") return true;
	}

	// Pawns (attacks differ from moves)
	const dir = attackerColor === "w" ? -1 : 1;
	for (const dc of [-1, +1]) {
		const r = row + dir, c = col + dc;
		if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
		const t = board[r][c];
		if (t && t.color === attackerColor && t.type === "p") return true;
	}

	// King nearby
	for (let dr = -1; dr <= 1; dr += 1) {
		for (let dc = -1; dc <= 1; dc += 1) {
			if (dr === 0 && dc === 0) continue;
			const r = row + dr, c = col + dc;
			if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
			const t = board[r][c];
			if (t && t.color === attackerColor && t.type === "k") return true;
		}
	}

	// Sliding pieces
	const rays = [
		[1, 0], [-1, 0], [0, 1], [0, -1], // rook/queen
		[1, 1], [1, -1], [-1, 1], [-1, -1], // bishop/queen
	];
	for (const [dr, dc] of rays) {
		let r = row + dr, c = col + dc;
		while (r >= 0 && r < 8 && c >= 0 && c < 8) {
			const t = board[r][c];
			if (!t) { r += dr; c += dc; continue; }
			if (t.color !== attackerColor) break;
			if (dr === 0 || dc === 0) { // rook-like
				if (t.type === "r" || t.type === "q") return true;
			}
			if (dr !== 0 && dc !== 0) { // bishop-like
				if (t.type === "b" || t.type === "q") return true;
			}
			break;
		}
	}

	return false;
}

function findKing(color, board) {
	for (let r = 0; r < 8; r += 1) {
		for (let c = 0; c < 8; c += 1) {
			const p = board[r][c];
			if (p && p.color === color && p.type === "k") return { row: r, col: c };
		}
	}
	return null;
}

function cloneBoard(board) {
	return board.map((row) => row.map((p) => (p ? { ...p } : null)));
}

function opposite(color) { return color === "w" ? "b" : "w"; }

// Flip helpers
function fromVisualToModel(vr, vc) {
	return state.flip ? [7 - vr, 7 - vc] : [vr, vc];
}

function fromModelToVisual(mr, mc) {
	return state.flip ? [7 - mr, 7 - mc] : [mr, mc];
}

