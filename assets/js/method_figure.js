// Interactive method figure: a real-world photo card beside the inference loop, wires between nodes,
// a live signal that runs one inference step along them, a first-use hint for each node until
// that node is activated, training panels that open from the
// kinematic decoder (upward) and the interaction policy (downward), linked highlighting between text
// terms, photo overlays and figure elements, and hover tooltips.
document.addEventListener('DOMContentLoaded', () => {
  const figure = document.getElementById('kite-method');
  if (!figure) return;
  const section = figure.closest('.method-section') || figure.parentElement;
  const strip = figure.querySelector('.km-strip');
  const real = strip.querySelector('.km-real');
  const hints = [...strip.querySelectorAll('.km-hint')];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const touchish = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  strip.classList.add('km-anim');

  /* ---------------- Wires ---------------- */
  // Edge spec: "from:side>to:side[@x][~route][|color][^drawDelay]"; sides l/r/t/b,
  // routes merge (join near the target), loop / under / left (dashed feedback), lead (a dotted
  // leader line from a module into the photo, ending in a ring), colors n/g/b. Edges with a draw
  // delay draw in on entrance; all but the dashed feedback also carry the live signal.
  const EDGE = /^(\w+):([lrtb])>(\w+):([lrtb])(@x)?(?:~(\w+))?(?:\|([ngb]))?(?:\^([\d.]+))?$/;
  const parseEdges = spec => (spec || '').split(';').map(s => s.trim()).filter(Boolean).map(raw => {
    const m = raw.match(EDGE);
    if (!m) return null;
    return { from: m[1], fs: m[2], to: m[3], ts: m[4], alignX: !!m[5], route: m[6] || '', color: m[7] || 'n', pulse: m[8] };
  }).filter(Boolean);

  // Layout box relative to an offset ancestor; ignores transforms so panel animations don't skew wires.
  // Photo anchors live inside an SVG that fills its box with preserveAspectRatio="xMidYMid slice",
  // so they map from viewBox units through that same cover fit.
  const boxIn = (el, container) => {
    if (el instanceof SVGGraphicsElement && el.ownerSVGElement) {
      const svg = el.ownerSVGElement;
      const host = boxIn(svg.parentElement, container);
      const vb = svg.viewBox.baseVal;
      const k = Math.max(host.w / vb.width, host.h / vb.height);
      const ox = host.x + (host.w - vb.width * k) / 2 - vb.x * k;
      const oy = host.y + (host.h - vb.height * k) / 2 - vb.y * k;
      const b = el.getBBox();
      return { x: ox + b.x * k, y: oy + b.y * k, w: b.width * k, h: b.height * k };
    }
    let x = 0;
    let y = 0;
    for (let node = el; node && node !== container; node = node.offsetParent) {
      x += node.offsetLeft;
      y += node.offsetTop;
    }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  };
  const anchor = (b, side) => ({
    l: { x: b.x, y: b.y + b.h / 2 },
    r: { x: b.x + b.w, y: b.y + b.h / 2 },
    t: { x: b.x + b.w / 2, y: b.y },
    b: { x: b.x + b.w / 2, y: b.y + b.h },
  })[side];
  const horizontal = side => side === 'l' || side === 'r';
  const isLoop = e => e.route === 'loop' || e.route === 'under' || e.route === 'left';

  const route = (e, A, B, fb, tb) => {
    const pts = [A];
    if (e.route === 'under') {
      const y = Math.max(fb.y + fb.h, tb.y + tb.h) + 24;
      pts.push({ x: A.x, y }, { x: B.x, y });
    } else if (e.route === 'left') {
      const x = Math.max(8, Math.min(fb.x, tb.x) - 28);
      pts.push({ x, y: A.y }, { x, y: B.y });
    } else if (horizontal(e.fs) && horizontal(e.ts)) {
      if (Math.abs(A.y - B.y) > 0.5) {
        const mx = e.route === 'merge' ? B.x + (e.ts === 'l' ? -18 : 18) : (A.x + B.x) / 2;
        pts.push({ x: mx, y: A.y }, { x: mx, y: B.y });
      }
    } else if (!horizontal(e.fs) && !horizontal(e.ts)) {
      if (Math.abs(A.x - B.x) > 0.5) {
        const my = e.route === 'merge' ? B.y + (e.ts === 't' ? -16 : 16) : (A.y + B.y) / 2;
        pts.push({ x: A.x, y: my }, { x: B.x, y: my });
      }
    } else if (horizontal(e.fs)) {
      pts.push({ x: B.x, y: A.y });
    } else {
      pts.push({ x: A.x, y: B.y });
    }
    pts.push(B);
    return pts;
  };

  // Pull both ends off the node edges; the arrowhead tip lands `tipGap` short of the target.
  const trimEnds = (pts, startGap, tipGap) => {
    const move = (p, q, d) => {
      const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      return { x: p.x + (q.x - p.x) * d / len, y: p.y + (q.y - p.y) * d / len };
    };
    const out = pts.slice();
    out[0] = move(out[0], out[1], startGap);
    const n = out.length - 1;
    out[n] = move(out[n], out[n - 1], tipGap);
    return out;
  };

  const pathD = (pts, radius = 8) => {
    const f = v => Math.round(v * 10) / 10;
    let d = `M${f(pts[0].x)},${f(pts[0].y)}`;
    for (let i = 1; i < pts.length - 1; i += 1) {
      const [p0, p1, p2] = [pts[i - 1], pts[i], pts[i + 1]];
      const d1 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const d2 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (d1 < 0.5 || d2 < 0.5) continue;
      const r = Math.min(radius, d1 / 2, d2 / 2);
      const a = { x: p1.x + (p0.x - p1.x) * r / d1, y: p1.y + (p0.y - p1.y) * r / d1 };
      const b = { x: p1.x + (p2.x - p1.x) * r / d2, y: p1.y + (p2.y - p1.y) * r / d2 };
      d += ` L${f(a.x)},${f(a.y)} Q${f(p1.x)},${f(p1.y)} ${f(b.x)},${f(b.y)}`;
    }
    const last = pts[pts.length - 1];
    return `${d} L${f(last.x)},${f(last.y)}`;
  };

  const arrowHead = (from, tip, len = 7, half = 3.8) => {
    const d = Math.hypot(tip.x - from.x, tip.y - from.y) || 1;
    const ux = (tip.x - from.x) / d;
    const uy = (tip.y - from.y) / d;
    const bx = tip.x - ux * len;
    const by = tip.y - uy * len;
    const f = v => Math.round(v * 10) / 10;
    return `M${f(tip.x)},${f(tip.y)} L${f(bx - uy * half)},${f(by + ux * half)} L${f(bx + uy * half)},${f(by - ux * half)} Z`;
  };

  const graphs = [...figure.querySelectorAll('.km-graph')].map(el => ({
    el,
    svg: el.querySelector(':scope > .km-wires'),
    wide: parseEdges(el.dataset.edges),
    narrow: el.dataset.edgesNarrow ? parseEdges(el.dataset.edgesNarrow) : null,
    narrowQuery: window.matchMedia(el === strip || el.classList.contains('km-intent-body') ? '(max-width: 760px)' : '(max-width: 560px)'),
    paths: [],
    pulses: {},
  }));
  const f1 = v => Math.round(v * 10) / 10;

  const drawGraph = g => {
    const narrow = g.narrow && g.narrowQuery.matches;
    const edges = narrow ? g.narrow : g.wide;
    const nodes = {};
    g.el.querySelectorAll('[data-node]').forEach(n => { nodes[n.dataset.node] = n; });
    const w = g.el.offsetWidth;
    const h = g.el.offsetHeight;
    if (!w || !h) return;
    g.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    let html = '';
    const ends = [];
    const pulseKeys = [];
    edges.forEach(e => {
      const fromEl = nodes[e.from];
      const toEl = nodes[e.to];
      if (!fromEl || !toEl) return;
      const fb = boxIn(fromEl, g.el);
      const tb = boxIn(toEl, g.el);
      const A = anchor(fb, e.fs);
      let B = anchor(tb, e.ts);
      if (e.alignX) B = { x: Math.min(Math.max(A.x, tb.x + 8), tb.x + tb.w - 8), y: B.y };
      const draw = e.pulse != null ? `${Number(e.pulse)}s` : '0s';
      if (e.route === 'lead') {
        // Leaves the module, turns in the gap between the two cards, and ends on the photo.
        const rb = boxIn(real, g.el);
        const mx = (rb.x + rb.w + flowOrigin().x) / 2;
        const pts = Math.abs(A.y - B.y) > 0.5 ? [A, { x: mx, y: A.y }, { x: mx, y: B.y }, B] : [A, B];
        html += `<path class="km-lead km-w-${e.color}" d="${pathD(trimEnds(pts, 4, 0), 10)}" style="--draw:${draw}"/>`;
        html += `<circle class="km-lead km-lead-ring km-w-${e.color}" cx="${f1(B.x)}" cy="${f1(B.y)}" r="5.2" style="--draw:${draw}"/>`;
        ends.push({ count: 2, ends: [fromEl, toEl] });
        return;
      }
      const pts = trimEnds(route(e, A, B, fb, tb), 3, 3);
      const tip = pts[pts.length - 1];
      const beforeTip = pts[pts.length - 2];
      const line = trimEnds(pts, 0, 4);
      const loop = isLoop(e);
      const signal = e.pulse != null && !loop;
      const color = `km-w-${e.color}`;
      html += `<path class="km-w-base ${color}${loop ? ' km-w-loop' : ''}" d="${pathD(line)}"${loop ? '' : ' pathLength="100"'} style="--draw:${draw}"/>`;
      html += `<path class="km-ah km-ah-${e.color}" d="${arrowHead(beforeTip, tip)}" style="--draw:${draw}"/>`;
      if (signal) {
        html += `<path class="km-pulse ${color}" d="${pathD(line)}"/>`;
        html += `<path class="km-pulse-head km-ah-${e.color}" d="${arrowHead(beforeTip, tip)}"/>`;
        pulseKeys.push(`${e.from}>${e.to}`);
      }
      ends.push({ count: signal ? 4 : 2, ends: [fromEl, toEl] });
    });
    g.svg.innerHTML = html;
    g.pulses = {};
    g.svg.querySelectorAll('.km-pulse').forEach((el, k) => { g.pulses[pulseKeys[k]] = { line: el, head: el.nextElementSibling }; });
    const pathEls = [...g.svg.children];
    let i = 0;
    g.paths = ends.map(({ count, ends: pair }) => {
      const els = pathEls.slice(i, i + count);
      i += count;
      return { els, ends: pair };
    });
    if (lastKeys) paintWires();
  };

  // The method card starts one gap beside the photo card, or below it once they stack.
  const flowOrigin = () => {
    const rb = boxIn(real, strip);
    const gap = parseFloat(getComputedStyle(strip).getPropertyValue('--km-gap')) || 0;
    return stacked.matches ? { x: 0, y: rb.y + rb.h + gap } : { x: rb.x + rb.w + gap, y: 0 };
  };

  // The method card's two halves meet at the latent intent, or at the middle of its open view.
  const setSplit = () => {
    const zb = boxIn(zButton, strip);
    strip.style.setProperty('--split-y', `${f1(intentOpen() ? intentSplit : zb.y + zb.h / 2)}px`);
  };

  const positionHints = () => {
    // Each hint points at its node without covering the node's name or click target.
    const style = getComputedStyle(strip);
    hints.forEach(hint => {
      if (hint.classList.contains('is-dismissed')) return;
      const node = hint.dataset.hintFor === 'intent' ? zButton : modules[hint.dataset.hintFor];
      const b = boxIn(node, strip);
      if (hint.dataset.hintFor !== 'intent') {
        const compact = intentOpen();
        const prefix = hint.dataset.hintFor === 'policy' ? 'pi' : 'dec';
        const scale = compact ? COMPACT : 1;
        const h = parseFloat(style.getPropertyValue(compact ? '--km-mod-hc' : '--km-mod-h'));
        const cx = b.x + b.w / 2 + (compact ? parseFloat(style.getPropertyValue(`--${prefix}-tx`)) : 0);
        const cy = b.y + b.h / 2 + (compact ? parseFloat(style.getPropertyValue(`--${prefix}-ty`)) : 0);
        b.w *= scale;
        b.h = h * scale;
        b.x = cx - b.w / 2;
        b.y = cy - b.h / 2;
      }
      const side = hint.dataset.hintFor !== 'decoder' || intentOpen();
      hint.classList.toggle('km-hint-side', side);
      hint.style.left = `${f1(b.x + b.w + (side ? 10 : -18))}px`;
      hint.style.top = `${f1(side ? b.y + (hint.dataset.hintFor === 'intent' ? b.h / 2 : 15) : b.y - 6)}px`;
    });
  };

  const layoutFigure = () => {
    const flow = flowOrigin();
    strip.style.setProperty('--flow-x', `${flow.x}px`);
    strip.style.setProperty('--flow-y', `${flow.y}px`);
    if (intentOpen() && strip.offsetWidth !== intentWidth) {
      strip.style.height = `${intentGeometry(naturalHeight())}px`;
    }
    setSplit();
    positionHints();
    // Point each panel's caret at the module that opened it.
    Object.entries(drawers).forEach(([name, drawer]) => {
      const panel = drawer.querySelector('.km-panel');
      const mb = boxIn(modules[name], figure);
      const pb = boxIn(panel, figure);
      panel.style.setProperty('--caret-x', `${mb.x + mb.w / 2 - pb.x}px`);
    });
    graphs.forEach(drawGraph);
  };

  let layoutFrame = 0;
  const scheduleLayout = () => {
    if (layoutFrame) return;
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = 0;
      layoutFigure();
    });
  };

  /* ---------------- Panels ---------------- */
  const drawers = {
    decoder: document.getElementById('km-panel-decoder'),
    policy: document.getElementById('km-panel-policy'),
  };
  const modules = {
    decoder: strip.querySelector('.km-module[data-panel="decoder"]'),
    policy: strip.querySelector('.km-module[data-panel="policy"]'),
  };
  const isOpen = name => drawers[name].classList.contains('is-open');
  const OPEN_MS = 640;

  // The decoder panel grows upward: keep the strip still on screen while it does.
  let holdFrame = 0;
  let releaseHold = () => {};
  const holdStrip = pinnedTop => {
    releaseHold();
    const until = performance.now() + OPEN_MS + 40;
    const cancel = () => {
      cancelAnimationFrame(holdFrame);
      window.removeEventListener('wheel', cancel);
      window.removeEventListener('touchstart', cancel);
      releaseHold = () => {};
    };
    releaseHold = cancel;
    window.addEventListener('wheel', cancel, { passive: true });
    window.addEventListener('touchstart', cancel, { passive: true });
    const step = now => {
      const drift = strip.getBoundingClientRect().top - pinnedTop;
      if (Math.abs(drift) >= 1) window.scrollBy({ top: drift, behavior: 'instant' });
      if (now < until) holdFrame = requestAnimationFrame(step);
      else cancel();
    };
    step(performance.now());
  };

  let revealTimer = 0;
  const revealPanel = (name, onDone) => {
    clearTimeout(revealTimer);
    revealTimer = setTimeout(() => {
      releaseHold();
      const panel = drawers[name].querySelector('.km-panel');
      const r = panel.getBoundingClientRect();
      const behavior = reduceMotion.matches ? 'auto' : 'smooth';
      if (name === 'decoder' && r.top < 16) {
        window.scrollBy({ top: r.top - 24, behavior });
      } else if (name === 'policy' && r.bottom > window.innerHeight - 8) {
        const stripTop = strip.getBoundingClientRect().top;
        window.scrollBy({ top: Math.max(0, Math.min(r.bottom - window.innerHeight + 24, stripTop - 24)), behavior });
      }
      if (onDone) onDone();
    }, reduceMotion.matches ? 0 : OPEN_MS + 60);
  };

  const setOpen = (name, open, onDone) => {
    const drawer = drawers[name];
    if (!drawer) return;
    if (open) dismissHint(name);
    if (isOpen(name) === open) {
      if (open && onDone) onDone();
      return;
    }
    // Opening a training panel first folds the latent-intent view back into the strip.
    if (open && intentOpen()) {
      setIntent(false, () => setOpen(name, true, onDone));
      return;
    }
    hideTip();
    const pinnedTop = strip.getBoundingClientRect().top;
    drawer.classList.toggle('is-open', open);
    drawer.inert = !open;
    figure.classList.toggle(`km-sel-${name}`, open);
    figure.querySelectorAll(`button[data-panel="${name}"]:not(.km-close)`).forEach(button => {
      button.setAttribute('aria-expanded', String(open));
    });
    if (name === 'decoder') holdStrip(pinnedTop);
    if (open) revealPanel(name, onDone);
  };

  figure.querySelectorAll('button[data-panel]:not(.km-close)').forEach(button => {
    const name = button.dataset.panel;
    button.addEventListener('click', () => setOpen(name, !isOpen(name)));
  });
  figure.querySelectorAll('.km-close[data-panel]').forEach(button => {
    button.addEventListener('click', () => {
      const name = button.dataset.panel;
      setOpen(name, false);
      modules[name].focus({ preventScroll: true });
    });
  });
  Object.entries(drawers).forEach(([name, drawer]) => {
    drawer.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      setOpen(name, false);
      modules[name].focus({ preventScroll: true });
    });
  });

  /* ---------------- Latent intent ---------------- */
  // Opens in the middle of the loop: the policy and decoder shrink to compact blocks at its
  // bottom and top, the other inputs and outputs fade out, and the panel grows out of the z pill.
  const intent = strip.querySelector('.km-intent');
  const zButton = strip.querySelector('.km-node-z');
  const intentGraph = graphs.find(g => g.el.classList.contains('km-intent-body'));
  const stacked = window.matchMedia('(max-width: 760px)');
  const INTENT_MS = 640;
  const COMPACT = 0.78;
  let intentWidth = 0;
  let intentSplit = 0;
  const intentOpen = () => strip.classList.contains('is-intent');

  const naturalHeight = () => {
    const prev = strip.style.height;
    strip.style.height = '';
    const h = strip.offsetHeight;
    strip.style.height = prev;
    return h;
  };

  // Sets the compact-module offsets, the panel box, and the z-pill rect the panel grows from.
  // Returns the strip height needed while the panel is open.
  const intentGeometry = naturalH => {
    const px = v => `${Math.round(v * 10) / 10}px`;
    const set = (name, v) => strip.style.setProperty(name, px(v));
    const W = strip.offsetWidth;
    const pi = boxIn(modules.policy, strip);
    const dec = boxIn(modules.decoder, strip);
    const zb = boxIn(strip.querySelector('[data-node="z"]'), strip);
    const flow = flowOrigin();
    const margin = stacked.matches ? 12 : 16;
    const edge = 40; // keeps the compact modules clear of the zone labels
    const gap = 30;
    const arrow = (el, x, y, len, deg) => {
      el.style.setProperty('--ax', px(x));
      el.style.setProperty('--ay', px(y));
      el.style.setProperty('--al', px(Math.max(0, len)));
      el.style.setProperty('--ar', `${deg}deg`);
    };
    strip.style.setProperty('--km-cs', COMPACT);
    // Stack, bottom to top: compact policy, arrow, panel, arrow, compact decoder. It is centered in
    // the loop's region and only grows the strip when the region is too short to hold it. The modules
    // shrink to --km-mod-hc around their own centers, which their fixed rows keep in place.
    const ch = (parseFloat(getComputedStyle(strip).getPropertyValue('--km-mod-hc')) || pi.h) * COMPACT;
    const ix = flow.x + margin;
    const iw = W - ix - margin;
    set('--iw', iw);
    const ih = intent.offsetHeight;
    const stackH = ch + gap + ih + gap + ch;
    const height = Math.max(naturalH, flow.y + edge + stackH + edge);
    const top = flow.y + edge + (height - flow.y - 2 * edge - stackH) / 2;
    const iy = top + ch + gap;
    const cx = ix + iw / 2;
    const decCy = top + ch / 2;
    const piCy = iy + ih + gap + ch / 2;
    set('--pi-tx', cx - (pi.x + pi.w / 2));
    set('--pi-ty', piCy - (pi.y + pi.h / 2));
    set('--dec-tx', cx - (dec.x + dec.w / 2));
    set('--dec-ty', decCy - (dec.y + dec.h / 2));
    arrow(strip.querySelector('.km-intent-arrow-in'), cx, piCy - ch / 2 - 6, gap - 14, -90);
    arrow(strip.querySelector('.km-intent-arrow-out'), cx, iy - 6, gap - 14, -90);
    set('--ix', ix);
    set('--iy', iy);
    set('--c-t', Math.max(0, zb.y - iy));
    set('--c-l', Math.max(0, zb.x - ix));
    set('--c-r', Math.max(0, ix + iw - zb.x - zb.w));
    set('--c-b', Math.max(0, iy + ih - zb.y - zb.h));
    intentSplit = iy + ih / 2;
    intentWidth = W;
    if (intentGraph) drawGraph(intentGraph);
    return height;
  };

  let intentTimer = 0;
  const setIntent = (open, onDone) => {
    clearTimeout(intentTimer);
    if (open) dismissHint('intent');
    if (intentOpen() === open) {
      if (onDone) onDone();
      return;
    }
    // The training panels close first, then the middle opens.
    if (open && (isOpen('policy') || isOpen('decoder'))) {
      setOpen('policy', false);
      setOpen('decoder', false);
      intentTimer = setTimeout(() => setIntent(true, onDone), reduceMotion.matches ? 0 : 420);
      return;
    }
    hideTip();
    current = null;
    unlight();
    const naturalH = naturalHeight();
    const target = open ? intentGeometry(naturalH) : naturalH;
    strip.style.height = `${strip.offsetHeight}px`;
    void strip.offsetHeight;
    strip.classList.toggle('is-intent', open);
    figure.classList.toggle('km-sel-intent', open);
    intent.inert = !open;
    zButton.setAttribute('aria-expanded', String(open));
    setSplit();
    strip.style.height = `${target}px`;
    positionHints();
    intentTimer = setTimeout(() => {
      if (!open) strip.style.height = '';
      if (open) {
        const r = strip.getBoundingClientRect();
        const behavior = reduceMotion.matches ? 'auto' : 'smooth';
        if (r.top < 0) window.scrollBy({ top: r.top - 24, behavior });
        else if (r.bottom > window.innerHeight - 8) window.scrollBy({ top: Math.min(r.bottom - window.innerHeight + 24, r.top - 24), behavior });
      }
      if (onDone) onDone();
    }, reduceMotion.matches ? 0 : INTENT_MS);
  };

  zButton.addEventListener('click', () => setIntent(!intentOpen()));

  // The robot's motion on the photo opens the decoder's panel; its contacts open the latent intent.
  real.querySelectorAll('[data-km-open]').forEach(el => {
    const toggle = () => {
      const target = el.dataset.kmOpen;
      if (target === 'intent') setIntent(!intentOpen());
      else setOpen(target, !isOpen(target));
    };
    el.addEventListener('click', toggle);
    el.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      toggle();
    });
  });
  intent.querySelector('[data-intent-close]').addEventListener('click', () => {
    setIntent(false);
    zButton.focus({ preventScroll: true });
  });
  intent.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    setIntent(false);
    zButton.focus({ preventScroll: true });
  });

  /* ---------------- Linked highlighting ---------------- */
  const keysOf = (el, attr = 'km') => (el.dataset[attr] || '').split(/\s+/).filter(Boolean);
  // Elements folded away (closed panels, or strip nodes hidden by the intent view) never light up.
  // The photo stays in view throughout.
  const visible = el => {
    if (el.closest('.km-real')) return true;
    if (el.closest('.km-drawer:not(.is-open)')) return false;
    if (el.closest('.km-intent')) return intentOpen();
    return !(intentOpen() && el.closest('.km-strip') && !el.classList.contains('km-module'));
  };
  let lastKeys = null;

  const paintWires = () => {
    graphs.forEach(g => g.paths.forEach(p => {
      const on = p.ends.some(n => {
        const owner = n.closest('[data-km]');
        return owner && owner.classList.contains('is-lit');
      });
      p.els.forEach(el => el.classList.toggle('is-lit', on));
    }));
  };

  const light = keys => {
    // The expanded intent view hides and repositions the inference nodes.
    // Its layout must not be overridden by linked hover highlighting.
    if (intentOpen()) return;
    lastKeys = keys;
    const groups = [...figure.querySelectorAll('[data-km-group]')].filter(g => keys.includes(g.dataset.kmGroup));
    let shown = 0;
    figure.querySelectorAll('[data-km]').forEach(el => {
      // Zone backgrounds are hover targets, not nodes to fade or scale with the graph.
      const on = !el.classList.contains('km-zone') && (keysOf(el).some(k => keys.includes(k)) || groups.some(g => g.contains(el)));
      el.classList.toggle('is-lit', on);
      if (on && visible(el)) shown += 1;
    });
    figure.classList.toggle('km-focus', shown > 0);
    if (shown) strip.querySelectorAll('.is-fire').forEach(el => el.classList.remove('is-fire'));
    [...figure.classList].filter(c => c.startsWith('km-key-')).forEach(c => figure.classList.remove(c));
    if (shown) keys.forEach(k => figure.classList.add(`km-key-${k}`));
    section.querySelectorAll('.km-term').forEach(t => {
      t.classList.toggle('is-lit', keysOf(t, 'kmLink').some(k => keys.includes(k)));
    });
    paintWires();
  };

  const unlight = () => {
    lastKeys = null;
    figure.classList.remove('km-focus');
    [...figure.classList].filter(c => c.startsWith('km-key-')).forEach(c => figure.classList.remove(c));
    section.querySelectorAll('.is-lit').forEach(el => el.classList.remove('is-lit'));
  };

  /* ---------------- Tooltips ---------------- */
  let tipEl = null;
  let tip = { x: 0, y: 0, tx: 0, ty: 0, frame: 0, primed: false, on: false };
  const tipNode = () => {
    if (tipEl) return tipEl;
    tipEl = document.createElement('div');
    tipEl.className = 'km-tip';
    tipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(tipEl);
    return tipEl;
  };
  const toneOf = el => {
    if (el.closest('.km-panel-blue')) return 'var(--km-blue-ink, #0f6aa6)';
    if (el.closest('.km-panel-green')) return 'var(--km-green-ink, #3a7b1e)';
    const k = keysOf(el)[0];
    if (['dec', 'state', 'act'].includes(k)) return '#0f6aa6';
    if (['pi', 'z', 'zprev'].includes(k)) return '#3a7b1e';
    return '#67625b';
  };
  const showTip = el => {
    const node = tipNode();
    node.innerHTML = `<b></b><span></span>`;
    node.firstChild.innerHTML = el.dataset.tipTitle;
    node.lastChild.innerHTML = el.dataset.tip;
    node.style.setProperty('--tip-color', toneOf(el));
    tip.on = true;
    node.classList.add('is-on');
  };
  const paintTip = () => { tipNode().style.transform = `translate3d(${Math.round(tip.x)}px, ${Math.round(tip.y)}px, 0)`; };
  const easeTip = () => {
    const dx = tip.tx - tip.x;
    const dy = tip.ty - tip.y;
    tip.x += dx * 0.25;
    tip.y += dy * 0.25;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
      tip.x = tip.tx;
      tip.y = tip.ty;
      tip.frame = 0;
      paintTip();
      return;
    }
    paintTip();
    tip.frame = tip.on ? requestAnimationFrame(easeTip) : 0;
  };
  const placeTip = (cx, cy) => {
    const node = tipNode();
    const pad = 10;
    let x = cx + 16;
    let y = cy + 18;
    if (x + node.offsetWidth > window.innerWidth - pad) x = cx - node.offsetWidth - 16;
    if (y + node.offsetHeight > window.innerHeight - pad) y = cy - node.offsetHeight - 16;
    tip.tx = Math.min(Math.max(x, pad), Math.max(pad, window.innerWidth - node.offsetWidth - pad));
    tip.ty = Math.min(Math.max(y, pad), Math.max(pad, window.innerHeight - node.offsetHeight - pad));
    if (!tip.primed || reduceMotion.matches) {
      tip.x = tip.tx;
      tip.y = tip.ty;
      tip.primed = true;
      paintTip();
      return;
    }
    if (!tip.frame) tip.frame = requestAnimationFrame(easeTip);
  };
  function hideTip() {
    tip.on = false;
    tip.primed = false;
    cancelAnimationFrame(tip.frame);
    tip.frame = 0;
    if (tipEl) tipEl.classList.remove('is-on');
  }

  /* ---------------- Hover / tap on figure elements ---------------- */
  let current = null;
  let leaveTimer = 0;
  const activate = el => {
    clearTimeout(leaveTimer);
    if (intentOpen()) {
      current = null;
      unlight();
      hideTip();
      return;
    }
    if (el === current) return;
    current = el;
    light([...keysOf(el), ...keysOf(el, 'kmRel')]);
    if (el.dataset.tip) showTip(el);
    else hideTip();
  };
  const release = (delay = 140) => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      current = null;
      if (section.querySelector('.km-term:hover, .km-term:focus')) return;
      unlight();
      hideTip();
    }, delay);
  };
  // The photo only lights up in response to the method card; hovering it does nothing.
  const ownerAt = target => {
    const el = target.closest && target.closest('[data-tip]');
    return el && figure.contains(el) && !el.closest('.km-real') && visible(el) ? el : null;
  };

  figure.querySelectorAll('[data-tip][tabindex="0"]').forEach(el => {
    el.addEventListener('focus', () => {
      activate(el);
      const r = el.getBoundingClientRect();
      if (tip.on) placeTip(r.left + r.width / 2, r.top + r.height / 2);
    });
    el.addEventListener('blur', () => release(0));
  });

  if (!touchish) {
    figure.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch' || event.target.closest('.km-term')) return;
      const el = ownerAt(event.target);
      if (!el) {
        if (current) release();
        return;
      }
      activate(el);
      if (tip.on) placeTip(event.clientX, event.clientY);
    });
    figure.addEventListener('pointerleave', () => release(0));
  } else {
    figure.addEventListener('click', event => {
      if (event.target.closest('.km-term')) return;
      const el = ownerAt(event.target);
      if (!el || el.matches('button, [data-km-open]')) {
        current = null;
        unlight();
        hideTip();
        return;
      }
      current = null;
      activate(el);
      const r = el.getBoundingClientRect();
      tip.primed = false;
      placeTip(Math.min(r.right, window.innerWidth - 40) - 8, r.bottom - 8);
    });
    document.addEventListener('click', event => {
      if (!figure.contains(event.target) && current) {
        current = null;
        unlight();
        hideTip();
      }
    });
  }
  window.addEventListener('scroll', () => { if (current && !touchish) release(0); }, { passive: true });

  section.querySelectorAll('.km-term').forEach(term => {
    const keys = keysOf(term, 'kmLink');
    const enter = () => {
      clearTimeout(leaveTimer);
      current = null;
      hideTip();
      light(keys);
    };
    term.addEventListener('mouseenter', enter);
    term.addEventListener('mouseleave', unlight);
    term.addEventListener('focus', enter);
    term.addEventListener('blur', unlight);
    const target = term.dataset.kmOpen;
    if (!target) return;
    const relight = () => { if (document.activeElement === term || term.matches(':hover')) light(keys); };
    const open = () => (target === 'intent' ? setIntent(true, relight) : setOpen(target, true, relight));
    term.addEventListener('click', open);
    term.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });

  /* ---------------- Live signal ---------------- */
  // One inference step, bottom to top: the observation and the previous latent intent enter the
  // policy, the policy emits z_t, z_t and the robot state enter the decoder, and the decoder emits
  // the action. One wire at a time fills from its source and its arrowhead flashes; the block it
  // lands on then flashes. The dashed feedback to z_{t-1} and the photo stay still. It rests while
  // the reader is inspecting something.
  const HOP = 460; // ms a wire takes to fill
  const CYCLE = 4600;
  const stripGraph = graphs.find(g => g.el === strip);
  const inStrip = sel => strip.querySelector(sel);
  const pulse = (key, slow = 1) => {
    const p = stripGraph.pulses[key];
    if (!p || !p.line.animate) return;
    const len = p.line.getTotalLength();
    const fill = HOP * slow;
    const total = fill + 260;
    const at = fill / total;
    p.line.style.strokeDasharray = `${f1(len + 1)} ${f1(len + 1)}`;
    p.line.animate([
      { strokeDashoffset: `${f1(len + 1)}px`, opacity: 1, easing: 'cubic-bezier(.45,0,.55,1)' },
      { strokeDashoffset: '0px', opacity: 1, offset: at },
      { strokeDashoffset: '0px', opacity: 0 },
    ], { duration: total });
    p.head.animate([{ opacity: 0 }, { opacity: 0, offset: at * 0.8 }, { opacity: 1, offset: at }, { opacity: 0 }], { duration: total });
  };
  const fire = (...els) => els.forEach(el => {
    if (!el) return;
    el.classList.add('is-fire');
    setTimeout(() => el.classList.remove('is-fire'), 1300);
  });
  const FLOW = [
    [0, () => { fire(inStrip('.km-end-obs')); pulse('obs>pi'); pulse('zprev>pi'); }],
    [HOP, () => fire(modules.policy)],
    [HOP + 320, () => pulse('pi>z')],
    [2 * HOP + 320, () => fire(zButton)],
    [2 * HOP + 640, () => { fire(inStrip('.km-sub-state')); pulse('z>dec'); pulse('state>dec'); }],
    [3 * HOP + 640, () => fire(modules.decoder)],
    [3 * HOP + 960, () => pulse('dec>act')],
    [4 * HOP + 960, () => fire(inStrip('.km-end-act'))],
  ];
  const quiet = () => document.hidden || intentOpen() || figure.classList.contains('km-focus');
  let flowTimers = [];
  const runFlow = () => {
    flowTimers = FLOW.map(([at, step]) => setTimeout(() => { if (!quiet()) step(); }, at));
    flowTimers.push(setTimeout(runFlow, CYCLE));
  };
  const setLive = on => {
    flowTimers.forEach(clearTimeout);
    flowTimers = [];
    if (on && !reduceMotion.matches) runFlow();
  };

  /* ---------------- First-use hints ---------------- */
  if (touchish) hints.forEach(hint => { hint.querySelector('.km-hint-text').textContent = 'Tap to try'; });
  function dismissHint(name) {
    const hint = hints.find(hint => hint.dataset.hintFor === name);
    if (!hint || hint.classList.contains('is-dismissed')) return;
    hint.classList.add('is-dismissed');
    setTimeout(() => { hint.hidden = true; }, reduceMotion.matches ? 0 : 220);
  }

  /* ---------------- Entrance ---------------- */
  if (reduceMotion.matches || !('IntersectionObserver' in window)) {
    strip.classList.add('is-in', 'is-settled');
  } else {
    let liveTimer = 0;
    const io = new IntersectionObserver(([entry]) => {
      const first = entry.isIntersecting && !strip.classList.contains('is-in');
      if (first) {
        strip.classList.add('is-in');
        setTimeout(() => strip.classList.add('is-settled'), 1700);
      }
      clearTimeout(liveTimer);
      if (entry.isIntersecting) liveTimer = setTimeout(() => setLive(true), first ? 1900 : 300);
      else setLive(false);
    }, { threshold: 0.35 });
    io.observe(strip);
  }

  /* ---------------- Layout triggers ---------------- */
  layoutFigure();
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(scheduleLayout);
    graphs.forEach(g => ro.observe(g.el));
    ro.observe(figure);
  }
  window.addEventListener('resize', scheduleLayout);
  figure.querySelectorAll('img').forEach(img => { if (!img.complete) img.addEventListener('load', scheduleLayout, { once: true }); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleLayout);
});
