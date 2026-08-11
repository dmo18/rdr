const CONFIG = {
  width: 456,
  height: 257,
  location: { lat: 26.06197904865014, lon: -80.18787062578414 },
  cycleMs: 9000,
  refreshMs: 5 * 60 * 1000,
  views: [
    {
      id: 'hyperlocal',
      name: 'Hyperlocal Radar',
      product: 'KAMX Reflectivity',
      type: 'image',
      url: 'https://radar.weather.gov/ridge/standard/KAMX_loop.gif',
      fallback: 'https://radar.weather.gov/ridge/standard/KAMX_0.gif',
      transform: 'translate(-53.2%, -41.6%) scale(1.34)',
      reticle: { x: 56.0, y: 35.7 },
      badge: 'Hollywood / Dania'
    },
    {
      id: 'metro',
      name: 'Metro Radar',
      product: 'KAMX Metro',
      type: 'image',
      url: 'https://radar.weather.gov/ridge/standard/KAMX_loop.gif',
      fallback: 'https://radar.weather.gov/ridge/standard/KAMX_0.gif',
      transform: 'translate(-52.2%, -46.3%) scale(1.12)',
      reticle: { x: 54.7, y: 41.8 },
      badge: 'Broward / Miami-Dade'
    },
    {
      id: 'southfl',
      name: 'South Florida Radar',
      product: 'KAMX Regional',
      type: 'image',
      url: 'https://radar.weather.gov/ridge/standard/KAMX_loop.gif',
      fallback: 'https://radar.weather.gov/ridge/standard/KAMX_0.gif',
      transform: 'translate(-50%, -50%) scale(0.96)',
      reticle: { x: 54.0, y: 47.0 },
      badge: 'South Florida'
    },
    {
      id: 'southeast',
      name: 'Southeast Radar',
      product: 'Southeast Loop',
      type: 'image',
      url: 'https://radar.weather.gov/ridge/standard/SOUTHEAST_loop.gif',
      transform: 'translate(-50%, -50%) scale(0.43)',
      badge: 'Upstream Pattern'
    },
    {
      id: 'satellite',
      name: 'Infrared Satellite',
      product: 'SE IR Sat',
      type: 'image',
      url: 'https://s.w-x.co/staticmaps/wu/wu/satir1200_cur/usase/animate.png',
      transform: 'translate(-50%, -50%) scale(0.38)',
      badge: 'Cloud Shield / Tops'
    },
    {
      id: 'warnings',
      name: 'Warnings',
      product: 'Hazard Overlay',
      type: 'image',
      url: 'https://s.w-x.co/staticmaps/wu/wxtype/county_loc/eyw/animate.png',
      transform: 'translate(-50%, -50%) scale(0.54)',
      badge: 'County Hazard View'
    },
    {
      id: 'trop2',
      name: 'Tropical 2 Day',
      product: 'NHC TWO 2-Day',
      type: 'image',
      url: 'https://www.nhc.noaa.gov/xgtwo/two_atl_2d0.png',
      transform: 'translate(-50%, -50%) scale(0.53)',
      badge: 'Atlantic Outlook'
    },
    {
      id: 'trop5',
      name: 'Tropical 5 Day',
      product: 'NHC TWO 5-Day',
      type: 'image',
      url: 'https://www.nhc.noaa.gov/xgtwo/two_atl_5d0.png',
      transform: 'translate(-50%, -50%) scale(0.53)',
      badge: 'Atlantic Outlook'
    }
  ]
};

const state = {
  nodes: new Map(),
  current: 0,
  timer: null,
  stamp: new Map(),
  health: new Map(),
};

const q = new URLSearchParams(location.search);
const forced = q.get('view');
const stage = document.getElementById('stage');
const tmpl = document.getElementById('view-template');
const boot = document.getElementById('boot');
const elView = document.getElementById('statusView');
const elProduct = document.getElementById('statusProduct');
const elDetail = document.getElementById('statusDetail');
const elTime = document.getElementById('statusTime');

function formatClock(d = new Date()) {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

function cacheBust(url) {
  const u = new URL(url, location.href);
  u.searchParams.set('_ts', String(Date.now()));
  return u.toString();
}

function scalePanel() {
  const root = document.documentElement;
  const scale = Math.min(window.innerWidth / CONFIG.width, window.innerHeight / CONFIG.height, 1);
  root.style.setProperty('--scale', String(Math.max(0.25, scale)));
}

function makeView(def) {
  const frag = tmpl.content.cloneNode(true);
  const view = frag.querySelector('.view');
  const img = frag.querySelector('.media');
  const label = frag.querySelector('.labelchip');
  const reticle = frag.querySelector('.reticle');

  view.dataset.id = def.id;
  img.alt = `${def.name} image`;
  img.style.transform = def.transform;
  img.src = cacheBust(def.url);

  if (def.badge) {
    label.textContent = def.badge;
    label.classList.remove('hidden');
  }

  if (def.reticle) {
    reticle.style.left = `${def.reticle.x}%`;
    reticle.style.top = `${def.reticle.y}%`;
    reticle.classList.remove('hidden');
  }

  img.addEventListener('load', () => {
    state.stamp.set(def.id, new Date());
    state.health.set(def.id, 'live');
    if (currentDef().id === def.id) updateStatus(def);
  });

  img.addEventListener('error', () => {
    if (def.fallback && img.dataset.failed !== '1') {
      img.dataset.failed = '1';
      img.src = cacheBust(def.fallback);
      return;
    }
    state.health.set(def.id, 'degraded');
    if (currentDef().id === def.id) updateStatus(def);
  });

  const node = frag.firstElementChild;
  state.nodes.set(def.id, { root: node, img, label, reticle });
  stage.appendChild(node);
}

function currentDef() {
  return CONFIG.views[state.current] || CONFIG.views[0];
}

function updateStatus(def) {
  const stamp = state.stamp.get(def.id);
  const health = state.health.get(def.id) || 'loading';
  elView.textContent = def.name;
  elProduct.textContent = def.product;
  elTime.textContent = stamp ? formatClock(stamp) : '--:--:--';
  elDetail.className = '';
  if (health === 'live') {
    elDetail.textContent = 'LIVE';
    elDetail.classList.add('good');
  } else if (health === 'degraded') {
    elDetail.textContent = 'DEGRADED';
    elDetail.classList.add('warn');
  } else {
    elDetail.textContent = 'LOADING';
    elDetail.classList.add('bad');
  }
}

function show(index) {
  state.current = index;
  CONFIG.views.forEach((def, i) => {
    const n = state.nodes.get(def.id)?.root;
    if (n) n.classList.toggle('active', i === index);
  });
  updateStatus(currentDef());
}

function next() {
  if (forced) return;
  const nextIndex = (state.current + 1) % CONFIG.views.length;
  show(nextIndex);
}

function startRotation() {
  clearInterval(state.timer);
  if (forced) return;
  state.timer = setInterval(next, CONFIG.cycleMs);
}

function refreshSources() {
  CONFIG.views.forEach(def => {
    const node = state.nodes.get(def.id);
    if (!node) return;
    node.img.dataset.failed = '0';
    node.img.src = cacheBust(def.url);
  });
}

function init() {
  scalePanel();
  window.addEventListener('resize', scalePanel, { passive: true });
  CONFIG.views.forEach(makeView);
  let initial = 0;
  if (forced) {
    const found = CONFIG.views.findIndex(v => v.id === forced);
    initial = found >= 0 ? found : 0;
  }
  show(initial);
  startRotation();
  setInterval(refreshSources, CONFIG.refreshMs);
  boot.classList.add('hidden');
}

init();
