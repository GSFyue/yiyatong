import { useEffect } from "react";
import { GuideBar } from "./components/GuideBar";
import { NavBar } from "./components/NavBar";
import { updateTitle } from "./announce";
import { useUrl } from "./router";
import { setSplit, useSplit } from "./split";
import { Arch } from "./pages/Arch";
import { Board } from "./pages/Board";
import { Child } from "./pages/Child";
import { Parent } from "./pages/Parent";
import { Qoder } from "./pages/Qoder";

export default function App() {
  const { route, guide } = useUrl();
  const split = useSplit();

  useEffect(() => {
    updateTitle();
  }, [route]);

  // 换肤与嵌入标记都挂在 body 上，整页一次生效
  useEffect(() => {
    const embedded = window.self !== window.top;
    document.body.classList.toggle("yyt-child", route === "child");
    document.body.classList.toggle("yyt-embed", embedded);
    document.body.classList.toggle("yyt-split-mode", split.active);
    if (embedded) hideWatermark();
  }, [route, split.active]);

  // 离开父母端就退出并排模式
  useEffect(() => {
    if (route !== "parent") setSplit({ active: false, frameLoaded: false, frameFailed: false });
  }, [route]);

  return (
    <div className="yyt-shell">
      <NavBar />
      <main className={route === "qoder" ? "yyt-main yyt-main-wide" : "yyt-main"}>
        {route === "parent" ? <Parent /> : null}
        {route === "child" ? <Child /> : null}
        {route === "board" ? <Board /> : null}
        {route === "arch" ? <Arch /> : null}
        {route === "qoder" ? <Qoder /> : null}
      </main>
      {guide && !split.active ? <GuideBar /> : null}
    </div>
  );
}

/** 嵌入模式下去掉平台角标（普通 DOM 节点）。 */
function hideWatermark() {
  document.querySelectorAll("body *").forEach((el) => {
    if (el.children.length === 0 && /Made with Qoder/i.test(el.textContent || "")) {
      (el as HTMLElement).style.display = "none";
    }
  });
}
