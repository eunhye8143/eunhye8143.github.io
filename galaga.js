(function (global) {
  const STORAGE_KEY = 'eunhye8143.galaga.highScore';
  const CONFIG = {
    width: 480,
    height: 640,
    playerWidth: 42,
    playerHeight: 30,
    playerStep: 42,
    spawnEvery: 820,
    minObstacleSpeed: 150,
    maxObstacleSpeed: 280,
    maxObstacles: 10,
    backgroundStars: 42,
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function createRandom(rng) {
    return typeof rng === 'function' ? rng : Math.random;
  }

  function createHighScoreReader(storage) {
    if (!storage) return () => 0;
    return () => {
      const raw = storage.getItem(STORAGE_KEY);
      const parsed = Number.parseInt(raw ?? '0', 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    };
  }

  function createHighScoreWriter(storage) {
    if (!storage) return () => {};
    return (value) => {
      try {
        storage.setItem(STORAGE_KEY, String(value));
      } catch (_) {
        // ignore storage failures
      }
    };
  }

  function createCore(options = {}) {
    const rng = createRandom(options.rng);
    const readHighScore = createHighScoreReader(options.storage);
    const writeHighScore = createHighScoreWriter(options.storage);
    const state = {
      width: CONFIG.width,
      height: CONFIG.height,
      score: 0,
      highScore: readHighScore(),
      status: 'idle',
      message: '시작 버튼을 누르거나 스페이스를 눌러 게임을 시작하세요.',
      reason: '',
      active: false,
      lastFrameAt: 0,
      spawnAccumulator: 0,
      obstacles: [],
      stars: [],
      player: {
        x: CONFIG.width / 2 - CONFIG.playerWidth / 2,
        y: CONFIG.height - 70,
        width: CONFIG.playerWidth,
        height: CONFIG.playerHeight,
      },
    };

    for (let index = 0; index < CONFIG.backgroundStars; index += 1) {
      state.stars.push({
        x: rng() * CONFIG.width,
        y: rng() * CONFIG.height,
        size: 1 + rng() * 2.5,
        speed: 18 + rng() * 38,
      });
    }

    function setHighScore(score) {
      if (score > state.highScore) {
        state.highScore = score;
        writeHighScore(score);
      }
    }

    function reset(now = Date.now(), keepStatus = false) {
      state.score = 0;
      state.spawnAccumulator = 0;
      state.obstacles = [];
      state.player.x = CONFIG.width / 2 - CONFIG.playerWidth / 2;
      state.player.y = CONFIG.height - 70;
      state.lastFrameAt = now;
      if (!keepStatus) {
        state.status = 'idle';
      }
      state.message = keepStatus && state.status === 'running'
        ? '게임이 시작되었습니다. 상하좌우로 이동하며 장애물을 피하세요.'
        : '시작 버튼을 누르거나 스페이스를 눌러 게임을 시작하세요.';
      state.reason = '';
    }

    function start(now = Date.now()) {
      if (state.status === 'running') return;
      if (state.status === 'paused') {
        state.status = 'running';
        state.message = '게임을 다시 시작했습니다.';
        state.lastFrameAt = now;
        return;
      }

      reset(now);
      state.status = 'running';
      state.message = '게임이 시작되었습니다. 상하좌우로 이동하며 장애물을 피하세요.';
    }

    function pause() {
      if (state.status === 'running') {
        state.status = 'paused';
        state.message = '일시정지 상태입니다. 다시 누르면 이어서 진행됩니다.';
      } else if (state.status === 'paused') {
        state.status = 'running';
        state.message = '게임을 다시 시작했습니다.';
      }
    }

    function restart(now = Date.now()) {
      reset(now);
      state.status = 'running';
      state.message = '게임을 다시 시작했습니다.';
    }

    function gameOver(reason) {
      state.status = 'over';
      state.reason = reason;
      setHighScore(state.score);
      state.message = `게임 오버: ${reason}. 재시작 버튼을 눌러 다시 도전하세요.`;
    }

    function movePlayer(dx, dy) {
      state.player.x = clamp(state.player.x + dx * CONFIG.playerStep, 0, CONFIG.width - state.player.width);
      state.player.y = clamp(state.player.y + dy * CONFIG.playerStep, 20, CONFIG.height - state.player.height - 14);
      if (state.status === 'idle') {
        start();
      }
    }

    function spawnObstacle() {
      const width = 20 + Math.floor(rng() * 34);
      const height = 18 + Math.floor(rng() * 24);
      const x = Math.floor(rng() * Math.max(1, CONFIG.width - width));
      const speed = CONFIG.minObstacleSpeed + rng() * (CONFIG.maxObstacleSpeed - CONFIG.minObstacleSpeed);
      state.obstacles.push({
        x,
        y: -height - 8,
        width,
        height,
        speed,
        wobble: (rng() - 0.5) * 24,
        phase: rng() * Math.PI * 2,
      });
    }

    function rectsOverlap(a, b) {
      return !(
        a.x + a.width < b.x ||
        a.x > b.x + b.width ||
        a.y + a.height < b.y ||
        a.y > b.y + b.height
      );
    }

    function step(dt) {
      if (state.status !== 'running') {
        return state;
      }

      state.spawnAccumulator += dt;
      while (state.spawnAccumulator >= CONFIG.spawnEvery) {
        state.spawnAccumulator -= CONFIG.spawnEvery;
        if (state.obstacles.length < CONFIG.maxObstacles) {
          spawnObstacle();
        }
      }

      state.stars.forEach((star) => {
        star.y += star.speed * (dt / 1000);
        if (star.y > CONFIG.height) {
          star.y = -2;
          star.x = rng() * CONFIG.width;
        }
      });

      const nextObstacles = [];

      for (const obstacle of state.obstacles) {
        obstacle.y += obstacle.speed * (dt / 1000);
        obstacle.x += Math.sin((obstacle.y / 42) + obstacle.phase) * (dt / 1000) * 10;
        obstacle.x = clamp(obstacle.x, 0, CONFIG.width - obstacle.width);

        const playerBox = {
          x: state.player.x,
          y: state.player.y,
          width: state.player.width,
          height: state.player.height,
        };
        const obstacleBox = {
          x: obstacle.x,
          y: obstacle.y,
          width: obstacle.width,
          height: obstacle.height,
        };

        if (rectsOverlap(playerBox, obstacleBox)) {
          gameOver('장애물에 충돌했습니다');
          break;
        }

        if (obstacle.y > CONFIG.height + obstacle.height) {
          state.score += 10;
          setHighScore(state.score);
          continue;
        }

        nextObstacles.push(obstacle);
      }

      state.obstacles = nextObstacles;

      return state;
    }

    function snapshot() {
      return {
        width: state.width,
        height: state.height,
        score: state.score,
        highScore: state.highScore,
        status: state.status,
        message: state.message,
        reason: state.reason,
        active: state.active,
        player: { ...state.player },
        obstacles: state.obstacles.map((obstacle) => ({ ...obstacle })),
      };
    }

    reset(Date.now());

    return {
      state,
      start,
      pause,
      restart,
      movePlayer,
      step,
      snapshot,
      setActive(active) {
        state.active = Boolean(active);
      },
    };
  }

  function drawShip(ctx, player) {
    const { x, y, width, height } = player;
    ctx.save();
    ctx.translate(x + width / 2, y + height / 2);

    ctx.fillStyle = '#7ef0be';
    ctx.beginPath();
    ctx.moveTo(0, -height / 2);
    ctx.lineTo(width / 2, height / 2);
    ctx.lineTo(0, height / 4);
    ctx.lineTo(-width / 2, height / 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#e8fbff';
    ctx.beginPath();
    ctx.moveTo(0, -height / 3);
    ctx.lineTo(width / 4, height / 4);
    ctx.lineTo(0, height / 5);
    ctx.lineTo(-width / 4, height / 4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawObstacle(ctx, obstacle) {
    const { x, y, width, height } = obstacle;
    const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
    gradient.addColorStop(0, '#ff6b6b');
    gradient.addColorStop(1, '#ffd166');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);

    ctx.strokeStyle = 'rgba(255,255,255,0.34)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
  }

  function drawGame(ctx, core) {
    const { width, height, stars, obstacles, player, score, highScore, status, message } = core.state;

    ctx.clearRect(0, 0, width, height);

    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#0b1523');
    sky.addColorStop(1, '#060b12');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(107, 188, 255, 0.25)';
    ctx.fillRect(0, 0, width, 3);

    stars.forEach((star) => {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    });

    obstacles.forEach((obstacle) => drawObstacle(ctx, obstacle));
    drawShip(ctx, player);

    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = '600 18px Inter, Noto Sans KR, sans-serif';
    ctx.fillText(`Score ${score}`, 18, 30);
    ctx.fillText(`Best ${highScore}`, 18, 54);

    if (status !== 'running') {
      ctx.fillStyle = 'rgba(5, 10, 18, 0.55)';
      ctx.fillRect(0, height / 2 - 52, width, 104);
      ctx.fillStyle = '#ebf4fb';
      ctx.font = '700 22px Inter, Noto Sans KR, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(message, width / 2, height / 2 - 8);
      ctx.font = '500 15px Inter, Noto Sans KR, sans-serif';
      ctx.fillStyle = '#91a5b5';
      ctx.fillText(status === 'over' ? '재시작 버튼으로 다시 시작하세요.' : '일시정지 또는 시작 버튼을 사용하세요.', width / 2, height / 2 + 22);
      ctx.textAlign = 'start';
    }
  }

  function initGalagaGame(root = document) {
    const host = root.querySelector('[data-game-app="galaga"]');
    if (!host) return null;

    const canvas = host.querySelector('[data-galaga-canvas]');
    const ctx = canvas ? canvas.getContext('2d') : null;
    const scoreEl = host.querySelector('[data-galaga-score]');
    const bestScoreEl = host.querySelector('[data-galaga-best-score]');
    const statusEl = host.querySelector('[data-galaga-status]');
    const messageEl = host.querySelector('[data-galaga-message]');
    const buttons = Array.from(host.querySelectorAll('[data-galaga-action]'));
    const directionButtons = Array.from(host.querySelectorAll('[data-galaga-direction]'));
    const storage = typeof window !== 'undefined' ? window.localStorage : null;

    const core = createCore({ storage });
    let rafId = null;
    let lastFrameAt = 0;
    let isActive = false;

    function syncHud() {
      if (scoreEl) scoreEl.textContent = String(core.state.score);
      if (bestScoreEl) bestScoreEl.textContent = String(core.state.highScore);
      if (statusEl) {
        const label = {
          idle: '대기 중',
          running: '진행 중',
          paused: '일시정지',
          over: '게임 오버',
        }[core.state.status] ?? core.state.status;
        statusEl.textContent = label;
      }
      if (messageEl) messageEl.textContent = core.state.message;
    }

    function render() {
      if (!ctx) return;
      drawGame(ctx, core);
      syncHud();
    }

    function stopLoop() {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    function loop(now) {
      if (!isActive || core.state.status !== 'running') {
        rafId = null;
        render();
        return;
      }

      const elapsed = lastFrameAt ? now - lastFrameAt : 16;
      lastFrameAt = now;
      core.step(elapsed);
      render();

      if (core.state.status === 'running') {
        rafId = window.requestAnimationFrame(loop);
      } else {
        rafId = null;
      }
    }

    function startLoop() {
      if (!isActive || core.state.status !== 'running' || rafId !== null) {
        return;
      }
      lastFrameAt = performance.now();
      rafId = window.requestAnimationFrame(loop);
    }

    function ensureLoop() {
      stopLoop();
      if (isActive && core.state.status === 'running') {
        startLoop();
      }
      render();
    }

    function begin() {
      core.start(Date.now());
      ensureLoop();
    }

    function pause() {
      core.pause();
      ensureLoop();
    }

    function restart() {
      core.restart(Date.now());
      ensureLoop();
    }

    function move(direction) {
      if (!isActive) return;
      if (core.state.status === 'idle') {
        core.start(Date.now());
      }
      core.movePlayer(direction.x, direction.y);
      ensureLoop();
    }

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.getAttribute('data-galaga-action');
        if (action === 'start') begin();
        if (action === 'pause') pause();
        if (action === 'restart') restart();
      });
    });

    directionButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const direction = button.getAttribute('data-galaga-direction');
        const map = {
          up: { x: 0, y: -1 },
          down: { x: 0, y: 1 },
          left: { x: -1, y: 0 },
          right: { x: 1, y: 0 },
        };
        if (map[direction]) {
          move(map[direction]);
        }
      });
    });

    window.addEventListener('keydown', (event) => {
      if (!isActive) return;

      const key = event.key.toLowerCase();
      const map = {
        arrowup: { x: 0, y: -1 },
        w: { x: 0, y: -1 },
        arrowdown: { x: 0, y: 1 },
        s: { x: 0, y: 1 },
        arrowleft: { x: -1, y: 0 },
        a: { x: -1, y: 0 },
        arrowright: { x: 1, y: 0 },
        d: { x: 1, y: 0 },
      };

      if (key === ' ' || key === 'spacebar') {
        event.preventDefault();
        if (core.state.status === 'running') {
          pause();
        } else if (core.state.status === 'paused') {
          pause();
        } else {
          begin();
        }
        return;
      }

      if (map[key]) {
        event.preventDefault();
        move(map[key]);
      }
    });

    const api = {
      core,
      render,
      begin,
      pause,
      restart,
      setActive(nextActive) {
        isActive = Boolean(nextActive);
        core.setActive(isActive);
        if (!isActive) {
          stopLoop();
        } else if (core.state.status === 'running') {
          ensureLoop();
        } else {
          render();
        }
      },
      stop() {
        stopLoop();
      },
    };

    render();

    if (global.GameHub && typeof global.GameHub.registerGame === 'function') {
      global.GameHub.registerGame('galaga', api);
    }

    return api;
  }

  global.GalagaGame = {
    createCore,
    initGalagaGame,
  };

  if (typeof document !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
      initGalagaGame(document);
    });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      createCore,
      initGalagaGame,
      CONFIG,
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
