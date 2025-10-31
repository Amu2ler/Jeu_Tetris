// === Config ===
const COLS = 10;
const ROWS = 20;
const SIZE = 30; // pixel par bloc (canvas 300x600)
const STEP_START_MS = 800; // vitesse de chute niveau 1
const LEVEL_STEP = 0.85; // facteur d’accélération par niveau

// Couleurs par pièce
const COLORS = {
	I: "#6ee7ff",
	J: "#7aa2f7",
	L: "#f6b84d",
	O: "#f3e56b",
	S: "#72e0a8",
	T: "#c084fc",
	Z: "#f87171",
};

// Matrices des tétriminos (rotation par transposition + reverse)
const SHAPES = {
	I: [[1, 1, 1, 1]],
	J: [
		[1, 0, 0],
		[1, 1, 1],
	],
	L: [
		[0, 0, 1],
		[1, 1, 1],
	],
	O: [
		[1, 1],
		[1, 1],
	],
	S: [
		[0, 1, 1],
		[1, 1, 0],
	],
	T: [
		[0, 1, 0],
		[1, 1, 1],
	],
	Z: [
		[1, 1, 0],
		[0, 1, 1],
	],
};

// === Canvas & State ===
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const restartBtn = document.getElementById("restart");

let board, current, nextQueue, score, lines, level, stepMs, dropTimer, gameOver;

function emptyBoard() {
	return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function bag7() {
	const types = Object.keys(SHAPES);
	const bag = [];
	while (bag.length < 7) {
		const t = types[Math.floor(Math.random() * types.length)];
		if (!bag.includes(t)) bag.push(t);
	}
	return bag;
}

function newPiece(type) {
	const shape = SHAPES[type].map((row) => row.slice());
	return { type, shape, x: Math.floor((COLS - shape[0].length) / 2), y: -1, color: COLORS[type] };
}

function rotate(matrix) {
	const N = matrix.length,
		M = matrix[0].length;
	const res = Array.from({ length: M }, () => Array(N).fill(0));
	for (let r = 0; r < N; r++) for (let c = 0; c < M; c++) res[c][N - 1 - r] = matrix[r][c];
	return res;
}

function collide(b, p, offX = 0, offY = 0) {
	for (let r = 0; r < p.shape.length; r++) {
		for (let c = 0; c < p.shape[0].length; c++) {
			if (!p.shape[r][c]) continue;
			const x = p.x + c + offX;
			const y = p.y + r + offY;
			if (x < 0 || x >= COLS || y >= ROWS) return true;
			if (y >= 0 && b[y][x]) return true;
		}
	}
	return false;
}

function merge(b, p) {
	for (let r = 0; r < p.shape.length; r++)
		for (let c = 0; c < p.shape[0].length; c++)
			if (p.shape[r][c]) {
				const y = p.y + r,
					x = p.x + c;
				if (y >= 0) b[y][x] = p.color;
			}
}

function clearLines() {
	let cleared = 0;
	for (let r = ROWS - 1; r >= 0; r--) {
		if (board[r].every((v) => v)) {
			board.splice(r, 1);
			board.unshift(Array(COLS).fill(null));
			cleared++;
			r++; // re-vérifier la même ligne après décalage
		}
	}
	if (cleared) {
		lines += cleared;
		score += [0, 100, 300, 500, 800][cleared] * level; // barème simple
		if (lines >= level * 10) {
			level++;
			stepMs = Math.max(80, Math.floor(stepMs * LEVEL_STEP));
			restartDropTimer();
		}
		updateHUD();
	}
}

function updateHUD() {
	scoreEl.textContent = score;
	linesEl.textContent = lines;
	levelEl.textContent = level;
}

function drawCell(x, y, color) {
	ctx.fillStyle = color;
	ctx.fillRect(x * SIZE, y * SIZE, SIZE, SIZE);
	ctx.strokeStyle = "#0d0f14";
	ctx.lineWidth = 1;
	ctx.strokeRect(x * SIZE + 0.5, y * SIZE + 0.5, SIZE - 1, SIZE - 1);
}

function render() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	// board
	for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (board[r][c]) drawCell(c, r, board[r][c]);
	// current piece
	if (current) {
		for (let r = 0; r < current.shape.length; r++)
			for (let c = 0; c < current.shape[0].length; c++) if (current.shape[r][c]) drawCell(current.x + c, current.y + r, current.color);
	}
}

function hardDrop() {
	while (!collide(board, current, 0, 1)) current.y++;
	tick(); // verrouille et spawn suivant
}

function spawn() {
	if (nextQueue.length === 0) nextQueue = bag7();
	const type = nextQueue.shift();
	current = newPiece(type);
	if (collide(board, current, 0, 1)) {
		// collision dès le spawn => fin
		gameOver = true;
		stopDropTimer();
		drawGameOver();
	}
}

function drawGameOver() {
	ctx.fillStyle = "rgba(0,0,0,.55)";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = "#fff";
	ctx.font = "bold 28px Inter, Arial";
	ctx.textAlign = "center";
	ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2);
}

function tick() {
	if (gameOver) return;
	if (!collide(board, current, 0, 1)) {
		current.y++;
	} else {
		merge(board, current);
		clearLines();
		spawn();
	}
	render();
}

function stopDropTimer() {
	if (dropTimer) {
		clearInterval(dropTimer);
		dropTimer = null;
	}
}
function restartDropTimer() {
	stopDropTimer();
	dropTimer = setInterval(tick, stepMs);
}

function reset() {
	board = emptyBoard();
	nextQueue = bag7();
	score = 0;
	lines = 0;
	level = 1;
	stepMs = STEP_START_MS;
	gameOver = false;
	spawn();
	updateHUD();
	render();
	restartDropTimer();
}

// === Controls ===
window.addEventListener("keydown", (e) => {
	if (gameOver) return;
	const key = e.key.toLowerCase();
	if (key === "arrowleft") {
		if (!collide(board, current, -1, 0)) current.x--;
	} else if (key === "arrowright") {
		if (!collide(board, current, 1, 0)) current.x++;
	} else if (key === "arrowdown") {
		if (!collide(board, current, 0, 1)) current.y++;
	} else if (key === " " || key === "arrowup") {
		hardDrop();
	} else if (key === "z" || key === "q" || key === "w") {
		const r = rotate(current.shape);
		if (!collide(board, { ...current, shape: r }, 0, 0)) current.shape = r;
	}
	render();
});

restartBtn.addEventListener("click", reset);

// Boot
reset();
