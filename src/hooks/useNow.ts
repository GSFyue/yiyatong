import { useEffect, useState } from "react";

/** 每隔一段时间返回一个“现在”，用于让倒计时自己走起来。 */
export function useNow(intervalMs = 30000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
