import type { ComponentChildren } from 'preact';
import type { SpaceColor } from '@notebook/core';
import { useEffect, useRef } from 'preact/hooks';
import { SPACE_COLORS } from '../format';

export const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) => (
  <button type="button" role="switch" aria-checked={checked} aria-label={label} class={`toggle ${checked ? 'toggle--on' : ''}`} onClick={() => onChange(!checked)}>
    <span class="toggle__knob" />
  </button>
);

export const Chip = ({ selected, onClick, children, dashed }: { selected?: boolean; onClick: () => void; children: ComponentChildren; dashed?: boolean }) => (
  <button type="button" class={`chip ${selected ? 'chip--selected' : ''} ${dashed ? 'chip--dashed' : ''}`} aria-pressed={selected ?? false} onClick={onClick}>
    {children}
  </button>
);

const COLORS = Object.keys(SPACE_COLORS) as SpaceColor[];

/** A row of colour choices. With `onAuto`, a first "Automatic" choice (value null) lets the app pick. */
export const ColorSwatches = ({ label, value, onChange, onAuto }: { label: string; value: SpaceColor | null; onChange: (color: SpaceColor) => void; onAuto?: () => void }) => (
  <div class="swatches" role="radiogroup" aria-label={label}>
    {onAuto ? <button type="button" role="radio" aria-checked={value === null} aria-label="Automatic" class={`swatch swatch--auto ${value === null ? 'swatch--selected' : ''}`} onClick={onAuto} /> : null}
    {COLORS.map((option) => <button key={option} type="button" role="radio" aria-checked={value === option} aria-label={option} class={`swatch ${value === option ? 'swatch--selected' : ''}`} style={{ background: SPACE_COLORS[option].swatch }} onClick={() => onChange(option)} />)}
  </div>
);

export const SectionLabel = ({ children }: { children: ComponentChildren }) => <span class="section-label">{children}</span>;

export const Card = ({ children, class: className = '' }: { children: ComponentChildren; class?: string }) => <section class={`card ${className}`}>{children}</section>;

export const Empty = ({ children }: { children: ComponentChildren }) => <p class="empty">{children}</p>;

/** Bottom sheet dialog using the native <dialog> element for focus handling and Escape. */
export const Sheet = ({ label, onClose, children }: { label: string; onClose: () => void; children: ComponentChildren }) => {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;

    if (dialog && !dialog.open) {
      dialog.showModal();
    }

    return () => dialog?.close();
  }, []);

  return (
    <dialog ref={ref} class="sheet" aria-label={label} onCancel={(event) => {
      event.preventDefault();
      onClose();
    }} onClick={(event) => {
      if (event.target === ref.current) {
        onClose();
      }
    }}>
      <div class="sheet__body">
        <div class="sheet__grip" aria-hidden="true" />
        {children}
      </div>
    </dialog>
  );
};

export const SheetHeader = ({ title, onCancel, action }: { title: string; onCancel: () => void; action?: { label: string; onClick: () => void; disabled?: boolean } }) => (
  <div class="sheet__header">
    <button type="button" class="link-button" onClick={onCancel}>Cancel</button>
    <h2 class="sheet__title">{title}</h2>
    {action ? <button type="button" class="pill-button" disabled={action.disabled} onClick={action.onClick}>{action.label}</button> : <span class="sheet__spacer" />}
  </div>
);
