import { useCallback, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

const COLLAPSE_OFFSET = 72;

export function useCollapsibleHeader() {
  const [collapsed, setCollapsed] = useState(false);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setCollapsed(event.nativeEvent.contentOffset.y > COLLAPSE_OFFSET);
  }, []);

  return { collapsed, onScroll };
}
