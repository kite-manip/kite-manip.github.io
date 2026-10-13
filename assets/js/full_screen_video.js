// Hero carousel: one slide per task (real-world rollout with its source demonstration
// burned in as a PiP). Each clip plays once at 1x; when it ends the carousel slides left
// to the next task and wraps around. Swipe/drag, horizontal trackpad scroll, arrow keys,
// and the progress steps also switch tasks.
(() => {
  const hero = document.getElementById('hero');
  if (!hero) return;
  const track = hero.querySelector('.hero-track');
  const slides = [...hero.querySelectorAll('.hero-slide')];
  const videos = slides.map(slide => slide.querySelector('video'));
  const steps = [...hero.querySelectorAll('.hero-step')];
  const [videoW, videoH] = hero.dataset.videoSize.split(',').map(Number);
  const [pipX, pipY, pipW, pipH] = hero.dataset.pip.split(',').map(Number);
  const stacked = window.matchMedia('(max-width: 720px), (max-aspect-ratio: 6/5)');
  const count = slides.length;
  const wrap = i => (i % count + count) % count;
  const slideMs = () => parseFloat(getComputedStyle(hero).getPropertyValue('--slide-ms')) || 800;

  let index = 0;
  let inView = true;
  let finishTransition = null;
  let fallbackTimer = 0;
  let drag = null;

  // Place the labels relative to the PiP under object-fit: cover.
  function layout() {
    if (stacked.matches) return;
    const width = hero.clientWidth;
    const height = hero.clientHeight;
    const scale = Math.max(width / videoW, height / videoH);
    const [posX, posY] = getComputedStyle(videos[0]).objectPosition.split(' ').map(v => parseFloat(v) / 100);
    const offsetX = (width - videoW * scale) * posX;
    const offsetY = (height - videoH * scale) * posY;
    hero.style.setProperty('--pip-x', `${offsetX + pipX * scale}px`);
    hero.style.setProperty('--pip-y', `${offsetY + pipY * scale}px`);
    hero.style.setProperty('--pip-w', `${pipW * scale}px`);
    hero.style.setProperty('--pip-h', `${pipH * scale}px`);
    hero.style.setProperty('--u', Math.max(scale, 0.6).toFixed(4));
  }

  function prepare(i) {
    const video = videos[i];
    if (!video.getAttribute('src')) {
      const hd = !stacked.matches && hero.clientWidth * (window.devicePixelRatio || 1) > 1500;
      video.preload = 'auto';
      const version = hero.dataset.version ? `?v=${hero.dataset.version}` : '';
      video.src = `${slides[i].dataset.src}${hd ? '' : '_720'}.mp4${version}`;
    }
    return video;
  }

  function playActive() {
    clearTimeout(fallbackTimer);
    const video = prepare(index);
    if (!inView) {
      video.pause();
      return;
    }
    video.play().catch(error => {
      // Autoplay blocked (e.g. power saving): keep cycling through the posters.
      if (error.name === 'NotAllowedError') fallbackTimer = setTimeout(() => go(index + 1, 1), 8000);
    });
    prepare(wrap(index + 1));
  }

  function setActive(i) {
    index = i;
    slides.forEach((slide, k) => slide.setAttribute('aria-hidden', String(k !== i)));
    steps.forEach((step, k) => {
      step.style.setProperty('--p', 0);
      if (k === i) step.setAttribute('aria-current', 'true');
      else step.removeAttribute('aria-current');
    });
    playActive();
  }

  const place = (slide, percent, px = 0) => {
    slide.style.transform = `translate3d(calc(${percent}% + ${px}px), 0, 0)`;
  };

  // dir = 1 slides the content left (next task), -1 slides it right (previous task).
  function go(target, dir, offsetPx = 0) {
    if (finishTransition) finishTransition();
    target = wrap(target);
    if (target === index) return;
    const from = slides[index];
    const to = slides[target];
    const video = prepare(target);
    if (video.readyState > 0) video.currentTime = 0;

    from.classList.remove('is-moving');
    to.classList.remove('is-moving');
    to.classList.add('is-peek');
    place(from, 0, offsetPx);
    place(to, dir * 100, offsetPx);
    to.getBoundingClientRect(); // commit the start positions before animating
    from.classList.add('is-moving');
    to.classList.add('is-moving');
    place(from, -dir * 100);
    place(to, 0);
    setActive(target);

    const oldVideo = videos[slides.indexOf(from)];
    const timer = setTimeout(() => finishTransition && finishTransition(), slideMs() + 50);
    finishTransition = () => {
      clearTimeout(timer);
      finishTransition = null;
      from.classList.remove('is-active', 'is-peek', 'is-moving');
      to.classList.remove('is-peek', 'is-moving');
      to.classList.add('is-active');
      from.style.transform = '';
      to.style.transform = '';
      oldVideo.pause();
      if (oldVideo.readyState > 0) oldVideo.currentTime = 0;
    };
  }

  function snapBack(peekIndex, dir) {
    const current = slides[index];
    const peek = slides[peekIndex];
    current.classList.add('is-moving');
    peek.classList.add('is-moving');
    place(current, 0);
    place(peek, dir * 100);
    setTimeout(() => {
      current.classList.remove('is-moving');
      current.style.transform = '';
      if (peekIndex !== index) {
        peek.classList.remove('is-peek', 'is-moving');
        peek.style.transform = '';
      }
      if (videos[index].ended) go(index + 1, 1);
    }, slideMs() + 50);
  }

  // Swipe / drag. Vertical movement is left to the page (touch-action: pan-y).
  track.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (finishTransition) finishTransition();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, vx: 0,
      lastX: event.clientX, lastT: performance.now(), active: false, dir: 0, peek: -1 };
  });

  track.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.active) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        drag = null;
        return;
      }
      if (Math.abs(dx) < 8) return;
      drag.active = true;
      track.setPointerCapture(event.pointerId);
      track.classList.add('is-dragging');
    }
    const now = performance.now();
    drag.vx = (event.clientX - drag.lastX) / Math.max(1, now - drag.lastT);
    drag.lastX = event.clientX;
    drag.lastT = now;
    drag.dx = dx;
    const dir = dx < 0 ? 1 : -1;
    if (dir !== drag.dir) {
      if (drag.peek >= 0) {
        slides[drag.peek].classList.remove('is-peek');
        slides[drag.peek].style.transform = '';
      }
      drag.dir = dir;
      drag.peek = wrap(index + dir);
      prepare(drag.peek);
      slides[drag.peek].classList.add('is-peek');
    }
    place(slides[index], 0, dx);
    place(slides[drag.peek], dir * 100, dx);
  });

  const release = event => {
    if (!drag || event.pointerId !== drag.id) return;
    const { active, dx, vx, dir, peek } = drag;
    drag = null;
    track.classList.remove('is-dragging');
    if (!active) return;
    const flick = Math.abs(vx) > 0.4 && Math.sign(vx) === Math.sign(dx);
    if (event.type === 'pointerup' && (Math.abs(dx) > track.clientWidth * 0.18 || flick)) go(peek, dir, dx);
    else snapBack(peek, dir);
  };
  track.addEventListener('pointerup', release);
  track.addEventListener('pointercancel', release);

  // Two-finger horizontal trackpad swipe: one task per gesture.
  let wheelTotal = 0;
  let wheelLocked = false;
  let wheelIdle = 0;
  hero.addEventListener('wheel', event => {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    event.preventDefault();
    clearTimeout(wheelIdle);
    wheelIdle = setTimeout(() => {
      wheelTotal = 0;
      wheelLocked = false;
    }, 200);
    if (wheelLocked) return;
    wheelTotal += event.deltaX;
    if (Math.abs(wheelTotal) > 50) {
      wheelLocked = true;
      const dir = Math.sign(wheelTotal);
      go(index + dir, dir);
    }
  }, { passive: false });

  track.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight') go(index + 1, 1);
    else if (event.key === 'ArrowLeft') go(index - 1, -1);
    else return;
    event.preventDefault();
  });

  hero.querySelector('.hero-next').addEventListener('click', () => go(index + 1, 1));

  steps.forEach((step, i) => step.addEventListener('click', () => {
    const ahead = wrap(i - index);
    if (ahead) go(i, ahead <= count / 2 ? 1 : -1);
  }));

  videos.forEach((video, i) => video.addEventListener('ended', () => {
    if (i === index && !drag) go(index + 1, 1);
  }));

  const progress = () => {
    const video = videos[index];
    if (inView && video.duration) steps[index].style.setProperty('--p', Math.min(1, video.currentTime / video.duration));
    requestAnimationFrame(progress);
  };

  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView) playActive();
    else {
      clearTimeout(fallbackTimer);
      videos[index].pause();
    }
  }, { threshold: 0.15 }).observe(hero);

  window.addEventListener('resize', layout);
  stacked.addEventListener('change', layout);
  layout();
  slides[0].classList.add('is-active');
  setActive(0);
  requestAnimationFrame(progress);
})();

// Smooth scroll to content
function scrollToContent() {
  const content = document.querySelector('.main-content');
  if (content) {
    content.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }
}
