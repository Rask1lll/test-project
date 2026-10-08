import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useMobileViewportHeight } from './useMobileViewportHeight';

it('follows the mobile visual viewport and restores the desktop layout', () => {
  const viewport = Object.assign(new EventTarget(), { height: 844 });
  vi.stubGlobal('visualViewport', viewport);
  vi.stubGlobal('innerWidth', 390);
  const { result, unmount } = renderHook(useMobileViewportHeight);
  expect(result.current).toBe(844);
  act(() => { viewport.height = 440; viewport.dispatchEvent(new Event('resize')); });
  expect(result.current).toBe(440);
  act(() => { vi.stubGlobal('innerWidth', 1280); window.dispatchEvent(new Event('resize')); });
  expect(result.current).toBeUndefined();
  const removeViewportListener = vi.spyOn(viewport, 'removeEventListener');
  unmount();
  expect(removeViewportListener).toHaveBeenCalledWith('resize', expect.any(Function));
});
