document.addEventListener('DOMContentLoaded', () => {
  const preloader = document.querySelector('.preloader');
  const mainContent = document.querySelector('main.fade-in');
  const snakeCanvas = document.getElementById('snakeGame');

  window.addEventListener('load', () => {
    // Show loader briefly
    setTimeout(() => {
      preloader.classList.add('loaded');
      setTimeout(() => {
        preloader.style.display = 'none';

        // Fade in main content & canvas
        mainContent.classList.add('loaded');
        snakeCanvas.classList.add('loaded');

        // Start the game
        if (!isMobileDevice()) {
          initGame();
        }
      }, 500);
    }, 1200);
  });
});

function isMobileDevice() {
  return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// ---------------- SNAKE GAME ----------------
const canvas = document.getElementById('snakeGame');
const ctx = canvas.getContext('2d');

// Cell size and canvas dims
let cellSize = 25;
let width = 0;
let height = 0;

// Snake state
let snake = [];
let snakeOld = [];
let direction = 'RIGHT';
let pendingDirection = 'RIGHT'; // Store next turn
let food = { x: 0, y: 0 };
let isGameOver = false;

// Growth animation state
let isGrowing = false;
let growthProgress = 0;
let growthSpeed = 0.1; // How fast the growth animation happens
let growthTail = null; // Store the last tail position & vector for growth animation

// Movement timing
let moveInterval = 0.1; // seconds per move
let accumTime = 0;
let lastTimestamp = 0;

// Intro "slither in" variables
let introInProgress = false;  // if true, we haven't finished slithering onto the screen
let introTargetLength = 5;    // total length once fully grown
let introSegmentsGrown = 0;   // how many segments we currently have
let introSide = null;         // which side we're spawning on

// Retract animation on game over
let retracting = false;

// ---------------------------------
// INIT
// ---------------------------------
function initGame() {
  resizeCanvas();

  // Reset game flags
  snake = [];
  snakeOld = [];
  direction = 'RIGHT';
  pendingDirection = 'RIGHT';
  isGameOver = false;
  retracting = false;
  introInProgress = true;
  introSegmentsGrown = 0;
  introSide = null;
  isGrowing = false;
  growthProgress = 0;
  growthTail = null;

  // Setup snake off-screen
  setupIntroSpawn();

  // Spawn food
  spawnFood();

  // Hide restart button
  document.getElementById('restartBtn').style.display = 'none';

  // Reset timers
  accumTime = 0;
  lastTimestamp = 0;

  requestAnimationFrame(gameLoop);
}

// Decide which side to spawn from and place one segment offscreen
function setupIntroSpawn() {
  const maxX = Math.floor(width / cellSize);
  const maxY = Math.floor(height / cellSize);

  // Choose random side
  const sides = ['LEFT', 'RIGHT', 'TOP', 'BOTTOM'];
  introSide = sides[Math.floor(Math.random() * sides.length)];

  let headX, headY;
  switch (introSide) {
    case 'LEFT':
      headX = -1;  // off-screen to the left
      headY = Math.floor(Math.random() * maxY);
      direction = 'RIGHT';
      pendingDirection = 'RIGHT';
      break;
    case 'RIGHT':
      headX = maxX; // off-screen to the right
      headY = Math.floor(Math.random() * maxY);
      direction = 'LEFT';
      pendingDirection = 'LEFT';
      break;
    case 'TOP':
      headX = Math.floor(Math.random() * maxX);
      headY = -1;  // off-screen above
      direction = 'DOWN';
      pendingDirection = 'DOWN';
      break;
    case 'BOTTOM':
      headX = Math.floor(Math.random() * maxX);
      headY = maxY; // off-screen below
      direction = 'UP';
      pendingDirection = 'UP';
      break;
  }

  // Start with length=1
  snake.push({ x: headX, y: headY, direction });
  snakeOld.push({ x: headX, y: headY, direction });
  introSegmentsGrown = 1;
}

// ---------------------------------
// GAME LOOP
// ---------------------------------
function gameLoop(timestamp) {
  requestAnimationFrame(gameLoop);
  if (!lastTimestamp) lastTimestamp = timestamp;
  let delta = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;
  accumTime += delta;

  // Handle growth animation independently
  if (isGrowing) {
    growthProgress += delta / growthSpeed;
    if (growthProgress >= 1) {
      // Finish growth – attach the new segment exactly one cell beyond the old tail
      const newSegment = {
        x: growthTail.x - growthTail.dx,
        y: growthTail.y - growthTail.dy,
        direction: growthTail.direction
      };
      snake.push(newSegment);
      snakeOld.push({ ...newSegment });

      isGrowing = false;
      growthProgress = 0;
      growthTail = null;
    }
  }

  // If game over & retracting:
  if (isGameOver && retracting) {
    while (accumTime >= moveInterval) {
      accumTime -= moveInterval;
      if (snake.length > 0) {
        // Remove from head side
        snake.shift();
      } else {
        // Done retracting
        retracting = false;
        document.getElementById('restartBtn').style.display = 'block';
      }
    }
    draw(0); // no interpolation for retract
    return;
  }

  // Normal or Intro logic
  while (accumTime >= moveInterval && !isGameOver) {
    accumTime -= moveInterval;

    copySnake(snakeOld, snake); // store old positions for smooth interpolation

    // Apply pending direction change
    direction = pendingDirection;

    if (introInProgress) {
      introUpdate();
    } else {
      normalUpdate();
    }
  }

  // Draw with interpolation factor
  draw(accumTime / moveInterval);
}

// ---------------------------------
// INTRO UPDATE (SLITHER IN)
// ---------------------------------
function introUpdate() {
  // Move head in chosen direction
  const head = {
    x: snake[0].x,
    y: snake[0].y,
    direction: direction
  };

  switch (direction) {
    case 'LEFT':  head.x -= 1; break;
    case 'RIGHT': head.x += 1; break;
    case 'UP':    head.y -= 1; break;
    case 'DOWN':  head.y += 1; break;
  }

  snake.unshift(head);

  // Update directions for all segments (passing the turn along the body)
  for (let i = 1; i < snake.length; i++) {
    snake[i].direction = snakeOld[i - 1].direction;
  }

  // Grow until we hit the target length
  if (introSegmentsGrown < introTargetLength) {
    introSegmentsGrown++;
  } else {
    // Once at full length, pop tail
    snake.pop();
  }

  // If the entire snake is on-screen, end intro
  if (isSnakeFullyOnScreen()) {
    introInProgress = false;
  }
}

function isSnakeFullyOnScreen() {
  const maxX = Math.floor(width / cellSize);
  const maxY = Math.floor(height / cellSize);

  for (let seg of snake) {
    if (seg.x < 0 || seg.x >= maxX || seg.y < 0 || seg.y >= maxY) {
      return false;
    }
  }
  return true;
}

// ---------------------------------
// NORMAL UPDATE
// ---------------------------------
function normalUpdate() {
  const head = {
    x: snake[0].x,
    y: snake[0].y,
    direction: direction // Store the current direction
  };

  switch (direction) {
    case 'LEFT':  head.x -= 1; break;
    case 'RIGHT': head.x += 1; break;
    case 'UP':    head.y -= 1; break;
    case 'DOWN':  head.y += 1; break;
  }

  const maxX = Math.floor(width / cellSize);
  const maxY = Math.floor(height / cellSize);

  // Check bounds
  if (head.x < 0 || head.x >= maxX || head.y < 0 || head.y >= maxY) {
    endGame();
    return;
  }

  // Check self collision
  for (let seg of snake) {
    if (seg.x === head.x && seg.y === head.y) {
      endGame();
      return;
    }
  }

  snake.unshift(head);

  // Update directions for all segments (passing the turn along the body)
  for (let i = 1; i < snake.length; i++) {
    snake[i].direction = snakeOld[i - 1].direction;
  }

  /* ---------- FOOD ---------- */
  if (head.x === food.x && head.y === food.y) {
    const tail = snake[snake.length - 1];
    const prevTail = snake.length > 1 ? snake[snake.length - 2] : tail;

    const dx = tail.x - prevTail.x;
    const dy = tail.y - prevTail.y;

    let tailDir = 'RIGHT';
    if (dx === 1) tailDir = 'RIGHT';
    if (dx === -1) tailDir = 'LEFT';
    if (dy === 1) tailDir = 'DOWN';
    if (dy === -1) tailDir = 'UP';

    growthTail = { x: tail.x, y: tail.y, direction: tailDir, dx, dy };
    isGrowing = true;
    growthProgress = 0;

    spawnFood();
  } else if (!isGrowing) {
    // Only remove tail if we're not growing
    snake.pop();
  }
}

// ---------------------------------
// DRAW
// ---------------------------------
function draw(interp) {
  ctx.clearRect(0, 0, width, height);

  // Draw the snake
  drawSnake(interp);

  // Draw food as a square
  ctx.fillStyle = '#555';
  const fx = food.x * cellSize;
  const fy = food.y * cellSize;
  ctx.fillRect(fx, fy, cellSize, cellSize);
}

function drawSnake(interp) {
  if (snake.length === 0) return;

  // Create interpolated points array
  let points = [];

  // For each segment, calculate its interpolated position
  for (let i = 0; i < snake.length; i++) {
    const sOld = snakeOld[i];
    const sNew = snake[i];

    if (!sOld || !sNew) continue;

    const x = (sOld.x + (sNew.x - sOld.x) * interp) * cellSize + cellSize / 2;
    const y = (sOld.y + (sNew.y - sOld.y) * interp) * cellSize + cellSize / 2;

    points.push({ x, y, direction: sNew.direction, isLast: i === snake.length - 1 });
  }

  /* ---------- GROWTH ANIMATION ---------- */
  if (isGrowing && growthTail) {
    const tailCenterX = growthTail.x * cellSize + cellSize / 2;
    const tailCenterY = growthTail.y * cellSize + cellSize / 2;

    points.push({
      x: tailCenterX - growthTail.dx * cellSize * (1 - growthProgress),
      y: tailCenterY - growthTail.dy * cellSize * (1 - growthProgress),
      isLast: true
    });
  }

  drawSplineSnake(points);
}

// Alternative approach - stable curves with fixed radius corners
function drawSplineSnake(points) {
  if (points.length < 2) return;

  const cornerRadius = cellSize * 0.5; // Fixed radius for all corners

  ctx.save();
  ctx.lineWidth = cellSize * 0.9;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#222';
  ctx.fillStyle = '#222';

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i++) {
    const current = points[i];
    const previous = points[i - 1];
    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (i < points.length - 1 && length > 0) {
      const next = points[i + 1];
      const dx2 = next.x - current.x;
      const dy2 = next.y - current.y;
      const length2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      const isCorner = Math.abs(dx * dx2 + dy * dy2) < length * length2 * 0.9;

      if (isCorner && length2 > 0) {
        ctx.lineTo(
          current.x - (dx / length) * cornerRadius,
          current.y - (dy / length) * cornerRadius
        );
        ctx.arcTo(
          current.x, current.y,
          current.x + (dx2 / length2) * cornerRadius,
          current.y + (dy2 / length2) * cornerRadius,
          cornerRadius
        );
      } else {
        ctx.lineTo(current.x, current.y);
      }
    } else {
      ctx.lineTo(current.x, current.y);
    }
  }

  ctx.stroke();
  ctx.restore();
}

// ---------------------------------
// GAME OVER => RETRACT
// ---------------------------------
function endGame() {
  console.warn('GAME OVER');
  isGameOver = true;
  retracting = true; // snake shrinks from head
  isGrowing = false; // cancel any growth
}

function spawnFood() {
  const canvas = document.getElementById('snakeGame');
  const buttonsContainer = document.querySelector('.cta-buttons');

  const canvasRect = canvas.getBoundingClientRect();
  const buttonsRect = buttonsContainer.getBoundingClientRect();

  const offsetY = buttonsRect.bottom - canvasRect.top;

  const maxX = Math.floor(canvas.width / cellSize);
  const maxY = Math.floor(canvas.height / cellSize);

  // Make food spawn below the buttons
  const minX = 2;
  const maxX2 = maxX - 3;
  const minY = Math.ceil(offsetY / cellSize);
  const maxY2 = maxY - 3;

  const safeMaxX = Math.max(minX, maxX2);
  const safeMaxY = Math.max(minY, maxY2);

  food.x = Math.floor(Math.random() * (safeMaxX - minX + 1) + minX);
  food.y = Math.floor(Math.random() * (safeMaxY - minY + 1) + minY);
}

function copySnake(target, source) {
  target.length = 0;
  for (let seg of source) {
    target.push({ x: seg.x, y: seg.y, direction: seg.direction });
  }
}

// Restart

document.getElementById('restartBtn').addEventListener('click', initGame);

// Direction controls
document.addEventListener('keydown', e => {
  // No direction changes if we're in retract or waiting
  if (isGameOver && !introInProgress) return;
  if (introInProgress) return; // ignore user input until fully on screen

  // Prevent illegal moves (180 degree turns)
  switch(e.key.toLowerCase()) {
    case 'w':
    case 'arrowup':
      if (direction !== 'DOWN') pendingDirection = 'UP';
      break;
    case 'a':
    case 'arrowleft':
      if (direction !== 'RIGHT') pendingDirection = 'LEFT';
      break;
    case 's':
    case 'arrowdown':
      if (direction !== 'UP') pendingDirection = 'DOWN';
      break;
    case 'd':
    case 'arrowright':
      if (direction !== 'LEFT') pendingDirection = 'RIGHT';
      break;
  }
});

// On resize => re-init
window.addEventListener('resize', () => {
  if (!isMobileDevice()) {
    initGame();
  }
});

// Dynamically resize cellSize if needed
function resizeCanvas() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;

  let minCells = 8;
  while (true) {
    let maxX = Math.floor(width / cellSize);
    let maxY = Math.floor(height / cellSize);
    if ((maxX < minCells || maxY < minCells) && cellSize > 8) {
      cellSize -= 2;
    } else {
      break;
    }
  }
}