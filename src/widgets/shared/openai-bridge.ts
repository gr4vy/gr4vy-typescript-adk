/**
 * TypeScript wrapper for the window.openai API used by ChatGPT widgets.
 */

declare global {
  interface Window {
    openai?: {
      toolOutput?: unknown;
      widgetState?: unknown;
      setWidgetState?: (state: unknown) => void;
      sendFollowUpMessage?: (msg: { prompt: string }) => void;
    };
  }
}

/**
 * Poll for window.openai.toolOutput to become available.
 * Times out after 30 seconds.
 */
export function waitForToolOutput<T>(timeoutMs = 30000): Promise<T> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    function check() {
      if (window.openai?.toolOutput) {
        resolve(window.openai.toolOutput as T);
      } else if (Date.now() > deadline) {
        reject(new Error("Timed out waiting for tool output"));
      } else {
        setTimeout(check, 100);
      }
    }
    check();
  });
}

/**
 * Get persisted widget state (survives re-renders within a session).
 */
export function getWidgetState<T>(): T | null {
  return (window.openai?.widgetState as T) ?? null;
}

/**
 * Persist widget state.
 */
export function setWidgetState(state: unknown): void {
  window.openai?.setWidgetState?.(state);
}

/**
 * Send a follow-up message to ChatGPT (triggers a new model turn).
 */
export function sendFollowUp(prompt: string): void {
  window.openai?.sendFollowUpMessage?.({ prompt });
}

/**
 * Listen for tool result updates via postMessage (for subsequent tool calls).
 */
export function onToolResult<T>(callback: (data: T) => void): () => void {
  function handler(ev: MessageEvent) {
    if (ev.source !== window.parent) return;
    const msg = ev.data;
    if (!msg || msg.jsonrpc !== "2.0") return;
    if (msg.method === "ui/notifications/tool-result") {
      callback(msg.params?.structuredContent as T);
    }
  }
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}

export {};
