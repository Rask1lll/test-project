import { useEffect, useState } from 'react';

// Mobile keyboards can resize the visual viewport without resizing the layout viewport.
export function useMobileViewportHeight() {
  const [height, setHeight] = useState<number>();
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => setHeight(window.innerWidth <= 720
      ? Math.round(viewport?.height ?? window.innerHeight) : undefined);
    update();
    viewport?.addEventListener('resize', update);
    window.addEventListener('resize', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return height;
}
