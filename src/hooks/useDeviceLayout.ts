import { useState, useEffect } from 'react';

export interface DeviceLayout {
  isMobile: boolean;
  isLandscape: boolean;
  width: number;
  height: number;
}

export function useDeviceLayout(): DeviceLayout {
  const [layout, setLayout] = useState<DeviceLayout>({
    isMobile: false,
    isLandscape: false,
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const update = () => {
      setLayout({
        isMobile: window.innerWidth <= 950 || window.innerHeight <= 480,
        isLandscape: window.innerWidth > window.innerHeight,
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return layout;
}
