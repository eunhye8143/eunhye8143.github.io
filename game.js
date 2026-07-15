(function (global) {
  const STORAGE_KEY = 'eunhye8143.snake.highScore';
  const CONFIG = {
    cols: 24,
    rows: 24,
    moveInterval: 120,
    enemyMoveInterval: 340,
    enemyCycleInterval: 5000,
    enemyExplosionDuration: 650,
    enemyRespawnDelay: 220,
  };

  function createRng(rng) {
    return typeof rng === 'function' ? rng : Math.random;
  }

  function keyOf(x, y) {
    return `${x}:${y}`;
  }

  function isOpposite(a, b) {
    return a.x + b.x === 0 && a.y + b.y === 0;
  }

  function cloneCell(cell) {
    return { x: cell.x, y: cell.y };
  }

  function buildSnake(cols, rows) {
    const x = Math.floor(cols / 2);
    const y = Math.floor(rows / 2);
    return [
      { x, y },
      { x: x - 1, y },
      { x: x - 2, y },
    ];
  }

  function getOccupiedSet(state) {
    const occupied = new Set(state.snake.map((segment) => keyOf(segment.x, segment.y)));
    occupied.add(keyOf(state.food.x, state.food.y));
    if (state.enemy && state.enemy.state === 'active') {
      occupied.add(keyOf(state.enemy.x, state.enemy.y));
    }
    return occupied;
  }

  function pickEmptyCell(state, rng) {
    const random = createRng(rng);
    const occupied = getOccupiedSet(state);
    const cells = [];

    for (let y = 0; y < state.rows; y += 1) {
      for (let x = 0; x < state.cols; x += 1) {
        const key = keyOf(x, y);
        if (!occupied.has(key)) {
          cells.push({ x, y });
        }
      }
    }

    if (!cells.length) {
      return { x: 0, y: 0 };
    }

    return cells[Math.floor(random() * cells.length)];
  }

  function createHighScoreReader(storage) {
    if (!storage) {
      return () => 0;
    }

    return () => {
      const raw = storage.getItem(STORAGE_KEY);
      const parsed = Number.parseInt(raw ?? '0', 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    };
  }

  function createHighScoreWriter(storage) {
    if (!storage) {
      return () => {};
    }

    return (value) => {
      try {
        storage.setItem(STORAGE_KEY, String(value));
      } catch (_) {
        // ignore storage failures
      }
    };
  }

  function createCore(options = {}) {
    const rng = createRng(options.rng);
    const readHighScore = createHighScoreReader(options.storage);
    const writeHighScore = createHighScoreWriter(options.storage);
    const state = {
      cols: options.cols ?? CONFIG.cols,
      rows: options.rows ?? CONFIG.rows,
      snake: [],
      direction: { x: 1, y: 0 },
      queuedDirection: { x: 1, y: 0 },
      food: { x: 0, y: 0 },
      enemy: { x: 0, y: 0, state: 'active', cycleStartedAt: 0, explodedUntil: 0, lastMoveAt: 0 },
      score: 0,
      highScore: readHighScore(),
      status: 'idle',
      message: '시작 버튼을 누르거나 스페이스를 눌러 게임을 시작하세요.',
      reason: '',
      lastMoveAt: 0,
      lastEnemyMoveAt: 0,
    };

    function placeFood() {
      state.food = pickEmptyCell(state, rng);
      return state.food;
    }

    function spawnEnemy(now) {
      const cell = pickEmptyCell(state, rng);
      state.enemy = {
        x: cell.x,
        y: cell.y,
        state: 'active',
        cycleStartedAt: now,
        explodedUntil: 0,
        lastMoveAt: now,
      };
    }

    function setHighScore(score) {
      if (score > state.highScore) {
        state.highScore = score;
        writeHighScore(score);
      }
    }

    function resetState(now = Date.now(), running = false) {
      state.snake = buildSnake(state.cols, state.rows);
      state.direction = { x: 1, y: 0 };
      state.queuedDirection = { x: 1, y: 0 };
      state.score = 0;
      state.status = running ? 'running' : 'idle';
      state.reason = '';
      state.lastMoveAt = now;
      state.lastEnemyMoveAt = now;
      state.message = running
        ? '게임이 시작되었습니다. 방향키 또는 WASD로 움직이세요.'
        : '시작 버튼을 누르거나 스페이스를 눌러 게임을 시작하세요.';
      placeFood();
      spawnEnemy(now);
      return state;
    }

    function gameOver(reason) {
      state.status = 'over';
      state.reason = reason;
      setHighScore(state.score);
      state.message = `게임 오버: ${reason}. 재시작 버튼을 눌러 다시 시작하세요.`;
    }

    function start(now = Date.now()) {
      if (state.status === 'running') return;
      if (state.status === 'paused') {
        state.status = 'running';
        state.message = '일시정지를 해제했습니다.';
        return;
      }

      resetState(now, true);
    }

    function pause() {
      if (state.status === 'running') {
        state.status = 'paused';
        state.message = '일시정지했습니다. 다시 누르면 계속합니다.';
      } else if (state.status === 'paused') {
        state.status = 'running';
        state.message = '게임을 다시 시작했습니다.';
      }
    }

    function restart(now = Date.now()) {
      resetState(now, true);
      state.message = '게임을 다시 시작했습니다.';
    }

    function setDirection(next) {
      if (!next) return;
      const current = state.direction;
      if (state.snake.length > 1 && isOpposite(current, next)) {
        return;
      }
      state.queuedDirection = next;
      if (state.status === 'idle') {
        start();
      }
    }

    function moveEnemy(now) {
      if (state.enemy.state !== 'active') return;

      const candidates = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ]
        .map((delta) => ({
          x: state.enemy.x + delta.x,
          y: state.enemy.y + delta.y,
        }))
        .filter((cell) =>
          cell.x >= 0 &&
          cell.x < state.cols &&
          cell.y >= 0 &&
          cell.y < state.rows &&
          !state.snake.some((segment) => segment.x === cell.x && segment.y === cell.y) &&
          !(state.food.x === cell.x && state.food.y === cell.y)
        );

      if (candidates.length) {
        const next = candidates[Math.floor(rng() * candidates.length)];
        state.enemy.x = next.x;
        state.enemy.y = next.y;
      }

      state.enemy.lastMoveAt = now;
    }

    function explodeEnemy(now) {
      state.enemy.state = 'exploding';
      state.enemy.explodedUntil = now + CONFIG.enemyExplosionDuration;
      state.message = '적이 폭발했습니다. 잠시 뒤 다시 나타납니다.';
    }

    function respawnEnemy(now) {
      const cell = pickEmptyCell(state, rng);
      state.enemy = {
        x: cell.x,
        y: cell.y,
        state: 'active',
        cycleStartedAt: now,
        explodedUntil: 0,
        lastMoveAt: now,
      };
      state.message = '적이 다시 생성되었습니다.';
    }

    function stepSnake() {
      const nextHead = {
        x: state.snake[0].x + state.direction.x,
        y: state.snake[0].y + state.direction.y,
      };

      const wallHit = nextHead.x < 0 || nextHead.x >= state.cols || nextHead.y < 0 || nextHead.y >= state.rows;
      if (wallHit) {
        gameOver('벽에 충돌했습니다');
        return;
      }

      const bodyHit = state.snake.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y);
      if (bodyHit) {
        gameOver('자기 몸에 충돌했습니다');
        return;
      }

      const enemyHit = state.enemy.state === 'active' && state.enemy.x === nextHead.x && state.enemy.y === nextHead.y;
      if (enemyHit) {
        gameOver('적과 충돌했습니다');
        return;
      }

      state.snake.unshift(nextHead);

      const ateFood = state.food.x === nextHead.x && state.food.y === nextHead.y;
      if (ateFood) {
        state.score += 10;
        setHighScore(state.score);
        placeFood();
        state.message = '먹이를 먹었습니다.';
      } else {
        state.snake.pop();
      }

      state.direction = { ...state.queuedDirection };
    }

    function tick(now = Date.now()) {
      if (state.status !== 'running') {
        return state;
      }

      if (state.enemy.state === 'active' && now - state.enemy.cycleStartedAt >= CONFIG.enemyCycleInterval) {
        explodeEnemy(now);
      } else if (state.enemy.state === 'exploding' && now >= state.enemy.explodedUntil) {
        respawnEnemy(now);
      }

      if (now - state.lastEnemyMoveAt >= CONFIG.enemyMoveInterval && state.enemy.state === 'active') {
        moveEnemy(now);
      }

      if (now - state.lastMoveAt >= CONFIG.moveInterval) {
        state.lastMoveAt = now;
        stepSnake();
      }

      return state;
    }

    function snapshot() {
      return {
        cols: state.cols,
        rows: state.rows,
        snake: state.snake.map(cloneCell),
        food: cloneCell(state.food),
        enemy: { ...state.enemy },
        score: state.score,
        highScore: state.highScore,
        status: state.status,
        message: state.message,
        reason: state.reason,
      };
    }

    resetState(Date.now(), false);

    return {
      state,
      start,
      pause,
      restart,
      setDirection,
      tick,
      snapshot,
      resetState,
      placeFood,
      spawnEnemy,
    };
  }

  function initSnakeGame(root = document) {
    const host = root.querySelector('[data-snake-app]');
    if (!host) return null;

    const board = host.querySelector('[data-board]');
    const scoreEl = host.querySelector('[data-score]');
    const bestScoreEl = host.querySelector('[data-best-score]');
    const statusEl = host.querySelector('[data-status]');
    const messageEl = host.querySelector('[data-message]');
    const buttons = Array.from(host.querySelectorAll('[data-action]'));
    const directionButtons = Array.from(host.querySelectorAll('[data-direction]'));
    const storage = typeof window !== 'undefined' ? window.localStorage : null;

    const core = createCore({ storage });
    const cellMap = [];
    let timerId = null;
    let isActive = false;

    function buildBoard() {
      if (!board) return;
      board.style.setProperty('--game-cols', String(core.state.cols));
      board.style.setProperty('--game-rows', String(core.state.rows));
      board.innerHTML = '';

      for (let index = 0; index < core.state.cols * core.state.rows; index += 1) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        board.appendChild(cell);
        cellMap.push(cell);
      }
    }

    function ensureTimer() {
      if (isActive && core.state.status === 'running' && timerId === null) {
        timerId = window.setInterval(() => {
          core.tick(Date.now());
          render();
          syncTimer();
        }, 100);
      } else if ((!isActive || core.state.status !== 'running') && timerId !== null) {
        window.clearInterval(timerId);
        timerId = null;
      }
    }

    function render() {
      if (!board) return;

      cellMap.forEach((cell) => {
        cell.className = 'cell';
      });

      const { snake, food, enemy } = core.state;
      snake.forEach((segment, index) => {
        const target = cellMap[segment.y * core.state.cols + segment.x];
        if (target) {
          target.classList.add(index === 0 ? 'snake-head' : 'snake-body');
        }
      });

      const foodCell = cellMap[food.y * core.state.cols + food.x];
      if (foodCell) {
        foodCell.classList.add('food');
      }

      if (enemy && enemy.state) {
        const enemyCell = cellMap[enemy.y * core.state.cols + enemy.x];
        if (enemyCell) {
          enemyCell.classList.add(enemy.state === 'exploding' ? 'enemy-exploding' : 'enemy');
        }
      }

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

    function syncTimer() {
      ensureTimer();
    }

    function begin() {
      core.start(Date.now());
      render();
      syncTimer();
    }

    function pause() {
      core.pause();
      render();
      syncTimer();
    }

    function restart() {
      core.restart(Date.now());
      render();
      syncTimer();
    }

    function applyDirection(direction) {
      if (!isActive) return;
      if (core.state.status === 'idle') {
        core.start(Date.now());
      }
      core.setDirection(direction);
      render();
      syncTimer();
    }

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.getAttribute('data-action');
        if (action === 'start') begin();
        if (action === 'pause') pause();
        if (action === 'restart') restart();
      });
    });

    directionButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const direction = button.getAttribute('data-direction');
        const map = {
          up: { x: 0, y: -1 },
          down: { x: 0, y: 1 },
          left: { x: -1, y: 0 },
          right: { x: 1, y: 0 },
        };
        if (map[direction]) {
          applyDirection(map[direction]);
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
        applyDirection(map[key]);
      }
    });

    buildBoard();
    render();

    const api = {
      core,
      render,
      begin,
      pause,
      restart,
      setActive(nextActive) {
        isActive = Boolean(nextActive);
        render();
        syncTimer();
      },
      stop() {
        if (timerId !== null) {
          window.clearInterval(timerId);
          timerId = null;
        }
      },
    };

    if (global.GameHub && typeof global.GameHub.registerGame === 'function') {
      global.GameHub.registerGame('snake', api);
    }

    return api;
  }

  global.SnakeGame = {
    createCore,
    initSnakeGame,
  };

  if (typeof document !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
      initSnakeGame(document);
    });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      createCore,
      initSnakeGame,
      CONFIG,
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
