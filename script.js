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
  const video = layer?.querySelector('video');
  if (!video) return null;
  if (!video.src && video.dataset.src) {
    video.src = video.dataset.src;
    video.load();
  }
  return video;
}

function pauseAll(except) {
  layers.forEach(layer => {
    const video = layer.querySelector('video');
    if (video && video !== except) video.pause();
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
    if (loadedVideo && loadedVideo !== video) releaseVideo(loadedVideo);
    loadedVideo = video;
    pauseAll(video);
    if (restart) video.currentTime = 0;
    video.play().catch(() => {});
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
