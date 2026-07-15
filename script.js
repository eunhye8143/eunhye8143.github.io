(function () {
  const nav = document.querySelector('.site-nav');
  const toggleButton = document.querySelector('.menu-toggle');
  const navLinks = nav ? Array.from(nav.querySelectorAll('a[href^="#"]')) : [];
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  const gameSwitcherButtons = Array.from(document.querySelectorAll('[data-game-switch]'));
  const gamePanels = Array.from(document.querySelectorAll('[data-game-app]'));

  const gameHub = (window.GameHub = window.GameHub || {
    activeGame: 'snake',
    games: new Map(),
    registerGame(name, api) {
      this.games.set(name, api);
      if (!this.activeGame) {
        this.activeGame = name;
      }
      this.sync();
    },
    setActive(name) {
      if (!name || this.activeGame === name) {
        this.activeGame = name || this.activeGame;
        this.sync();
        return;
      }

      this.activeGame = name;
      this.sync();
    },
    sync() {
      gamePanels.forEach((panel) => {
        panel.hidden = panel.dataset.gameApp !== this.activeGame;
      });

      gameSwitcherButtons.forEach((button) => {
        const isActive = button.dataset.gameSwitch === this.activeGame;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
      });

      this.games.forEach((api, name) => {
        if (api && typeof api.setActive === 'function') {
          api.setActive(name === this.activeGame);
        }
      });
    },
  });

  function setNavOpen(isOpen) {
    if (!nav || !toggleButton) return;
    nav.classList.toggle('is-open', isOpen);
    toggleButton.setAttribute('aria-expanded', String(isOpen));
  }

  if (toggleButton && nav) {
    toggleButton.addEventListener('click', () => {
      setNavOpen(!nav.classList.contains('is-open'));
    });

    navLinks.forEach((link) => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          setNavOpen(false);
        }
      });
    });
  }

  gameSwitcherButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const name = button.dataset.gameSwitch;
      if (name) {
        gameHub.setActive(name);
      }
    });
  });

  if ('IntersectionObserver' in window && sections.length && navLinks.length) {
    const linkById = new Map(navLinks.map((link) => [link.getAttribute('href').slice(1), link]));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visible) return;

        navLinks.forEach((link) => link.classList.remove('is-active'));
        const activeLink = linkById.get(visible.target.id);
        if (activeLink) {
          activeLink.classList.add('is-active');
        }
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: [0.1, 0.35, 0.6] }
    );

    sections.forEach((section) => observer.observe(section));
  }

  gameHub.sync();
})();
