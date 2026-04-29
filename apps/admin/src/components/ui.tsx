// ─────────────────────────────────────────────
//  Shared admin UI primitives
//  PageHeader · StatCard · EmptyState · StatusPill · DataTable · SkeletonRows
//  Toolbar · Segmented · Switch · ConfirmDialog · Modal
// ─────────────────────────────────────────────
import { ReactNode, useEffect, useState, type ComponentType } from 'react';
import { LucideIcon, X, AlertTriangle, Search, Loader2, Inbox } from 'lucide-react';
import clsx from 'clsx';

// ─── Page header ──────────────────────────────
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
  meta,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent ring-1 ring-accent/20 flex items-center justify-center shrink-0">
            <Icon size={20} strokeWidth={2.25} />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="text-muted text-sm mt-0.5">{subtitle}</p>
          )}
          {meta && <div className="mt-2">{meta}</div>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

// ─── Stat cards (KPI blocks) ──────────────────
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'accent',
}: {
  icon?: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'accent' | 'success' | 'danger' | 'warning' | 'info';
}) {
  const toneClasses = {
    accent:  'bg-accent/10 text-accent ring-accent/20',
    success: 'bg-success/10 text-success ring-success/20',
    danger:  'bg-danger/10 text-danger ring-danger/20',
    warning: 'bg-warning/10 text-warning ring-warning/20',
    info:    'bg-info/10 text-info ring-info/20',
  }[tone];
  return (
    <div className="stat-card">
      {Icon && (
        <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ring-1', toneClasses)}>
          <Icon size={20} strokeWidth={2.25} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold text-muted uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold tracking-tight mt-0.5 truncate">{value}</p>
        {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────
export function EmptyState({
  icon: Icon = Inbox,
  title,
  message,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-16 h-16 rounded-2xl bg-elevated/60 ring-1 ring-line flex items-center justify-center mb-4">
        <Icon size={28} className="text-muted" />
      </div>
      <p className="text-base font-semibold text-zinc-200">{title}</p>
      {message && <p className="text-sm text-muted mt-1 max-w-sm">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── Error inline banner ──────────────────────
export function InlineError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm animate-fade-in">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

// ─── Loading skeleton (rows) ──────────────────
export function SkeletonRows({ rows = 5, height = 48 }: { rows?: number; height?: number }) {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton w-full" style={{ height }} />
      ))}
    </div>
  );
}

// ─── Spinner ──────────────────────────────────
export function Spinner({ size = 16 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin text-accent" />;
}

// ─── Status pill (auto color) ─────────────────
type StatusKey =
  | 'PENDING' | 'APPROVED' | 'REJECTED' | 'RESOLVED'
  | 'ACTIVE'  | 'INACTIVE' | 'BANNED'   | 'DELETED'
  | 'DRAFT'   | 'SCHEDULED'| 'SENDING'  | 'SENT'    | 'CANCELLED'
  | 'OPEN'    | 'CLOSED'   | 'IN_PROGRESS'
  | 'CONFIRMED' | 'NO_SHOW'
  | string;

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'pill-warning',
  APPROVED: 'pill-success',
  REJECTED: 'pill-danger',
  RESOLVED: 'pill-success',
  ACTIVE: 'pill-success',
  INACTIVE: 'pill-muted',
  BANNED: 'pill-danger',
  DELETED: 'pill-muted',
  DRAFT: 'pill-muted',
  SCHEDULED: 'pill-info',
  SENDING: 'pill-warning',
  SENT: 'pill-success',
  CANCELLED: 'pill-muted',
  OPEN: 'pill-info',
  CLOSED: 'pill-muted',
  IN_PROGRESS: 'pill-warning',
  CONFIRMED: 'pill-success',
  NO_SHOW: 'pill-danger',
  PUBLISHED: 'pill-success',
  ARCHIVED: 'pill-muted',
  USER: 'pill-muted',
  MODERATOR: 'pill-info',
  ADMIN: 'pill-accent',
  SUPER_ADMIN: 'pill-accent',
};

export function StatusPill({ status, label }: { status: StatusKey; label?: string }) {
  const cls = STATUS_CLASS[status?.toUpperCase?.()] ?? 'pill-muted';
  return <span className={cls}>{label ?? status}</span>;
}

// ─── Toolbar (filters/search container) ───────
export function Toolbar({
  search,
  onSearch,
  searchPlaceholder = 'Buscar…',
  children,
}: {
  search?: string;
  onSearch?: (v: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
}) {
  return (
    <div className="toolbar">
      {onSearch && (
        <div className="relative flex-1 min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search ?? ''}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="input-search"
          />
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Segmented control ────────────────────────
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[] | { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={clsx('seg-btn', value === o.value && 'seg-btn--active')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Toggle switch ────────────────────────────
export function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={clsx('switch', checked ? 'switch--on' : 'switch--off', disabled && 'opacity-40 cursor-not-allowed')}
      aria-pressed={checked}
    >
      <span className="switch__thumb" />
    </button>
  );
}

// ─── Modal (light wrapper) ────────────────────
export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const w = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl' }[size];
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className={clsx('w-full bg-card border border-line rounded-2xl shadow-soft p-6 space-y-4', w)}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight">{title}</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-elevated text-muted hover:text-zinc-200">
              <X size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// ─── Confirm dialog (small) ───────────────────
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      {message && <p className="text-sm text-muted">{message}</p>}
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onClose} className="btn-ghost flex-1">
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() => { onConfirm(); onClose(); }}
          className={destructive ? 'btn-danger flex-1' : 'btn-primary flex-1'}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

// ─── Field (form label + input) ───────────────
export function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  rows,
  hint,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  rows?: number;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold text-muted tracking-wider uppercase">
        {label}
        {required && <span className="text-danger ml-1">*</span>}
      </span>
      {rows ? (
        <textarea
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="input-field mt-1.5"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="input-field mt-1.5"
        />
      )}
      {hint && <p className="text-[11px] text-muted mt-1">{hint}</p>}
    </label>
  );
}

// ─── Hook: debounced state ────────────────────
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

// ─── Re-export with Pencil convenience for icon usage ──
export type { ComponentType };
