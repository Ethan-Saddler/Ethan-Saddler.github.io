document.addEventListener('DOMContentLoaded', () => {
  const preloader = document.querySelector('.preloader');
  const mainContent = document.querySelector('main.fade-in');
  const snakeCanvas = document.getElementById('snakeGame');

  window.addEventListener('load', () => {
    // Let user see loader circle briefly
    setTimeout(() => {
      preloader.classList.add('loaded');
      setTimeout(() => {
        preloader.style.display = 'none';
        
        // Fade in main content & canvas
        mainContent.classList.add('loaded');
        snakeCanvas.classList.add('loaded');

        // Start the game
        initGame();
      }, 500);
    }, 1200);
  });
});

// ---------------- SNAKE GAME ----------------
const canvas = document.getElementById('snakeGame');
const ctx = canvas.getContext('2d');

// We'll let code pick a cellSize dynamically
let cellSize = 25;
let width = 0;
let height = 0;

// Game state
let snake = [];
let snakeOld = [];
let direction = 'RIGHT';
let food = {};
let isGameOver = false;

// For smoothing: 8 updates / second
let moveInterval = 0.125;
let accumTime = 0;
let lastTimestamp = 0;

function initGame() {
  resizeCanvas(); // sets width, height, and adjusts cellSize if needed

  // Center of the grid in cell coords
  const maxX = Math.floor(width / cellSize);
  const maxY = Math.floor(height / cellSize);
  let startX = Math.floor(maxX / 2);
  let startY = Math.floor(maxY / 2);

  // Ensure we have at least 4 cells behind the head to avoid out-of-bounds
  // since we place 5 segments horizontally (head + 4 behind).
  if (startX < 4) startX = 4;

  snake = [];
  snakeOld = [];

  // By default 5 segments horizontally
  for (let i = 0; i < 5; i++) {
    snake.push({ x: startX - i, y: startY });
  }
  copySnake(snakeOld, snake);

  /* DEBUG OPTION: If you suspect immediate collision, 
   * try a single-segment snake:
   *
   // snake = [{ x: startX, y: startY }];
   // snakeOld = [{ x: startX, y: startY }];
   */

  direction = 'RIGHT';
  isGameOver = false;
  spawnFood();

  document.getElementById('restartBtn').style.display = 'none';

  accumTime = 0;
  lastTimestamp = 0;

  console.log('INIT GAME');
  console.log('Canvas px size:', width, 'x', height);
  console.log('Grid size in cells:', maxX, 'x', maxY);
  console.log('Starting snake:', snake);
  console.log('Starting cellSize:', cellSize);

  requestAnimationFrame(gameLoop);
}

function spawnFood() {
  const maxX = Math.floor(width / cellSize);
  const maxY = Math.floor(height / cellSize);
  food.x = Math.floor(Math.random() * maxX);
  food.y = Math.floor(Math.random() * maxY);
}

function gameLoop(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  let delta = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;
  accumTime += delta;

  while (accumTime >= moveInterval) {
    copySnake(snakeOld, snake);
    update();
    accumTime -= moveInterval;
  }
  draw(interp = accumTime / moveInterval);

  if (!isGameOver) {
    requestAnimationFrame(gameLoop);
  }
}

function update() {
  const head = { x: snake[0].x, y: snake[0].y };
  switch(direction) {
    case 'LEFT':  head.x -= 1; break;
    case 'RIGHT': head.x += 1; break;
    case 'UP':    head.y -= 1; break;
    case 'DOWN':  head.y += 1; break;
  }

  // Bounds check
  const maxX = Math.floor(width / cellSize);
  const maxY = Math.floor(height / cellSize);
  if (head.x < 0 || head.x >= maxX || head.y < 0 || head.y >= maxY) {
    endGame('Out of bounds');
    return;
  }

  // Self collision
  for (let seg of snake) {
    if (seg.x === head.x && seg.y === head.y) {
      endGame('Self collision');
      return;
    }
  }

  snake.unshift(head);

  // Check food
  if (head.x === food.x && head.y === food.y) {
    spawnFood();
  } else {
    snake.pop();
  }
}

function draw(interp) {
  ctx.clearRect(0, 0, width, height);

  // Draw snake as circles
  ctx.fillStyle = '#222';
  for (let i = 0; i < snake.length; i++) {
    const sOld = snakeOld[i];
    const sNew = snake[i];
    if (!sOld || !sNew) continue;

    const x = (sOld.x + (sNew.x - sOld.x) * interp) * cellSize + cellSize / 2;
    const y = (sOld.y + (sNew.y - sOld.y) * interp) * cellSize + cellSize / 2;
    const r = cellSize * 0.45;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fill();
  }

  // Draw apple as circle
  ctx.fillStyle = '#555';
  const fx = food.x * cellSize + cellSize / 2;
  const fy = food.y * cellSize + cellSize / 2;
  ctx.beginPath();
  ctx.arc(fx, fy, cellSize * 0.4, 0, 2 * Math.PI);
  ctx.fill();
}

function endGame(reason) {
  console.warn('GAME OVER:', reason);
  isGameOver = true;
  document.getElementById('restartBtn').style.display = 'block';
}

function copySnake(target, source) {
  target.length = 0;
  for (let seg of source) {
    target.push({ x: seg.x, y: seg.y });
  }
}

// If user hits "Restart"
document.getElementById('restartBtn').addEventListener('click', initGame);

// WASD / Arrows
document.addEventListener('keydown', e => {
  if (isGameOver) return;
  switch(e.key.toLowerCase()) {
    case 'w':
    case 'arrowup':
      if (direction !== 'DOWN') direction = 'UP';
      break;
    case 'a':
    case 'arrowleft':
      if (direction !== 'RIGHT') direction = 'LEFT';
      break;
    case 's':
    case 'arrowdown':
      if (direction !== 'UP') direction = 'DOWN';
      break;
    case 'd':
    case 'arrowright':
      if (direction !== 'LEFT') direction = 'RIGHT';
      break;
  }
});

// Handle window resize
window.addEventListener('resize', () => {
  initGame(); // simplest approach
});

/**
 * Attempt to shrink cellSize if the window is too small 
 * so we have at least 8 columns and 8 rows.
 */
function resizeCanvas() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;

  let minCells = 8;
  let done = false;
  while (!done) {
    let maxX = Math.floor(width / cellSize);
    let maxY = Math.floor(height / cellSize);
    if (maxX < minCells || maxY < minCells) {
      if (cellSize > 8) {
        cellSize -= 2;
      } else {
        done = true; // can't shrink further
      }
    } else {
      done = true;
    }
  }
}
