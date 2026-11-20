import { navigate, useUrl, type RouteKey } from "../router";
import { Heartbeat } from "./Heartbeat";

const ITEMS: { route: RouteKey; label: string }[] = [
  { route: "parent", label: "父母端" },
  { route: "child", label: "子女端" },
  { route: "board", label: "家庭看板" },
  { route: "arch", label: "架构与边界" },
  { route: "qoder", label: "Qoder 记录" },
];

export function NavBar() {
  const { route } = useUrl();

  // 嵌在并排演示的 iframe 里时不渲染自己的顶栏
  if (typeof window !== "undefined" && window.self !== window.top) return null;

  return (
    <header className="yyt-top">
      <div className="yyt-brand">
        一按就通
        <small>独居父母的代办入口 · 演示版</small>
      </div>
      <nav className="yyt-nav" aria-label="主导航">
        {ITEMS.map((item) => (
          <a
            key={item.route}
            href={`#/${item.route}`}
            aria-current={route === item.route ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              navigate(item.route);
            }}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <div className="yyt-status">
        <Heartbeat />
      </div>
    </header>
  );
}
