import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type Event = "INSERT" | "UPDATE" | "DELETE" | "*";

interface Options<T extends Record<string, any>> {
  channel: string;
  table: string;
  schema?: string;
  event?: Event;
  filter?: string;
  enabled?: boolean;
  onChange: (payload: RealtimePostgresChangesPayload<T>) => void;
}

/**
 * Realtime subscription with:
 *  - automatic reconnect on CHANNEL_ERROR / TIMED_OUT / CLOSED
 *  - per-row dedup using (commit_timestamp + row.id + eventType) signature
 */
export function useRealtimeSubscription<T extends Record<string, any>>(opts: Options<T>) {
  const { channel, table, schema = "public", event = "*", filter, enabled = true, onChange } = opts;
  const handlerRef = useRef(onChange);
  handlerRef.current = onChange;

  useEffect(() => {
    if (!enabled) return;

    const seen = new Set<string>();
    let ch: RealtimeChannel | null = null;
    let retry = 0;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const subscribe = () => {
      if (cancelled) return;
      const chName = `${channel}-${Date.now()}`;
      ch = supabase.channel(chName);
      ch.on(
        "postgres_changes" as any,
        { event, schema, table, ...(filter ? { filter } : {}) } as any,
        (payload: RealtimePostgresChangesPayload<T>) => {
          const row: any = (payload as any).new ?? (payload as any).old ?? {};
          const sig = `${payload.commit_timestamp}:${payload.eventType}:${row.id ?? JSON.stringify(row)}`;
          if (seen.has(sig)) return;
          seen.add(sig);
          // bound the cache
          if (seen.size > 500) {
            const first = seen.values().next().value;
            if (first) seen.delete(first);
          }
          handlerRef.current(payload);
        }
      ).subscribe((status) => {
        if (status === "SUBSCRIBED") {
          retry = 0;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          if (cancelled) return;
          if (ch) supabase.removeChannel(ch);
          ch = null;
          const delay = Math.min(1000 * 2 ** retry, 15000);
          retry++;
          retryTimer = setTimeout(subscribe, delay);
        }
      });
    };

    subscribe();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (ch) supabase.removeChannel(ch);
    };
  }, [channel, table, schema, event, filter, enabled]);
}
