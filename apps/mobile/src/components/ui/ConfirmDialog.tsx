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
//   · A rejected `onConfirm` is NEVER swallowed: the dialog stays open,
//     the error is surfaced (toast via apiError by default, or `onError`)
//     so the user can retry or cancel.
// ─────────────────────────────────────────────
import { ReactNode, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, TypePresets } from '@/constants/tokens';
import { apiError } from '@/api/errors';
import { toast } from '@/components/Toast';
import { Button } from './Button';
import { Modal } from './Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  /**
   * Called when `onConfirm` throws/rejects. Defaults to a danger toast with
   * the translated API error. Return nothing; the dialog stays open.
   */
  onError?: (err: unknown) => void;
  title: string;
  description?: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  /** Disable the confirm CTA (e.g. until a confirmation word matches). */
  confirmDisabled?: boolean;
  /** Disable backdrop tap close. Default true for confirms. */
  forceDecision?: boolean;
  testID?: string;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  onError,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmVariant = 'primary',
  confirmDisabled = false,
  forceDecision = true,
  testID,
}: Props) {
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function handleConfirm() {
    if (busy || confirmDisabled) return;
    setBusy(true);
    try {
      await Promise.resolve(onConfirm());
    } catch (err) {
      // Surface, never hide. Dialog stays open so the user can retry/cancel.
      if (onError) onError(err);
      else toast(apiError(err), 'danger');
    } finally {
      if (mounted.current) setBusy(false);
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
          disabled={confirmDisabled}
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
