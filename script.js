const body = document.body;
const list = document.getElementById('projectList');
const items = [...document.querySelectorAll('.project-item')];
const layers = new Map([...document.querySelectorAll('.media-layer')].map(layer => [layer.dataset.work, layer]));
const closeButton = document.getElementById('closeBtn');

let activeWork = 'profile';
let mode = 'list';
let hoverTimer = null;
let hoveredWork = null;
let wheelDelta = 0;
let wheelResetTimer = null;
let lastWheelStep = -Infinity;
let lastWheelDirection = 0;
let hoverBlockedUntil = 0;
let touchStart = null;
let loadTimer = null;
let loadedVideo = null;
let playRequest = 0;

function setMode(nextMode) {
  mode = nextMode;
  body.classList.toggle('is-detail', nextMode === 'detail');
  body.classList.toggle('is-profile-detail', nextMode === 'detail' && activeWork === 'profile');
  body.classList.toggle('is-profile-active', nextMode === 'list' && activeWork === 'profile');
  if (nextMode === 'detail') playActive(true);
}

function prepareVideo(layer) {
  const video = layer?.querySelector('video.media:not(.media-hires)');
  if (!video) return null;
  if (!video.src && video.dataset.src) {
    video.src = video.dataset.src;
    video.load();
  }
  return video;
}

function releaseHighRes(layer) {
  const high = layer?.querySelector('video.media-hires');
  if (!high) return;
  high.pause();
  high.removeAttribute('src');
  high.load();
  high.remove();
}

function playWhenReady(video, request) {
  const play = () => {
    if (request !== playRequest || !video.isConnected || video.closest('.media-layer')?.dataset.work !== activeWork) return;
    video.play().catch(() => {});
  };
  // A video whose source has just been assigned can reject play() while its
  // metadata is still loading. Try again as soon as frames are available.
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) play();
  else video.addEventListener('canplay', play, { once: true });
}

function upgradeToHighRes(layer, baseVideo) {
  const source = baseVideo?.dataset.hires;
  if (!layer || !baseVideo || !source || layer.querySelector('.media-hires')) return;
  const basePath = new URL(baseVideo.currentSrc || baseVideo.src, location.href).pathname;
  const highPath = new URL(source, location.href).pathname;
  if (highPath === basePath) {
    baseVideo.classList.add('is-ready');
    return;
  }

  const high = document.createElement('video');
  high.className = 'media media-hires';
  high.muted = true;
  high.loop = true;
  high.playsInline = true;
  high.preload = 'auto';
  high.src = source;
  high.addEventListener('canplay', () => {
    if (mode !== 'detail' || activeWork !== layer.dataset.work) return;
    high.currentTime = Math.min(baseVideo.currentTime || 0, Math.max(0, high.duration - .1));
    high.play().catch(() => {});
  }, { once: true });
  high.addEventListener('playing', () => high.classList.add('is-ready'), { once: true });
  layer.querySelector('.media-frame')?.appendChild(high);
  high.load();
}

function pauseAll(except) {
  layers.forEach(layer => {
    layer.querySelectorAll('video').forEach(video => {
      if (video !== except) video.pause();
    });
  });
}

function releaseVideo(video) {
  if (!video || !video.src) return;
  video.pause();
  video.removeAttribute('src');
  video.load();
}

function playActive(restart = false) {
  clearTimeout(loadTimer);
  const request = ++playRequest;
  const delay = mode === 'detail' ? 0 : 90;
  loadTimer = setTimeout(() => {
    if (request !== playRequest) return;
    const video = prepareVideo(layers.get(activeWork));
    if (!video) {
      pauseAll(null);
      if (loadedVideo) {
        releaseVideo(loadedVideo);
        releaseHighRes(loadedVideo.closest('.media-layer'));
      }
      loadedVideo = null;
      return;
    }
    if (loadedVideo && loadedVideo !== video) {
      releaseVideo(loadedVideo);
      releaseHighRes(loadedVideo.closest('.media-layer'));
    }
    loadedVideo = video;
    pauseAll(video);
    if (restart && video.readyState) video.currentTime = 0;
    playWhenReady(video, request);
    if (mode === 'detail') upgradeToHighRes(layers.get(activeWork), video);
  }, delay);
}

function activate(work) {
  if (!layers.has(work) || activeWork === work) return;
  activeWork = work;
  body.classList.toggle('is-profile-active', mode === 'list' && work === 'profile');
  items.forEach(item => item.classList.toggle('is-active', item.dataset.work === work));
  layers.forEach((layer, key) => layer.classList.toggle('is-active', key === work));
  centerActive();
  playActive(false);
}

function centerActive(immediate = false) {
  const current = items.find(item => item.dataset.work === activeWork);
  if (!current) return;
  if (immediate) list.style.transition = 'none';
  const center = current.offsetTop + current.offsetHeight / 2;
  list.style.transform = `translate3d(0, ${Math.round(window.innerHeight / 2 - center)}px, 0)`;
  if (immediate) requestAnimationFrame(() => { list.style.transition = ''; });
}

function advanceWork(direction) {
  const index = items.findIndex(item => item.dataset.work === activeWork);
  const next = items[Math.max(0, Math.min(items.length - 1, index + direction))];
  if (next && next.dataset.work !== activeWork) {
    clearTimeout(hoverTimer);
    hoveredWork = null;
    hoverBlockedUntil = performance.now() + 680;
    activate(next.dataset.work);
  }
}

window.addEventListener('wheel', event => {
  if (mode !== 'list' || !event.deltaY) return;
  event.preventDefault();
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
  if (wheelDelta && Math.sign(wheelDelta) !== Math.sign(delta)) wheelDelta = 0;
  wheelDelta += delta;
  clearTimeout(wheelResetTimer);
  wheelResetTimer = setTimeout(() => { wheelDelta = 0; }, 180);
  const now = performance.now();
  const direction = Math.sign(wheelDelta);
  const cooldown = direction === lastWheelDirection ? 360 : 160;
  if (Math.abs(wheelDelta) < 24 || now - lastWheelStep < cooldown) return;
  lastWheelStep = now;
  lastWheelDirection = direction;
  advanceWork(direction);
  wheelDelta = 0;
}, { passive: false });

window.addEventListener('touchstart', event => {
  touchStart = mode === 'list' && event.touches.length === 1
    ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
    : null;
}, { passive: true });

window.addEventListener('touchmove', event => {
  if (mode === 'list' && event.cancelable) event.preventDefault();
}, { passive: false });

window.addEventListener('touchend', event => {
  if (!touchStart || !event.changedTouches.length || mode !== 'list') return;
  const deltaY = touchStart.y - event.changedTouches[0].clientY;
  const deltaX = touchStart.x - event.changedTouches[0].clientX;
  touchStart = null;
  if (Math.abs(deltaY) < 45 || Math.abs(deltaY) < Math.abs(deltaX) * 1.2) return;
  event.preventDefault();
  advanceWork(Math.sign(deltaY));
}, { passive: false });

window.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });

list.addEventListener('pointermove', event => {
  if (mode !== 'list' || event.pointerType !== 'mouse' || performance.now() < hoverBlockedUntil) return;
  const item = event.target.closest('.project-item');
  const work = item?.dataset.work;
  if (!work || work === activeWork) {
    clearTimeout(hoverTimer);
    hoveredWork = null;
    return;
  }
  if (hoveredWork === work) return;
  clearTimeout(hoverTimer);
  hoveredWork = work;
  hoverTimer = setTimeout(() => {
    if (mode === 'list' && hoveredWork === work) activate(work);
    hoveredWork = null;
  }, 130);
});

list.addEventListener('pointerleave', () => {
  clearTimeout(hoverTimer);
  hoveredWork = null;
});

items.forEach(item => {
  item.addEventListener('focus', () => activate(item.dataset.work));
  item.addEventListener('click', () => {
    clearTimeout(hoverTimer);
    hoveredWork = null;
    activate(item.dataset.work);
    setMode('detail');
  });
});

function backToList() {
  releaseHighRes(layers.get(activeWork));
  setMode('list');
  centerActive(true);
  playActive();
  const current = items.find(item => item.dataset.work === activeWork);
  current?.focus({ preventScroll: true });
}

closeButton.addEventListener('click', backToList);

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && mode !== 'list') backToList();
  if (mode === 'list' && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    event.preventDefault();
    advanceWork(event.key === 'ArrowDown' ? 1 : -1);
  }
});

centerActive(true);
window.addEventListener('resize', () => centerActive(true));
document.fonts?.ready.then(() => centerActive(true));
window.addEventListener('load', () => {
  centerActive(true);
  requestAnimationFrame(() => {
    body.classList.add('is-ready');
  });
});
