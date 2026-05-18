// ─────────────────────────────────────────────
//  ConfirmDialog — Editorial Premium decision modal
//
//  Composes on top of <Modal>. Replaces the previous ConfirmSheet for
//  consistency across destructive + neutral confirmations.
//
//  Use for:
//   · Destructive actions (delete account, cancel reservation, ban user)
//   · Required acknowledgements (terms, irreversible operations)
//
//  Behavior:
//   · Primary CTA is `confirmVariant` (default 'primary'; 'danger' for
//     destructive operations — fires destructive haptic on press)
//   · Secondary "Cancelar" always visible
//   · Backdrop tap is disabled by default (force explicit decision)
//   · Auto-loading state on the confirm button while `onConfirm` runs
// ─────────────────────────────────────────────
import { ReactNode, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, TypePresets } from '@/constants/tokens';
import { Button } from './Button';
import { Modal } from './Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  /** Disable backdrop tap close. Default true for confirms. */
  forceDecision?: boolean;
  testID?: string;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmVariant = 'primary',
  forceDecision = true,
  testID,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    if (busy) return;
    try {
      setBusy(true);
      await Promise.resolve(onConfirm());
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      size="sm"
      dismissOnBackdrop={!forceDecision && !busy}
      hideClose={forceDecision || busy}
      testID={testID}
    >
      {description ? (
        <View style={styles.descriptionWrap}>
          {typeof description === 'string' ? (
            <Text style={[TypePresets.body, styles.description]}>{description}</Text>
          ) : (
            description
          )}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          label={cancelLabel}
          variant="secondary"
          size="md"
          fullWidth
          disabled={busy}
          onPress={onClose}
        />
        <Button
          label={confirmLabel}
          variant={confirmVariant}
          size="md"
          fullWidth
          loading={busy}
          onPress={handleConfirm}
          haptic={confirmVariant === 'danger' ? 'destructive' : 'tap'}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  descriptionWrap: {
    marginBottom: Spacing[5],
  },
  description: {
    color: Colors.textSecondary,
  },
  actions: {
    gap: Spacing[2],
  },
});
