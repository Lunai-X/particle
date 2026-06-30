const canvas = document.querySelector("#particleCanvas");
const ctx = canvas.getContext("2d", { alpha: false });
const imageInput = document.querySelector("#imageInput");
const statusText = document.querySelector("#statusText");
const cameraButton = document.querySelector("#cameraButton");
const cameraFeed = document.querySelector("#cameraFeed");
const gestureLabel = document.querySelector("#gestureLabel");
const fingerLabel = document.querySelector("#fingerLabel");
const modeButtons = [...document.querySelectorAll("[data-mode]")];

const MODES = {
  smoke: { label: "彩雾", hue: [286, 196] },
  fire: { label: "火焰", hue: [18, 52] },
  water: { label: "水流", hue: [176, 214] },
  stars: { label: "星河", hue: [228, 315] },
  bubbles: { label: "泡泡", hue: [166, 304] },
};

const modeByFingerCount = ["smoke", "smoke", "fire", "water", "stars", "bubbles"];
const particles = [];
const imageParticles = [];
const ripples = [];
const IMAGE_PARTICLE_DETAIL = 16200;
let mode = "smoke";
let width = 0;
let height = 0;
let pointer = { x: 0, y: 0, active: false, pressure: 0 };
let handPointer = null;
let camera = null;
let lastRipple = 0;
let loadedImage = null;
let backgroundPhase = 0;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (loadedImage) buildImageParticles(loadedImage);
}

function setMode(nextMode, source = "手动") {
  mode = nextMode;
  modeButtons.forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
  gestureLabel.textContent = `${source}: ${MODES[mode].label}`;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function modeHue(nextMode, offset = 0) {
  const [a, b] = MODES[nextMode].hue;
  return (rand(a, b) + offset + 360) % 360;
}

function spawnParticle(x, y, nextMode = mode, power = 1) {
  const particle = {
    x,
    y,
    ox: x,
    oy: y,
    vx: 0,
    vy: 0,
    life: 1,
    decay: rand(0.006, 0.02),
    size: rand(1, 4),
    mode: nextMode,
    spin: rand(-0.06, 0.06),
    hue: modeHue(nextMode),
    hue2: modeHue(nextMode, rand(18, 72)),
  };

  if (nextMode === "smoke") {
    particle.vx = rand(-0.45, 0.45) * power;
    particle.vy = rand(-1.8, -0.3) * power;
    particle.size = rand(8, 26) * power;
    particle.decay = rand(0.004, 0.012);
  } else if (nextMode === "fire") {
    particle.vx = rand(-1.1, 1.1) * power;
    particle.vy = rand(-4.8, -1.6) * power;
    particle.size = rand(4, 14) * power;
    particle.decay = rand(0.012, 0.03);
  } else if (nextMode === "water") {
    particle.vx = rand(2.2, 7.4) * power;
    particle.vy = rand(-2.4, 2.4) * power;
    particle.size = rand(2, 7) * power;
    particle.decay = rand(0.01, 0.026);
  } else if (nextMode === "stars") {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(1.8, 8) * power;
    particle.vx = Math.cos(angle) * speed;
    particle.vy = Math.sin(angle) * speed;
    particle.size = rand(1, 3.2) * power;
    particle.decay = rand(0.006, 0.016);
  } else if (nextMode === "bubbles") {
    particle.vx = rand(-1.2, 1.2) * power;
    particle.vy = rand(-3.3, -0.8) * power;
    particle.size = rand(8, 24) * power;
    particle.decay = rand(0.005, 0.014);
  }

  particles.push(particle);
}

function spawnBurst(x, y, amount, nextMode = mode, power = 1) {
  for (let i = 0; i < amount; i += 1) {
    spawnParticle(x + rand(-18, 18), y + rand(-18, 18), nextMode, power);
  }
}

function addRipple(x, y, strength = 1) {
  ripples.push({ x, y, radius: 10, life: 1, strength });
  spawnBurst(x, y, Math.floor(24 * strength), "water", 1.2);
}

function drawParticle(p) {
  ctx.save();
  ctx.globalAlpha = Math.max(p.life, 0);

  if (p.mode === "smoke") {
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
    gradient.addColorStop(0, `hsla(${p.hue}, 92%, 72%, 0.34)`);
    gradient.addColorStop(0.48, `hsla(${p.hue2}, 88%, 62%, 0.16)`);
    gradient.addColorStop(1, `hsla(${p.hue}, 92%, 62%, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.mode === "fire") {
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 1.45);
    gradient.addColorStop(0, `hsla(48, 100%, 78%, ${p.life})`);
    gradient.addColorStop(0.36, `hsla(${p.hue}, 100%, 58%, ${p.life * 0.92})`);
    gradient.addColorStop(1, "hsla(338, 92%, 48%, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.size * 0.58, p.size * 1.32, p.spin, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.mode === "water") {
    ctx.strokeStyle = `hsla(${p.hue}, 95%, 66%, ${p.life})`;
    ctx.shadowColor = `hsla(${p.hue}, 100%, 62%, 0.55)`;
    ctx.shadowBlur = 10;
    ctx.lineWidth = Math.max(1, p.size * 0.55);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.vx * 3.6, p.y - p.vy * 3.6);
    ctx.stroke();
  } else if (p.mode === "stars") {
    ctx.fillStyle = `hsla(${p.hue}, 100%, ${68 + p.life * 20}%, ${p.life})`;
    ctx.shadowColor = `hsla(${p.hue2}, 100%, 70%, 0.72)`;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - p.size * 2);
    ctx.lineTo(p.x + p.size * 0.6, p.y - p.size * 0.5);
    ctx.lineTo(p.x + p.size * 2, p.y);
    ctx.lineTo(p.x + p.size * 0.6, p.y + p.size * 0.5);
    ctx.lineTo(p.x, p.y + p.size * 2);
    ctx.lineTo(p.x - p.size * 0.6, p.y + p.size * 0.5);
    ctx.lineTo(p.x - p.size * 2, p.y);
    ctx.lineTo(p.x - p.size * 0.6, p.y - p.size * 0.5);
    ctx.closePath();
    ctx.fill();
  } else if (p.mode === "bubbles") {
    ctx.strokeStyle = `hsla(${p.hue}, 96%, 76%, ${p.life * 0.82})`;
    ctx.shadowColor = `hsla(${p.hue2}, 100%, 70%, 0.4)`;
    ctx.shadowBlur = 9;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `hsla(${p.hue2}, 100%, 84%, ${p.life * 0.34})`;
    ctx.beginPath();
    ctx.arc(p.x - p.size * 0.28, p.y - p.size * 0.28, Math.max(1, p.size * 0.18), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    if (p.mode === "smoke") {
      p.vx += Math.sin(p.y * 0.014 + p.life * 8) * 0.018;
      p.vy -= 0.006;
      p.size += 0.04;
    } else if (p.mode === "fire") {
      p.vy -= 0.05;
      p.vx *= 0.985;
      p.size *= 0.992;
    } else if (p.mode === "water") {
      p.vy += 0.055;
      p.vx *= 0.992;
    } else if (p.mode === "stars") {
      p.vx *= 0.988;
      p.vy *= 0.988;
    } else if (p.mode === "bubbles") {
      p.vx += Math.sin(p.y * 0.025) * 0.015;
      p.vy -= 0.012;
    }

    p.x += p.vx;
    p.y += p.vy;
    p.life -= p.decay;
    drawParticle(p);

    if (p.life <= 0 || p.x < -80 || p.x > width + 80 || p.y < -100 || p.y > height + 100) {
      particles.splice(i, 1);
    }
  }
}

function buildImageParticles(image) {
  imageParticles.length = 0;
  const sampler = document.createElement("canvas");
  const sctx = sampler.getContext("2d", { willReadFrequently: true });
  const maxW = Math.min(width * 0.68, 900);
  const maxH = Math.min(height * 0.64, 680);
  const scale = Math.min(maxW / image.width, maxH / image.height, 1);
  const drawW = Math.max(1, Math.floor(image.width * scale));
  const drawH = Math.max(1, Math.floor(image.height * scale));
  sampler.width = drawW;
  sampler.height = drawH;
  sctx.drawImage(image, 0, 0, drawW, drawH);
  const data = sctx.getImageData(0, 0, drawW, drawH).data;
  const step = Math.max(2, Math.floor(Math.sqrt((drawW * drawH) / IMAGE_PARTICLE_DETAIL)));
  const particleSize = Math.max(0.75, Math.min(1.85, step * 0.34));
  const ox = width * 0.5 - drawW * 0.5;
  const oy = height * 0.52 - drawH * 0.5;

  for (let y = 0; y < drawH; y += step) {
    for (let x = 0; x < drawW; x += step) {
      const index = (y * drawW + x) * 4;
      const alpha = data[index + 3];
      if (alpha < 36) continue;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const targetX = ox + x;
      const targetY = oy + y;
      const glow = Math.max(red, green, blue) / 255;
      imageParticles.push({
        x: targetX + rand(-width * 0.45, width * 0.45),
        y: targetY + rand(-height * 0.45, height * 0.45),
        tx: targetX + rand(-step * 0.18, step * 0.18),
        ty: targetY + rand(-step * 0.18, step * 0.18),
        vx: 0,
        vy: 0,
        size: particleSize * rand(0.72, 1.2),
        alpha: Math.min(0.98, Math.max(0.38, alpha / 255)),
        color: `rgb(${red}, ${green}, ${blue})`,
        glow: Math.max(0.08, glow * 0.26),
      });
    }
  }
}

function drawImageParticles() {
  if (!imageParticles.length) return;
  const attractor = handPointer || pointer;
  for (const p of imageParticles) {
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    p.vx += dx * 0.012;
    p.vy += dy * 0.012;

    if (attractor.active || handPointer) {
      const ax = p.x - attractor.x;
      const ay = p.y - attractor.y;
      const distSq = ax * ax + ay * ay;
      const radius = mode === "water" ? 165 : 118;
      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq) || 1;
        const push = (1 - dist / radius) * (mode === "fire" ? 2.8 : 1.55);
        p.vx += (ax / dist) * push;
        p.vy += (ay / dist) * push;
      }
    }

    p.vx *= 0.88;
    p.vy *= 0.88;
    p.x += p.vx;
    p.y += p.vy;

    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    if (p.glow > 0.12) {
      ctx.globalAlpha = p.alpha * p.glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawRipples() {
  for (let i = ripples.length - 1; i >= 0; i -= 1) {
    const r = ripples[i];
    ctx.strokeStyle = `hsla(${176 + r.radius * 0.18}, 100%, 68%, ${r.life * 0.72})`;
    ctx.lineWidth = 1 + r.strength * 2;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `hsla(${302 - r.radius * 0.08}, 92%, 74%, ${r.life * 0.36})`;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius * 0.68, 0, Math.PI * 2);
    ctx.stroke();
    r.radius += 4.8 + r.strength * 3;
    r.life -= 0.018;
    if (r.life <= 0) ripples.splice(i, 1);
  }
}

function drawBackground() {
  backgroundPhase += 0.008;
  const hueA = 214 + Math.sin(backgroundPhase) * 24;
  const hueB = 304 + Math.cos(backgroundPhase * 0.8) * 26;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, `hsla(${hueA}, 72%, 7%, 0.28)`);
  gradient.addColorStop(0.58, "rgba(7, 11, 27, 0.24)");
  gradient.addColorStop(1, `hsla(${hueB}, 78%, 9%, 0.3)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = `hsl(${(hueA + hueB) * 0.5}, 92%, 60%)`;
  ctx.beginPath();
  ctx.arc(
    width * (0.5 + Math.sin(backgroundPhase * 0.7) * 0.05),
    height * (0.52 + Math.cos(backgroundPhase * 0.9) * 0.04),
    Math.min(width, height) * 0.36,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
}

function animate() {
  drawBackground();
  const emitter = handPointer || pointer;
  if (emitter.active || handPointer) {
    const amount = mode === "stars" ? 9 : mode === "water" ? 12 : 7;
    spawnBurst(emitter.x, emitter.y, amount, mode, 1 + (emitter.pressure || 0) * 0.7);
  }
  drawImageParticles();
  updateParticles();
  drawRipples();
  if (particles.length > 1300) particles.splice(0, particles.length - 1300);
  requestAnimationFrame(animate);
}

function setPointerFromEvent(event, active) {
  const point = event.touches ? event.touches[0] : event;
  pointer = {
    x: point.clientX,
    y: point.clientY,
    active,
    pressure: point.force || event.pressure || (active ? 0.8 : 0),
  };
}

canvas.addEventListener("pointerdown", (event) => {
  setPointerFromEvent(event, true);
  addRipple(pointer.x, pointer.y, 1.1);
});
canvas.addEventListener("pointermove", (event) => setPointerFromEvent(event, event.buttons > 0));
canvas.addEventListener("pointerup", (event) => setPointerFromEvent(event, false));
canvas.addEventListener("pointerleave", () => {
  pointer.active = false;
});

imageInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const image = new Image();
  image.onload = () => {
    loadedImage = image;
    buildImageParticles(image);
    statusText.textContent = "图片已转换为彩色粒子";
  };
  image.src = URL.createObjectURL(file);
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode, "手动"));
});

function countExtendedFingers(landmarks) {
  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18];
  let count = 0;
  tips.forEach((tip, index) => {
    if (landmarks[tip].y < landmarks[pips[index]].y) count += 1;
  });

  const thumbTip = landmarks[4];
  const thumbIp = landmarks[3];
  const wrist = landmarks[0];
  const handedness = landmarks[17].x < landmarks[5].x ? 1 : -1;
  if ((thumbTip.x - thumbIp.x) * handedness > 0.025 && Math.abs(thumbTip.x - wrist.x) > 0.08) {
    count += 1;
  }

  return Math.min(5, Math.max(0, count));
}

function palmPressure(landmarks) {
  const wrist = landmarks[0];
  const middleBase = landmarks[9];
  const palmSpan = Math.hypot(landmarks[5].x - landmarks[17].x, landmarks[5].y - landmarks[17].y);
  const palmHeight = Math.hypot(wrist.x - middleBase.x, wrist.y - middleBase.y);
  return Math.min(1, Math.max(0, (palmSpan + palmHeight - 0.22) * 4.2));
}

async function startCamera() {
  if (!window.Hands || !window.Camera) {
    statusText.textContent = "手势库未加载，仍可使用鼠标交互";
    return;
  }

  const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.68,
    minTrackingConfidence: 0.62,
  });

  hands.onResults((results) => {
    const landmarks = results.multiHandLandmarks?.[0];
    if (!landmarks) {
      handPointer = null;
      fingerLabel.textContent = "手指: -";
      return;
    }

    const index = landmarks[8];
    const center = landmarks[9];
    const count = countExtendedFingers(landmarks);
    const pressure = palmPressure(landmarks);
    const now = performance.now();
    handPointer = {
      x: (1 - index.x) * width,
      y: index.y * height,
      active: true,
      pressure,
    };

    if (count > 0) setMode(modeByFingerCount[count], "手势");
    fingerLabel.textContent = `手指: ${count}`;

    const palmX = (1 - center.x) * width;
    const palmY = center.y * height;
    if (pressure > 0.72 && now - lastRipple > 430) {
      addRipple(palmX, palmY, 1 + pressure);
      lastRipple = now;
      statusText.textContent = "检测到手掌按压: 彩色水波扩散";
    }
  });

  camera = new Camera(cameraFeed, {
    onFrame: async () => {
      await hands.send({ image: cameraFeed });
    },
    width: 640,
    height: 480,
  });

  await camera.start();
  cameraFeed.classList.add("ready");
  cameraButton.textContent = "手势已开启";
  statusText.textContent = "手指数量切换效果，掌心靠近触发涟漪";
}

cameraButton.addEventListener("click", () => {
  cameraButton.disabled = true;
  startCamera().catch((error) => {
    console.error(error);
    cameraButton.disabled = false;
    cameraButton.textContent = "开启手势";
    statusText.textContent = "摄像头不可用，可继续使用鼠标交互";
  });
});

resize();
setMode("smoke");
for (let i = 0; i < 180; i += 1) {
  spawnParticle(rand(width * 0.25, width * 0.75), rand(height * 0.42, height * 0.72), "stars", 0.55);
}
animate();
window.addEventListener("resize", resize);
