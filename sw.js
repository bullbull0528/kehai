// 気配 — Service Worker。
// 方針:
//  - ページ(HTML/ナビゲーション)は「常にネットの最新」を取る（no-store）。古い表示が残らない。
//  - ハッシュ付きの静的アセット(_next/static)は中身が変わらないのでキャッシュ優先（高速）。
//  - それ以外(アイコン・manifest等)はネット優先。
//  - オフライン時のみキャッシュにフォールバック。

const CACHE = "kehai-v3";
const BASE = self.location.pathname.replace(/\/sw\.js$/, "");

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k)))) // 古いキャッシュを一掃
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // ① ページ遷移：常に最新を取得（HTTPキャッシュも無視）。失敗時だけキャッシュ。
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(async () => {
          return (
            (await caches.match(req)) ||
            (await caches.match(BASE + "/")) ||
            Response.error()
          );
        }),
    );
    return;
  }

  // ② ハッシュ付き静的アセットは中身不変 → キャッシュ優先
  if (url.pathname.includes("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            return res;
          }),
      ),
    );
    return;
  }

  // ③ その他(アイコン/manifest等)はネット優先・オフラインでキャッシュ
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req)),
  );
});
