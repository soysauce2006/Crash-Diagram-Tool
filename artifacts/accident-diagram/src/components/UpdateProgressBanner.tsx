import { useEffect, useState } from 'react';
import { Progress } from './ui/progress';
import { Download } from 'lucide-react';

interface ProgressData {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

/**
 * Displays a slim banner at the bottom of the window while an auto-update is
 * downloading.  Listens for IPC events forwarded by the main process via
 * window.electronAPI (exposed in preload.cjs).  Dismisses automatically once
 * the download is complete.
 *
 * When the app runs in a browser (non-Electron) or during development the
 * component renders nothing because window.electronAPI won't be present.
 */
export function UpdateProgressBanner() {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.onUpdateProgress) return; // not running in Electron

    const removeProgress = api.onUpdateProgress((data: ProgressData) => {
      setDone(false);
      setProgress(data);
    });

    const removeDownloaded = api.onUpdateDownloaded?.(() => {
      // Keep the bar at 100% briefly so the user sees completion, then hide.
      setProgress((prev) => (prev ? { ...prev, percent: 100 } : null));
      setDone(true);
      const timer = setTimeout(() => setProgress(null), 2500);
      return () => clearTimeout(timer);
    });

    return () => {
      removeProgress?.();
      removeDownloaded?.();
    };
  }, []);

  if (!progress) return null;

  const kb = (bytes: number) => `${Math.round(bytes / 1024).toLocaleString()} KB`;
  const speed = progress.bytesPerSecond
    ? ` · ${Math.round(progress.bytesPerSecond / 1024).toLocaleString()} KB/s`
    : '';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'hsl(215,28%,11%)',
        borderTop: '1px solid hsl(215,25%,22%)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <Download size={14} style={{ color: 'hsl(217,91%,65%)', flexShrink: 0 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            marginBottom: 4,
            color: 'hsl(213,31%,78%)',
          }}
        >
          <span>
            {done
              ? 'Update downloaded — will install on next close'
              : `Downloading update… ${Math.round(progress.percent)}%`}
          </span>
          {!done && progress.total > 0 && (
            <span style={{ color: 'hsl(215,20%,50%)' }}>
              {kb(progress.transferred)} / {kb(progress.total)}{speed}
            </span>
          )}
        </div>
        <Progress
          value={Math.round(progress.percent)}
          className="h-1.5"
          style={
            {
              background: 'hsl(215,25%,22%)',
              '--tw-ring-color': 'transparent',
            } as React.CSSProperties
          }
        />
      </div>
    </div>
  );
}
