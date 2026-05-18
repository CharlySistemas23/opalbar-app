// ─────────────────────────────────────────────
//  CreateSheet — Editorial Premium "create" sheet
//
//  Triggered from the community header's plus icon. Three options:
//  Foto / Publicación / Historia. Editorial chrome: kicker overline,
//  hairline separators, ListItem rows. No colored icon boxes; icons sit
//  as glyphs that read like serif marginalia.
// ─────────────────────────────────────────────
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Hairline, Kicker, ListItem } from '@/components/ui';
import {
  Colors,
  EditorialSpacing,
  Radius,
  Spacing,
} from '@/constants/tokens';
import { A11yDefaults } from '@/constants/a11y';

interface Props {
  visible: boolean;
  t: boolean;
  onClose: () => void;
  onPhoto: () => void;
  onPost: () => void;
  onStory: () => void;
}

export function CreateSheet({
  visible,
  t,
  onClose,
  onPhoto,
  onPost,
  onStory,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t ? 'Cerrar' : 'Close'}
        onPress={onClose}
        style={styles.backdrop}
      >
        <Pressable
          {...A11yDefaults.modalRoot(t ? 'Crear publicación' : 'Create post')}
          onPress={() => {}}
          style={styles.sheet}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Kicker tone="champagne">{t ? 'CREAR' : 'CREATE'}</Kicker>
          </View>

          <ListItem
            title={t ? 'Foto' : 'Photo'}
            subtitle={
              t
                ? 'Toma una foto o sube de tu galería'
                : 'Take a photo or upload from gallery'
            }
            leftIcon={<Feather name="image" size={20} color={Colors.textPrimary} />}
            onPress={onPhoto}
            showChevron
          />
          <Hairline variant="subtle" />
          <ListItem
            title={t ? 'Publicación' : 'Post'}
            subtitle={
              t
                ? 'Comparte un texto con la comunidad'
                : 'Share a text with the community'
            }
            leftIcon={<Feather name="edit-3" size={20} color={Colors.textPrimary} />}
            onPress={onPost}
            showChevron
          />
          <Hairline variant="subtle" />
          <ListItem
            title={t ? 'Historia' : 'Story'}
            subtitle={
              t
                ? 'Publica en tu historia (24h)'
                : 'Post to your story (24h)'
            }
            leftIcon={
              <Feather name="plus-circle" size={20} color={Colors.textPrimary} />
            }
            onPress={onStory}
            showChevron
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.bgOverlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: Spacing[3],
    paddingBottom: Spacing[8],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.highlightTop,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderStrong,
    alignSelf: 'center',
    marginBottom: Spacing[4],
  },
  header: {
    paddingHorizontal: EditorialSpacing.pageGutter,
    paddingBottom: Spacing[3],
  },
});
