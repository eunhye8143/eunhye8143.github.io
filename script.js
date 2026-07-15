(() => {
  const nav = document.querySelector('.site-nav');
  const toggleButton = document.querySelector('.menu-toggle');
  const navLinks = nav ? Array.from(nav.querySelectorAll('a[href^="#"]')) : [];
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

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
})();
