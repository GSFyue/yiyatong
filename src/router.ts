import { useSyncExternalStore } from "react";

export type RouteKey = "parent" | "child" | "board" | "arch" | "qoder";

export interface UrlState {
  route: RouteKey;
  role: "parent" | "child";
  guide: boolean;
  hashParams: URLSearchParams;
}

const ROUTES: RouteKey[] = ["parent", "child", "board", "arch", "qoder"];

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

function readUrl(): UrlState {
  const search = new URLSearchParams(location.search);
  const hash = location.hash.replace(/^#\/?/, "");
  const [path, query] = hash.split("?");
  const hashParams = new URLSearchParams(query ?? "");

  const parsed = path as RouteKey;
  const hashRoute: RouteKey = ROUTES.includes(parsed) ? parsed : "parent";
  const roleParam = search.get("role");
  // ?role=child 用于「一键打开子女端」：未显式导航时直接落到子女端
  const route: RouteKey = roleParam === "child" && hashRoute === "parent" ? "child" : hashRoute;

  return {
    route,
    role: route === "child" ? "child" : "parent",
    guide: search.get("guide") === "1",
    hashParams,
  };
}

let cached: UrlState | null = null;
let cachedKey = "";

export function getUrl(): UrlState {
  const key = `${location.hash}|${location.search}`;
  if (!cached || cachedKey !== key) {
    cachedKey = key;
    cached = readUrl();
  }
  return cached;
}

function subscribeUrl(listener: () => void): () => void {
  listeners.add(listener);
  const onHash = () => notify();
  addEventListener("hashchange", onHash);
  addEventListener("popstate", onHash);
  return () => {
    listeners.delete(listener);
    removeEventListener("hashchange", onHash);
    removeEventListener("popstate", onHash);
  };
}

export function useUrl(): UrlState {
  return useSyncExternalStore(subscribeUrl, getUrl, getUrl);
}

/** 手动导航：顺带清掉 ?role / ?guide 覆盖参数，让用户自己的点击永远生效。 */
export function navigate(route: RouteKey, options: { keepParams?: boolean } = {}): void {
  const url = new URL(location.href);
  if (!options.keepParams) {
    url.searchParams.delete("role");
    url.searchParams.delete("guide");
  }
  const nextHash = `#/${route}`;
  const next = `${url.pathname}${url.search}${nextHash}`;
  if (location.pathname + location.search + location.hash !== next) {
    history.replaceState(null, "", next);
  }
  if (location.hash !== nextHash) {
    location.hash = nextHash;
  } else {
    notify();
  }
}

/** 只改 hash，保留 search 上的 ?guide=1 等参数。 */
export function setHash(route: RouteKey): void {
  const nextHash = `#/${route}`;
  if (location.hash !== nextHash) location.hash = nextHash;
  else notify();
}

/** 去掉 URL 上的某个查询参数（用于退出导览）。 */
export function dismissQueryParam(name: string): void {
  const url = new URL(location.href);
  url.searchParams.delete(name);
  const next = `${url.pathname}${url.search}${location.hash}`;
  if (location.pathname + location.search + location.hash !== next) {
    history.replaceState(null, "", next);
  }
  notify();
}

/** 设置 URL 查询参数并立即刷新视图。 */
export function setQueryParams(params: Record<string, string>): void {
  const url = new URL(location.href);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const next = `${url.pathname}${url.search}${location.hash}`;
  if (location.pathname + location.search + location.hash !== next) {
    history.replaceState(null, "", next);
  }
  notify();
}

export function currentBase(): string {
  return location.origin + location.pathname;
}
