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
let playRequest = 0;

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
  playActive();
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
