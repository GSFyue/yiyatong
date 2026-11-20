import { useEffect, useLayoutEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { setGuide, useGuide } from "../guide";
import { dismissQueryParam, setHash, type RouteKey } from "../router";

interface GuideStep {
  route: RouteKey;
  /** 候选选择器，按顺序取第一个真实存在的元素。 */
  selectors: string[];
  text: string;
}

export const GUIDE_STEPS: GuideStep[] = [
  { route: "board", selectors: ['[data-guide="funnel"]'], text: "这是给谁用的 —— 74.7% 的老人会聊天，只有 9.6% 会挂号" },
  { route: "parent", selectors: ['[data-guide="card-挂号"]'], text: "父母端只做一件事 —— 点一下「挂号」这张卡" },
  { route: "parent", selectors: ['[data-guide="send"]'], text: "说一句「说好了，发出」—— 语音会念出来，不用打字" },
  { route: "child", selectors: ['[data-guide="task-card"]'], text: "打开子女端 —— 任务实时同步过来了，金额、对象、时间都在" },
  { route: "child", selectors: ['[data-guide="limit-input"]'], text: "把限额改成 500，再发一笔 800 —— 看它被自动拦截" },
  { route: "child", selectors: ['[data-guide="trace"]'], text: "看留痕时间线 —— 每一步都留了痕" },
];

interface SpotRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function GuideBar() {
  const guide = useGuide();
  const [rect, setRect] = useState<SpotRect | null>(null);
  const index = Math.min(guide.index, GUIDE_STEPS.length - 1);
  const step = GUIDE_STEPS[index];

  useEffect(() => {
    setGuide({ active: true, index: 0 });
    return () => setGuide({ active: false });
  }, []);

  // 切步骤时先撤掉旧矩形：留着上一步的框会悬在当前页面的别的元素上
  useLayoutEffect(() => {
    setRect(null);
  }, [step]);

  const findTarget = (selectors: string[]): Element | null => {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  };

  const applyRect = (el: Element) => {
    const box = el.getBoundingClientRect();
    setRect({ top: box.top, left: box.left, width: box.width, height: box.height });
  };

  useEffect(() => {
    setHash(step.route);
    let retryFrame = 0;
    let measureFrame = 0;
    let tries = 0;
    let disposed = false;

    // 目标不在可视区时先滚进来，等一帧再量，避免量到滚动前的旧坐标
    const place = (el: Element) => {
      const bar = document.querySelector(".yyt-guide-bar");
      const barHeight = bar ? bar.getBoundingClientRect().height : 0;
      const limit = window.innerHeight - barHeight;
      const box = el.getBoundingClientRect();
      if (box.top >= 0 && box.bottom <= limit) {
        applyRect(el);
        return;
      }
      el.scrollIntoView({ behavior: "instant", block: "center" });
      measureFrame = requestAnimationFrame(() => {
        if (disposed) return;
        const next = el.getBoundingClientRect();
        if (next.top >= 0 && next.bottom <= limit) {
          applyRect(el);
          return;
        }
        // 元素比可用高度还高时补一次位移，保证整块都在视口里
        const delta = next.top < 0 ? -next.top : next.bottom - limit;
        window.scrollBy({ top: delta, behavior: "instant" });
        applyRect(el);
      });
    };

    const locate = () => {
      if (disposed) return;
      const el = findTarget(step.selectors);
      if (el) {
        place(el);
      } else if (tries < 60) {
        tries += 1;
        retryFrame = requestAnimationFrame(locate);
      } else {
        // 找不到目标就撤掉聚光灯，绝不保留上一步的矩形
        setRect(null);
      }
    };

    const timer = setTimeout(locate, 150);
    return () => {
      disposed = true;
      clearTimeout(timer);
      cancelAnimationFrame(retryFrame);
      cancelAnimationFrame(measureFrame);
    };
  }, [step]);

  useEffect(() => {
    const onViewportChange = () => {
      const el = findTarget(step.selectors);
      if (!el) {
        setRect(null);
        return;
      }
      applyRect(el);
    };
    addEventListener("scroll", onViewportChange, true);
    addEventListener("resize", onViewportChange);
    return () => {
      removeEventListener("scroll", onViewportChange, true);
      removeEventListener("resize", onViewportChange);
    };
  }, [step]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismissQueryParam("guide");
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const close = () => dismissQueryParam("guide");

  return (
    <>
      {rect ? (
        <div
          className="yyt-guide-spot"
          style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }}
          aria-hidden="true"
        />
      ) : null}
      <div className="yyt-guide-bar" role="dialog" aria-label="演示导览">
        <p>{step.text}</p>
        <div className="row">
          <span className="count">
            第 {index + 1} 步 / 共 {GUIDE_STEPS.length} 步
          </span>
          <Button size="sm" variant="ghost" onClick={close} className="text-white hover:bg-white/15">
            跳过
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setGuide({ index: Math.max(0, index - 1) })}
            disabled={index === 0}
          >
            上一步
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (index >= GUIDE_STEPS.length - 1) close();
              else setGuide({ index: index + 1 });
            }}
          >
            {index >= GUIDE_STEPS.length - 1 ? "看完了" : "下一步"}
          </Button>
        </div>
      </div>
    </>
  );
}
