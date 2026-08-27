/**
 * Service Worker — PWA 离线缓存
 * 网络优先策略：每次先从网络获取最新版本，离线时才用缓存
 */

const CACHE_NAME = "eng-learn-v9";
const ASSETS = [
  "index.html",
  "styles.css",
  "app.js",
  "data.js",
  "manifest.json",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
];

// 安装：缓存所有静态资源
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 激活：清理旧缓存
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// 请求拦截：网络优先，离线回退缓存
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).then((response) => {
      // 网络成功：更新缓存并返回
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      return response;
    }).catch(() => {
      // 网络失败：用缓存
      return caches.match(event.request);
    })
  );
});
