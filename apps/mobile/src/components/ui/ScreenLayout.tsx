// ─────────────────────────────────────────────
//  ScreenLayout — Editorial Premium screen shell
//
//  Defaults:
//   · SafeAreaView with top edge (bottom handled by tab bar / nav)
//   · bgPrimary background
//   · Optional pageGutter horizontal padding (EditorialSpacing.pageGutter)
//   · scrollable mode uses RefreshControl-friendly ScrollView
//
//  Editorial wants generous gutters by default; opt out with gutter={0}
//  for full-bleed hero images.
// ─────────────────────────────────────────────
import { ReactNode } from 'react';
import { View, ScrollView, StyleSheet, ViewStyle, ScrollViewProps } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';

import { Colors, EditorialSpacing } from '@/constants/tokens';

interface Props {
  children: ReactNode;
  scrollable?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  /** Horizontal padding. Defaults to EditorialSpacing.pageGutter (24). Use 0 for full-bleed. */
  gutter?: number;
  /** Which safe-area edges to apply. Defaults to ['top']. */
  edges?: Edge[];
  /** Forwarded to the inner ScrollView when scrollable. */
  scrollProps?: Omit<ScrollViewProps, 'children' | 'contentContainerStyle'>;
}

export function ScreenLayout({
  children,
  scrollable = false,
  style,
  contentStyle,
  gutter = EditorialSpacing.pageGutter,
  edges = ['top'],
  scrollProps,
}: Props) {
  const padding: ViewStyle = gutter ? { paddingHorizontal: gutter } : {};

  if (scrollable) {
    return (
      <SafeAreaView style={[styles.root, style]} edges={edges}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, padding, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          {...scrollProps}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, style]} edges={edges}>
      <View style={[styles.content, padding, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  scroll: { flex: 1 },
  content: { flexGrow: 1 },
});
