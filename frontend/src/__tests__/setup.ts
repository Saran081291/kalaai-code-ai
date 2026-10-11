import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// Lazy-loaded pages can take >1s on a cold/busy machine; avoid flaky findBy* timeouts.
configure({ asyncUtilTimeout: 10_000 });

// jsdom lacks Element.scrollTo (used by Chakra Menu and the code viewer).
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = (): void => undefined;
}

// jsdom lacks matchMedia (Chakra color mode "system" + useBreakpointValue need it).
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

// framer-motion viewport features use IntersectionObserver.
if (!('IntersectionObserver' in window)) {
  class MockIntersectionObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  Object.defineProperty(window, 'IntersectionObserver', { writable: true, value: MockIntersectionObserver });
}

afterEach(() => {
  cleanup();
});
