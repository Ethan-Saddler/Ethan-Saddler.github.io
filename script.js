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
let growthTail = null; // Store the last tail position for growth animation
let segmentHistory = []; // Track previous positions for smooth turns

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
  segmentHistory = [];

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
      // Complete growth by adding the segment permanently
      if (growthTail) {
        // When growth completes, add position from history for smoother transition
        const newSegment = { 
          x: growthTail.x, 
          y: growthTail.y,
          direction: growthTail.direction 
        };
        
        snake.push(newSegment);
        snakeOld.push({...newSegment}); // Clone to prevent reference issues
        
        // Apply last few positions from history to ensure smooth motion
        applyHistoryToSegment(snake.length - 1);
      }
      growthProgress = 0;
      isGrowing = false;
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
    
    // Before updating, store current snake positions for history
    updateSegmentHistory();
    
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

// Keep track of previous positions for smooth transitions
function updateSegmentHistory() {
  // Store last 10 frames of history (adjust as needed)
  if (segmentHistory.length > 10) {
    segmentHistory.shift();
  }
  
  // Create a deep copy of current snake state
  const snapshot = [];
  for (let i = 0; i < snake.length; i++) {
    snapshot.push({...snake[i]});
  }
  
  segmentHistory.push(snapshot);
}

// Apply history data to newly added segment for smooth transitions
function applyHistoryToSegment(segmentIndex) {
  if (segmentHistory.length < 2) return;
  
  // Get the last few frames of history for smooth transition
  const lastFrames = segmentHistory.slice(-5);
  
  // Apply the direction from history to ensure it follows the right path
  for (let i = 0; i < lastFrames.length; i++) {
    const historyFrame = lastFrames[i];
    // Make sure the history frame has enough segments
    if (historyFrame.length > segmentIndex - 1) {
      const prevSegDirection = historyFrame[segmentIndex - 1].direction;
      // Update the direction of the newly added segment to match the flow
      if (i === lastFrames.length - 1 && segmentIndex < snake.length) {
        snake[segmentIndex].direction = prevSegDirection;
      }
    }
  }
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
    snake[i].direction = snakeOld[i-1].direction;
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
    snake[i].direction = snakeOld[i-1].direction;
  }

  // Check food
  if (head.x === food.x && head.y === food.y) {
    // If already growing, complete that growth first
    if (isGrowing) {
      if (growthTail) {
        // Add the segment permanently
        snake.push({ 
          x: growthTail.x, 
          y: growthTail.y,
          direction: growthTail.direction 
        });
        
        // Apply history for smooth behavior
        applyHistoryToSegment(snake.length - 1);
      }
    }
    
    // Store the tail position before popping
    if (snake.length > 0) {
      const tail = snake[snake.length - 1];
      // Use second-to-last direction to ensure proper continuation
      let tailDirection = tail.direction;
      if (snake.length > 1) {
        // Get a more accurate direction based on the previous segment
        const prevSeg = snake[snake.length - 2];
        if (prevSeg.x > tail.x) tailDirection = 'LEFT';
        else if (prevSeg.x < tail.x) tailDirection = 'RIGHT';
        else if (prevSeg.y > tail.y) tailDirection = 'UP';
        else if (prevSeg.y < tail.y) tailDirection = 'DOWN';
      }
      
      growthTail = { 
        x: tail.x, 
        y: tail.y,
        direction: tailDirection
      };
    }
    
    // Start growth animation
    isGrowing = true;
    growthProgress = 0;
    
    spawnFood();
  } else if (!isGrowing) {
    // Only remove the last segment if we're not in the middle of growing
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
    
    // Store point with direction
    points.push({ 
      x, 
      y, 
      direction: sNew.direction,
      isLast: (i === snake.length - 1)
    });
  }

  // Add growth animation tail segment if growing
  if (isGrowing && growthTail) {
    const lastSegment = points.length > 0 ? points[points.length - 1] : null;
    
    if (lastSegment) {
      // Get the direction of the segment that the tail should follow
      let tailDir = growthTail.direction;
      
      // Calculate tail position based on growth direction
      const tailX = growthTail.x * cellSize + cellSize / 2;
      const tailY = growthTail.y * cellSize + cellSize / 2;
      
      // Calculate animation target position (one cell away in tail direction)
      let targetX = tailX;
      let targetY = tailY;
      
      // The opposite of the tail's direction is the growth direction
      switch (tailDir) {
        case 'RIGHT': targetX -= cellSize; break;
        case 'LEFT':  targetX += cellSize; break;
        case 'DOWN':  targetY -= cellSize; break;
        case 'UP':    targetY += cellSize; break;
      }
      
      // Interpolate between current tail and target position based on growth progress
      const animTailX = targetX + (tailX - targetX) * growthProgress;
      const animTailY = targetY + (tailY - targetY) * growthProgress;
      
      // Add the growing segment with correct orientation
      points.push({ 
        x: animTailX,
        y: animTailY, 
        direction: tailDir,
        isLast: true,
        isGrowing: true
      });
    }
  }

  // Draw the snake using spline curve
  drawSplineSnake(points);
}

// Alternative approach - stable curves with fixed radius corners
function drawSplineSnake(points) {
  if (points.length < 2) return;
  
  const cornerRadius = cellSize * 0.5; // Fixed radius for all corners
  
  ctx.save();
  ctx.lineWidth = cellSize * 0.9;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#222";
  ctx.fillStyle = "#222";
  
  // Draw the path with rounded corners
  ctx.beginPath();
  
  // Start at the first point
  if (points.length >= 2) {
    // Move to the start point
    ctx.moveTo(points[0].x, points[0].y);
    
    // For each segment after the first
    for (let i = 1; i < points.length; i++) {
      const current = points[i];
      const previous = points[i-1];
      
      // Calculate the direction vector
      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      
      // Normalize and scale to create a fixed-radius arc
      const length = Math.sqrt(dx * dx + dy * dy);
      
      // If we're at a corner point and there's a next point
      if (i < points.length - 1 && length > 0) {
        const next = points[i+1];
        
        // Calculate next segment direction
        const dx2 = next.x - current.x;
        const dy2 = next.y - current.y;
        const length2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        
        // Check if this is actually a corner (direction change)
        const isCorner = Math.abs(dx * dx2 + dy * dy2) < length * length2 * 0.9;
        
        if (isCorner && length2 > 0) {
          // Draw line to point before the corner
          ctx.lineTo(
            current.x - (dx / length) * cornerRadius,
            current.y - (dy / length) * cornerRadius
          );
          
          // Use a simple arc for the corner - this creates a stable curve
          ctx.arcTo(
            current.x, current.y,
            current.x + (dx2 / length2) * cornerRadius,
            current.y + (dy2 / length2) * cornerRadius,
            cornerRadius
          );
        } else {
          // Not a corner or no next point, just draw a line
          ctx.lineTo(current.x, current.y);
        }
      } else {
        // Last point or very short segment, just draw a line
        ctx.lineTo(current.x, current.y);
      }
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
  const minY = Math.ceil(offsetY / cellSize); // This line is key
  const maxY2 = maxY - 3;

  const safeMaxX = Math.max(minX, maxX2);
  const safeMaxY = Math.max(minY, maxY2);

  food.x = Math.floor(Math.random() * (safeMaxX - minX + 1) + minX);
  food.y = Math.floor(Math.random() * (safeMaxY - minY + 1) + minY);
}

function copySnake(target, source) {
  target.length = 0;
  for (let seg of source) {
    target.push({ 
      x: seg.x, 
      y: seg.y,
      direction: seg.direction 
    });
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