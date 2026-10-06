import React, { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { FirstLoadTransition } from "@/components/site/FirstLoadTransition";

const HomeBootstrapContext = createContext(null);
export const useHomeBootstrap = () => useContext(HomeBootstrapContext);

// Only a fresh load of the public homepage is gated. SPA navigation does not
// recheck the backend once startup has succeeded.
const startedOnHome = typeof window !== "undefined" && window.location.pathname === "/";
let startupComplete = false;

const MAX_WAIT_MS = 75_000;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_BACKOFF_MS = 7_000;

export function HomeStartupGate({ children }) {
  const { pathname } = useLocation();
  const [bootstrap, setBootstrap] = useState(null);
  const [message, setMessage] = useState("Preparing YuktiCart...");
  const [timedOut, setTimedOut] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const needsWakeup = startedOnHome && pathname === "/" && !startupComplete;

  useEffect(() => {
    if (!needsWakeup) return;
    let stopped = false;
    let expired = false;
    let controller = null;
    let requestTimer = null;
    let retryTimer = null;
    const deadline = Date.now() + MAX_WAIT_MS;
    const deadlineTimer = window.setTimeout(() => {
      if (stopped) return;
      expired = true;
      controller?.abort();
      window.clearTimeout(retryTimer);
      setTimedOut(true);
    }, MAX_WAIT_MS);

    const attempt = async (number) => {
      if (stopped || expired) return;
      controller = new AbortController();
      requestTimer = window.setTimeout(
        () => controller?.abort(),
        Math.min(REQUEST_TIMEOUT_MS, Math.max(1, deadline - Date.now())),
      );
      try {
        setMessage("Connecting to savings engine...");
        const { data: health } = await api.get("/health", { signal: controller.signal });
        if (health?.ready !== true || health?.database !== true) throw new Error("Not ready");
        if (stopped || expired) return;

        setMessage("Getting today's savings options ready...");
        const [stores, homepageStores, categories, promotions] = await Promise.all([
          api.get("/public/stores", { signal: controller.signal }),
          api.get("/public/stores?homepage=true&limit=5", { signal: controller.signal }),
          api.get("/public/homepage/categories", { signal: controller.signal }),
          api.get("/public/homepage/promotions", { signal: controller.signal }),
        ]);
        if (![stores, homepageStores, categories, promotions].every((response) => Array.isArray(response.data))) {
          throw new Error("Homepage data unavailable");
        }
        if (stopped || expired) return;
        startupComplete = true;
        setBootstrap({ stores: stores.data, homepageStores: homepageStores.data,
          categories: categories.data, promotions: promotions.data });
      } catch {
        if (stopped || expired) return;
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          expired = true;
          setTimedOut(true);
          return;
        }
        setMessage("YuktiCart is still waking up...");
        const delay = Math.min(1500 * (2 ** Math.min(number, 3)), MAX_BACKOFF_MS, remaining);
        retryTimer = window.setTimeout(() => attempt(number + 1), delay);
      } finally {
        window.clearTimeout(requestTimer);
        controller = null;
      }
    };

    attempt(0);
    return () => {
      stopped = true;
      window.clearTimeout(deadlineTimer);
      window.clearTimeout(requestTimer);
      window.clearTimeout(retryTimer);
      controller?.abort();
    };
  }, [needsWakeup, retryKey]);

  // Later visits to Home in the same SPA session retain its normal fresh fetch.
  useEffect(() => {
    if (pathname !== "/" && bootstrap) setBootstrap(null);
  }, [pathname, bootstrap]);

  const retry = () => {
    setTimedOut(false);
    setMessage("Preparing YuktiCart...");
    setRetryKey((value) => value + 1);
  };

  return (
    <HomeBootstrapContext.Provider value={bootstrap}>
      {!needsWakeup && children}
      <AnimatePresence>
        {needsWakeup && (
          <FirstLoadTransition status={message} timedOut={timedOut} onRetry={retry} />
        )}
      </AnimatePresence>
    </HomeBootstrapContext.Provider>
  );
}
