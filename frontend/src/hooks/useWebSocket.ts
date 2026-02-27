"use client";

import { useEffect, useRef, useState } from "react";
import { wsClient } from "@/lib/websocket";
import type { WSEvent } from "@/lib/types";

export function useWebSocket(onEvent?: (event: WSEvent) => void) {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<WSEvent[]>([]);
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    wsClient.connect();

    const unsub = wsClient.subscribe((event) => {
      if (event.event === "connected") {
        setConnected(true);
      }
      setEvents((prev) => [event, ...prev].slice(0, 200));
      callbackRef.current?.(event);
    });

    const checkInterval = setInterval(() => {
      setConnected(wsClient.isConnected);
    }, 3000);

    return () => {
      unsub();
      clearInterval(checkInterval);
    };
  }, []);

  return { connected, events };
}
