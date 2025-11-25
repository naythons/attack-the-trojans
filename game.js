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

const sword = {
  radius: 110,
  angle: -Math.PI / 2, // pointing up
  length: 60,
  width: 14,
  color: "#f6ff9a"
};

let enemies = [];
let projectiles = [];

let score = 0;
let wave = 1;

// ----- INPUT / SWING LOGIC -----
let isCharging = false;
let lastAngle = null;
let lastTime = null;
let angularVelocity = 0; // rad/s
let chargePower = 0;     // 0–1

function screenToAngle(mx, my) {
  const dx = mx - base.x();
  const dy = my - base.y();
  return Math.atan2(dy, dx);
}

canvas.addEventListener("mousedown", (e) => {
  if (!window.gameStart || base.hp <= 0) return;

  isCharging = true;
  lastAngle = screenToAngle(e.clientX, e.clientY);
  lastTime = performance.now();
});

canvas.addEventListener("mouseup", () => {
  if (!window.gameStart || base.hp <= 0) return;

  if (isCharging) {
    // launch projectile based on chargePower and direction
    const dirAngle = sword.angle;
    const minSpeed = 500;
    const maxSpeed = 1400;
    const speed = minSpeed + (maxSpeed - minSpeed) * chargePower;

    projectiles.push({
      x: base.x() + Math.cos(dirAngle) * sword.radius,
      y: base.y() + Math.sin(dirAngle) * sword.radius,
      vx: Math.cos(dirAngle) * speed,
      vy: Math.sin(dirAngle) * speed,
      radius: 10,
      damage: 20 + 60 * chargePower
    });
  }
  isCharging = false;
  angularVelocity = 0;
  chargePower = 0;
  sword.radius = 110;
});

canvas.addEventListener("mousemove", (e) => {
  if (!window.gameStart || base.hp <= 0) return;
  if (!isCharging) return;

  const now = performance.now();
  const a = screenToAngle(e.clientX, e.clientY);

  if (lastAngle != null) {
    // shortest angular difference
    let diff = a - lastAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    const dt = (now - lastTime) / 1000; // seconds
    if (dt > 0) {
      const currentAV = diff / dt; // rad/s
      // smooth a bit
      angularVelocity = angularVelocity * 0.7 + currentAV * 0.3;

      // charge from angular speed (absolute)
      const maxAV = 12; // cap
      const normalized = Math.min(Math.abs(angularVelocity) / maxAV, 1);
      chargePower = normalized;
      sword.radius = 110 + 40 * chargePower; // visually extend a bit
    }
  }
  lastAngle = a;
  lastTime = now;
  sword.angle = a;
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

  // move enemies
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
  enemies = enemies.filter(e => e.hp > 0);

  // move projectiles
  for (const p of projectiles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  // remove offscreen
  projectiles = projectiles.filter(p =>
    p.x > -60 && p.x < width + 60 && p.y > -60 && p.y < height + 60
  );

  // collisions: projectiles vs enemies
  for (const p of projectiles) {
    for (const e of enemies) {
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist < e.radius + p.radius) {
        e.hp -= p.damage;
        p.hit = true;
        if (e.hp <= 0) {
          score += 5;
        }
      }
    }
  }
  projectiles = projectiles.filter(p => !p.hit);

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
    const sx = base.x() + Math.cos(sword.angle) * sword.radius;
    const sy = base.y() + Math.sin(sword.angle) * sword.radius;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(sword.angle + Math.PI / 2);
    ctx.fillStyle = sword.color;
    ctx.fillRect(-sword.width / 2, -sword.length, sword.width, sword.length);
    ctx.fillStyle = "#ffe9b3";
    ctx.fillRect(-sword.width / 2, -sword.length - 10, sword.width, 10); // tip
    ctx.restore();

    // charge indicator
    if (isCharging) {
      ctx.beginPath();
      ctx.arc(base.x(), base.y(), sword.radius + 12, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0,255,200,${0.3 + 0.4 * chargePower})`;
      ctx.lineWidth = 4;
      ctx.stroke();
    }
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

  // projectiles (spinning energy)
  for (const p of projectiles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#a9fff6";
    ctx.fill();
    ctx.strokeStyle = "#53f5e3";
    ctx.lineWidth = 2;
    ctx.stroke();
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
