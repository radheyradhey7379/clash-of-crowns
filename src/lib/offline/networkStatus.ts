type NetworkStatusCallback = (online: boolean) => void;

let listeners: NetworkStatusCallback[] = [];
let initialized = false;

function handleStatusChange() {
  const online = isOnline();
  listeners.forEach(cb => cb(online));
}

/**
 * Checks if the device is currently online.
 * Works on web and Capacitor Android (via navigator.onLine support in WebView).
 */
export function isOnline(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return true; // Default to online in Node environment (e.g. tests)
  }
  return navigator.onLine;
}

/**
 * Subscribes to changes in network connectivity.
 * Returns an unsubscribe function.
 */
export function subscribeToNetworkChanges(callback: NetworkStatusCallback): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  listeners.push(callback);

  if (!initialized) {
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    initialized = true;
  }

  // Immediately notify listener of current state
  callback(isOnline());

  return () => {
    listeners = listeners.filter(cb => cb !== callback);
    if (listeners.length === 0 && initialized) {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
      initialized = false;
    }
  };
}
