// Start flag set by index.html Play button
window.gameStart = false;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const hpText = document.getElementById("hpText");
const scoreText = document.getElementById("scoreText");
const waveText = document.getElementById("waveText");

let width, height;
function resize() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;

  // if sword not placed yet, put it near center
  if (sword.x === null || sword.y === null) {
    sword.x = width / 2;
    sword.y = height / 2;
  }
}
resize();
window.addEventListener("resize", resize);

// ----- GAME OBJECTS -----
const base = {
  x: () => width / 2,
  y: () => height - 80,
  width: 160,
  height: 40,
  hp: 100
};

const BORDER = 40; // safety border so sword never leaves screen

const sword = {
  x: null,
  y: null,
  length: 80,
  width: 16,
  color: "#f6ff9a",
  isDragging: false,
  offsetX: 0,
  offsetY: 0,
  swingAngle: 0,   // current rotation
  swingDir: 1,     // +1 or -1 for back-and-forth
  hitRadius: 70    // range around sword center to damage enemies
};

let enemies = [];
let score = 0;
let wave = 1;

// ----- INPUT: DRAG + SWING -----
function getMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

function isMouseOnSword(mx, my) {
  const dx = mx - sword.x;
  const dy = my - sword.y;
  const dist = Math.hypot(dx, dy);
  return dist < sword.length; // simple circular hitbox for grabbing
}

canvas.addEventListener("mousedown", (e) => {
  if (!window.gameStart || base.hp <= 0) return;

  const { x: mx, y: my } = getMousePos(e);
  if (isMouseOnSword(mx, my)) {
    sword.isDragging = true;
    sword.offsetX = mx - sword.x;
    sword.offsetY = my - sword.y;
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (!window.gameStart || base.hp <= 0) return;
  if (!sword.isDragging) return;

  const { x: mx, y: my } = getMousePos(e);

  let nx = mx - sword.offsetX;
  let ny = my - sword.offsetY;

  // clamp to safety borders
  nx = Math.max(BORDER, Math.min(width - BORDER, nx));
  ny = Math.max(BORDER, Math.min(height - BORDER, ny));

  sword.x = nx;
  sword.y = ny;
});

canvas.addEventListener("mouseup", () => {
  sword.isDragging = false;
});

canvas.addEventListener("mouseleave", () => {
  sword.isDragging = false;
});

// ----- ENEMY SPAWNING -----
function spawnEnemy() {
  const margin = 80;
  const x = Math.random() * (width - 2 * margin) + margin;
  enemies.push({
    x,
    y: -40,
    radius: 24,
    speed: 40 + 10 * wave,
    hp: 40 + 10 * wave
  });
}

let spawnTimer = 0;
let spawnInterval = 1400;

// ----- UPDATE LOOP -----
let lastFrame = performance.now();
function loop(now) {
  const dt = (now - lastFrame) / 1000;
  lastFrame = now;

  // Only update game logic after "Play" is pressed and while base alive
  if (window.gameStart && base.hp > 0) {
    update(dt);
  }

  draw();
  requestAnimationFrame(loop);
}

function update(dt) {
  if (base.hp <= 0) return;

  // spawn trojans
  spawnTimer += dt * 1000;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnEnemy();
  }

  // ramp waves by score
  const newWave = 1 + Math.floor(score / 30);
  if (newWave !== wave) {
    wave = newWave;
    spawnInterval = Math.max(500, 1400 - (wave - 1) * 80);
  }

  // move enemies toward base
  for (const enemy of enemies) {
    const dx = base.x() - enemy.x;
    const dy = base.y() - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const vx = (dx / dist) * enemy.speed;
    const vy = (dy / dist) * enemy.speed;
    enemy.x += vx * dt;
    enemy.y += vy * dt;

    // reach base
    if (dist < 40) {
      base.hp -= 10;
      enemy.hp = 0;
    }
  }

  // sword swing logic
  if (sword.isDragging) {
    const swingSpeed = 6;    // rad/sec
    const maxSwing = 0.6;    // about ±35 degrees
    sword.swingAngle += sword.swingDir * swingSpeed * dt;
    if (sword.swingAngle > maxSwing || sword.swingAngle < -maxSwing) {
      sword.swingDir *= -1;
    }
  } else {
    // ease back to center when not dragging
    sword.swingAngle *= 0.9;
  }

  // sword vs enemies collision
  for (const e of enemies) {
    const dx = e.x - sword.x;
    const dy = e.y - sword.y;
    const dist = Math.hypot(dx, dy);

    if (dist < sword.hitRadius) {
      // continuous damage while in range
      if (e.hp > 0) {
        e.hp -= 80 * dt; // damage per second
        if (e.hp <= 0) {
          score += 5;
        }
      }
    }
  }

  // remove dead enemies
  enemies = enemies.filter(e => e.hp > 0);

  // HUD
  hpText.textContent = `Base HP: ${Math.max(0, Math.floor(base.hp))}`;
  scoreText.textContent = `Score: ${score}`;
  waveText.textContent = `Wave: ${wave}`;
}

// ----- DRAW -----
function draw() {
  ctx.clearRect(0, 0, width, height);

  // background grid
  ctx.fillStyle = "#0b0e16";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#151a26";
  ctx.lineWidth = 1;
  const grid = 40;
  for (let x = 0; x < width; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // base (firewall)
  const bx = base.x() - base.width / 2;
  const by = base.y() - base.height / 2;
  ctx.fillStyle = "#c0483f";
  ctx.fillRect(bx, by, base.width, base.height);
  // brick lines
  ctx.strokeStyle = "#6b2019";
  ctx.lineWidth = 2;
  for (let i = 0; i <= base.width; i += 32) {
    ctx.beginPath();
    ctx.moveTo(bx + i, by);
    ctx.lineTo(bx + i, by + base.height);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(bx, by + base.height / 2);
  ctx.lineTo(bx + base.width, by + base.height / 2);
  ctx.stroke();

  // sword (if base alive)
  if (base.hp > 0) {
    ctx.save();
    ctx.translate(sword.x, sword.y);
    ctx.rotate(sword.swingAngle);

    // blade
    ctx.fillStyle = sword.color;
    ctx.fillRect(-sword.width / 2, -sword.length, sword.width, sword.length);

    // tip
    ctx.fillStyle = "#ffe9b3";
    ctx.fillRect(-sword.width / 2, -sword.length - 10, sword.width, 10);

    ctx.restore();
  }

  // enemies (Trojan horses)
  for (const e of enemies) {
    // body
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#ffb347";
    ctx.fill();
    // "horse head"
    ctx.beginPath();
    ctx.arc(e.x + e.radius * 0.7, e.y - e.radius * 0.4, e.radius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = "#e28a2c";
    ctx.fill();
    // wheels
    ctx.fillStyle = "#3b2c23";
    ctx.beginPath();
    ctx.arc(e.x - e.radius * 0.5, e.y + e.radius * 0.8, 6, 0, Math.PI * 2);
    ctx.arc(e.x + e.radius * 0.5, e.y + e.radius * 0.8, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // game over text
  if (base.hp <= 0) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#fff";
    ctx.font = "32px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Firewall Breached!", width / 2, height / 2 - 10);
    ctx.font = "20px Arial";
    ctx.fillText(`Final score: ${score}`, width / 2, height / 2 + 24);
    ctx.fillText("Refresh the page to restart", width / 2, height / 2 + 50);
  }
}

requestAnimationFrame(loop);
