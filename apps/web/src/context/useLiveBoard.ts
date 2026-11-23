import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function useLiveBoard(project: string | undefined, user: string | undefined) {
  const client = useQueryClient();

  useEffect(() => {
    if (!project || !user) return;
    const url = new URL(`/api/v1/projects/${project}/live`, location.href);
    url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
    let disposed = false;
    let retryDelay = 500;
    let socket: WebSocket;
    let retryTimer: ReturnType<typeof setTimeout>;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    function connect() {
      socket = new WebSocket(url);
      socket.onmessage = () => {
        if (disposed || refreshTimer !== undefined) return;
        retryDelay = 500;
        refreshTimer = setTimeout(() => {
          refreshTimer = undefined;
          void client.invalidateQueries({ queryKey: ["board-issues", user, project] });
          void client.invalidateQueries({ queryKey: ["project-workflow", project] });
        }, 80);
      };
      socket.onclose = () => {
        if (disposed) return;
        retryTimer = setTimeout(connect, retryDelay);
        retryDelay = Math.min(15000, retryDelay * 2);
      };
    }

    connect();
    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      clearTimeout(refreshTimer);
      socket.close();
    };
  }, [client, project, user]);
}
