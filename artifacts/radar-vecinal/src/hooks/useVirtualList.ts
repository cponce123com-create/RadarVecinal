import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export function useVirtualList<T>(
  items: T[],
  options?: {
    estimateSize?: number;
    overscan?: number;
  }
) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => options?.estimateSize ?? 96,
    overscan: options?.overscan ?? 5,
  });

  return {
    parentRef,
    virtualizer,
    totalSize: virtualizer.getTotalSize(),
    virtualItems: virtualizer.getVirtualItems(),
  };
}
