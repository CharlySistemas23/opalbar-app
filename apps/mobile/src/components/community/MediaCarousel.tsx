// ─────────────────────────────────────────────
//  MediaCarousel — multi-image pager for posts
//
//  Horizontal paging FlatList with page dots. Shared by PostCard (feed) and
//  the post detail screen so both render the same geometry. Single image →
//  no dots, no paging overhead. Optional overlay slot (face tags, like
//  burst) is rendered above the active page.
// ─────────────────────────────────────────────
import { ReactNode, useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/tokens';
import { Roles } from '@/constants/a11y';

interface Props {
  urls: string[];
  /** Width of the carousel. Defaults to window width. */
  width?: number;
  /** Aspect ratio (w/h). Default 1 (square, IG-style). */
  aspectRatio?: number;
  resizeMode?: 'cover' | 'contain';
  onPress?: (index: number) => void;
  onIndexChange?: (index: number) => void;
  accessibilityLabel?: string;
  /** Rendered on top of every page (e.g. like burst). */
  overlay?: ReactNode;
  /** Rendered on top of a specific page only (e.g. face tags for page 0). */
  renderPageOverlay?: (index: number) => ReactNode;
  style?: object;
}

export function MediaCarousel({
  urls,
  width,
  aspectRatio = 1,
  resizeMode = 'cover',
  onPress,
  onIndexChange,
  accessibilityLabel,
  overlay,
  renderPageOverlay,
  style,
}: Props) {
  const { width: winW } = useWindowDimensions();
  const w = width ?? winW;
  const h = Math.round(w / aspectRatio);
  const [index, setIndex] = useState(0);
  const lastIndex = useRef(0);

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(e.nativeEvent.contentOffset.x / w);
      if (next !== lastIndex.current) {
        lastIndex.current = next;
        setIndex(next);
        onIndexChange?.(next);
      }
    },
    [w, onIndexChange],
  );

  if (urls.length === 0) return null;

  const renderPage = (uri: string, i: number) => {
    const body = (
      <View style={{ width: w, height: h }}>
        <Image source={{ uri }} style={{ width: w, height: h }} resizeMode={resizeMode} />
        {renderPageOverlay ? renderPageOverlay(i) : null}
      </View>
    );
    if (!onPress) return body;
    return (
      <Pressable
        accessibilityRole={Roles.imagebutton}
        accessibilityLabel={accessibilityLabel}
        onPress={() => onPress(i)}
      >
        {body}
      </Pressable>
    );
  };

  return (
    <View style={[styles.wrap, { width: w, height: h }, style]}>
      {urls.length === 1 ? (
        renderPage(urls[0], 0)
      ) : (
        <FlatList
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          data={urls}
          keyExtractor={(u, i) => `${i}-${u}`}
          renderItem={({ item, index: i }) => renderPage(item, i)}
          onMomentumScrollEnd={onScrollEnd}
          getItemLayout={(_, i) => ({ length: w, offset: w * i, index: i })}
          initialNumToRender={2}
          windowSize={3}
        />
      )}

      {overlay ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {overlay}
        </View>
      ) : null}

      {urls.length > 1 ? (
        <>
          <View pointerEvents="none" style={styles.counter}>
            <View style={styles.counterPill}>
              <CounterText index={index} total={urls.length} />
            </View>
          </View>
          <View pointerEvents="none" style={styles.dots}>
            {urls.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

// Tiny inline component so we don't import Typography into a hot list cell.
function CounterText({ index, total }: { index: number; total: number }) {
  return (
    <Text style={styles.counterText} allowFontScaling={false}>
      {index + 1}/{total}
    </Text>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.bgElevated,
    overflow: 'hidden',
  },
  dots: {
    position: 'absolute',
    bottom: Spacing[2],
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(246,241,231,0.35)',
  },
  dotActive: {
    backgroundColor: Colors.accentPrimary,
  },
  counter: {
    position: 'absolute',
    top: Spacing[3],
    right: Spacing[3],
  },
  counterPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(8,7,6,0.6)',
  },
  counterText: {
    color: Colors.textPrimary,
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
});
