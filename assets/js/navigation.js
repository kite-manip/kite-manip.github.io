document.addEventListener('DOMContentLoaded', () => {
  const link = document.querySelector('a[href="#video-summary"]');
  const target = document.getElementById('video-summary');
  if (!link || !target) return;

  let cancelNavigation = () => {};
  link.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    cancelNavigation();

    const start = window.scrollY;
    const destination = Math.max(0, Math.min(
      start + target.getBoundingClientRect().top - 28,
      document.documentElement.scrollHeight - window.innerHeight
    ));
    const distance = destination - start;
    const duration = Math.min(2000, Math.max(900, Math.abs(distance) * 0.14));
    let frame;
    let started;

    const notify = () => document.dispatchEvent(new Event('section-navigation-change'));
    const finish = (arrived = false) => {
      cancelAnimationFrame(frame);
      document.documentElement.classList.remove('section-navigation-active');
      window.removeEventListener('wheel', cancel);
      window.removeEventListener('touchstart', cancel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', cancel);
      cancelNavigation = () => {};
      notify();
      if (arrived) {
        if (location.hash !== '#video-summary') history.pushState(null, '', '#video-summary');
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    };
    const cancel = () => finish();
    const onKey = event => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Escape', 'Tab'].includes(event.key)) cancel();
    };
    cancelNavigation = cancel;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.scrollTo(0, destination);
      finish(true);
      return;
    }

    document.documentElement.classList.add('section-navigation-active');
    notify();
    window.addEventListener('wheel', cancel, { passive: true });
    window.addEventListener('touchstart', cancel, { passive: true });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', cancel);
    const step = time => {
      if (started === undefined) started = time;
      const progress = Math.min(1, (time - started) / duration);
      // Gentle acceleration and deceleration, including the long page jump.
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      window.scrollTo(0, start + distance * eased);
      if (progress < 1) frame = requestAnimationFrame(step);
      else finish(true);
    };
    frame = requestAnimationFrame(step);
  });
});
