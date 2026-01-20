/**
 * Singleton loader for Google Maps JavaScript API with Places library
 * Prevents duplicate script injection and provides safe Promise-based loading
 */

declare global {
  interface Window {
    google?: {
      maps?: {
        places?: typeof google.maps.places;
      };
    };
  }
}

let loadPromise: Promise<typeof google.maps.places> | null = null;
let isLoaded = false;

/**
 * Check if Google Maps script is already loaded
 */
export function isGoogleMapsLoaded(): boolean {
  return (
    isLoaded &&
    typeof window.google !== 'undefined' &&
    typeof window.google.maps !== 'undefined' &&
    typeof window.google.maps.places !== 'undefined'
  );
}

/**
 * Load Google Maps JavaScript API script with Places library
 * Returns a cached Promise if already loading/loaded
 */
export function loadGoogleMapsScript(): Promise<typeof google.maps.places> {
  // Return cached promise if already loading or loaded
  if (loadPromise) {
    return loadPromise;
  }

  if (isGoogleMapsLoaded()) {
    return Promise.resolve(window.google!.maps!.places!);
  }

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY;

  if (!apiKey) {
    if (import.meta.env.DEV) {
      console.warn(
        'VITE_GOOGLE_MAPS_BROWSER_KEY is missing. Location field will work without autocomplete.'
      );
    }
    return Promise.reject(new Error('Google Maps browser key not configured'));
  }

  // Check if script tag already exists
  const existingScript = document.querySelector(
    `script[src*="maps.googleapis.com/maps/api/js"]`
  );

  if (existingScript) {
    // Script exists but may not be loaded yet - wait for it
    loadPromise = new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (isGoogleMapsLoaded()) {
          clearInterval(checkInterval);
          resolve(window.google!.maps!.places!);
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Google Maps script load timeout'));
      }, 10000); // 10 second timeout
    });

    return loadPromise;
  }

  // Create and inject script tag
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      // Wait for google.maps.places to be available
      const checkGoogle = setInterval(() => {
        if (isGoogleMapsLoaded()) {
          clearInterval(checkGoogle);
          isLoaded = true;
          resolve(window.google!.maps!.places!);
        }
      }, 50);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkGoogle);
        reject(new Error('Google Maps Places library failed to load'));
      }, 5000);
    };

    script.onerror = () => {
      loadPromise = null; // Reset to allow retry
      reject(new Error('Failed to load Google Maps script'));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}
