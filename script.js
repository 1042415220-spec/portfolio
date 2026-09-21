const body = document.body;
const list = document.getElementById('projectList');
const items = [...document.querySelectorAll('.project-item')];
const layers = new Map([...document.querySelectorAll('.media-layer')].map(layer => [layer.dataset.work, layer]));
const closeButton = document.getElementById('closeBtn');

let activeWork = 'profile';
let mode = 'list';
let rafId = null;
let loadTimer = null;
let loadedVideo = null;

function setMode(nextMode) {
  mode = nextMode;
  body.classList.toggle('is-detail', nextMode === 'detail');
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

function upgradeToHighRes(layer, baseVideo) {
  const source = baseVideo?.dataset.hires;
  if (!layer || !baseVideo || !source || layer.querySelector('.media-hires')) return;

  const high = document.createElement('video');
  high.className = 'media media-hires';
  high.muted = true;
  high.loop = true;
  high.playsInline = true;
  high.preload = 'auto';
  high.src = source;
  high.addEventListener('canplay', () => {
    if (mode !== 'detail' || activeWork !== layer.dataset.work) return;
    high.currentTime = baseVideo.currentTime || 0;
    high.classList.add('is-ready');
    high.play().catch(() => {});
  }, { once: true });
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
  const delay = mode === 'detail' ? 0 : 180;
  loadTimer = setTimeout(() => {
    const video = prepareVideo(layers.get(activeWork));
    if (!video) return;
    if (loadedVideo && loadedVideo !== video) {
      releaseVideo(loadedVideo);
      releaseHighRes(loadedVideo.closest('.media-layer'));
    }
    loadedVideo = video;
    pauseAll(video);
    if (restart) video.currentTime = 0;
    video.play().catch(() => {});
    if (mode === 'detail') upgradeToHighRes(layers.get(activeWork), video);
  }, delay);
}

function activate(work) {
  if (!layers.has(work) || activeWork === work) return;
  activeWork = work;
  items.forEach(item => item.classList.toggle('is-active', item.dataset.work === work));
  layers.forEach((layer, key) => layer.classList.toggle('is-active', key === work));
  playActive(false);
}

function updateFromCenter() {
  rafId = null;
  if (mode !== 'list') return;
  const center = window.innerHeight / 2;
  let nearest = items[0];
  let distance = Infinity;
  for (const item of items) {
    const rect = item.getBoundingClientRect();
    const nextDistance = Math.abs(rect.top + rect.height / 2 - center);
    if (nextDistance < distance) {
      nearest = item;
      distance = nextDistance;
    }
  }
  activate(nearest.dataset.work);
}

list.addEventListener('scroll', () => {
  if (!rafId) rafId = requestAnimationFrame(updateFromCenter);
}, { passive: true });

list.addEventListener('pointermove', event => {
  if (mode !== 'list' || event.pointerType !== 'mouse') return;
  const item = event.target.closest('.project-item');
  if (item) activate(item.dataset.work);
});

items.forEach(item => {
  item.addEventListener('focus', () => activate(item.dataset.work));
  item.addEventListener('click', () => {
    activate(item.dataset.work);
    setMode('detail');
  });
});

function backToList() {
  releaseHighRes(layers.get(activeWork));
  setMode('list');
  const current = items.find(item => item.dataset.work === activeWork);
  current?.focus({ preventScroll: true });
}

closeButton.addEventListener('click', backToList);

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && mode !== 'list') backToList();
});

window.addEventListener('load', () => {
  requestAnimationFrame(() => {
    body.classList.add('is-ready');
    updateFromCenter();
  });
});
