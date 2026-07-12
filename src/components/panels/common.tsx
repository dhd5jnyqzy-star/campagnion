/**
 * Gemeinsame Bausteine der Peek-Panels (§4.2): Textfelder mit Commit bei
 * Blur/Enter (Events entstehen erst bei fertiger Eingabe — offene Eingabe-
 * felder sind der einzige "ungespeicherte Zustand", §3.1), Chips für
 * Verknüpfungen/Rückverweise und ein Picker zum Verknüpfen.
 */

import { useEffect, useState } from 'react';
import { useAppDispatch } from '../../app/hooks';
import { peekClosed, peeked, type PeekKind } from '../../features/nav/navSlice';

/** Panelkopf: editierbarer Name + Schließen. */
export function PanelHead({
  name,
  onCommitName,
}: {
  name: string;
  onCommitName: (name: string) => void;
}) {
  const dispatch = useAppDispatch();
  const [local, setLocal] = useState(name);
  useEffect(() => setLocal(name), [name]);
  return (
    <div className="sidepanel-head">
      <input
        className="sidepanel-title"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          const trimmed = local.trim();
          if (trimmed && trimmed !== name) onCommitName(trimmed);
          else setLocal(name);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        aria-label="Name"
      />
      <button className="sidepanel-close" onClick={() => dispatch(peekClosed())}>
        ✕
      </button>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="sidepanel-section">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

interface TextFieldProps {
  label?: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  onCommit: (value: string) => void;
}

/** Freitextfeld; committet bei Blur (und Enter bei einzeiligen Feldern). */
export function TextField({ label, value, placeholder, multiline, onCommit }: TextFieldProps) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  const commit = () => {
    if (local !== value) onCommit(local);
  };
  const field = multiline ? (
    <textarea
      value={local}
      placeholder={placeholder}
      rows={4}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
    />
  ) : (
    <input
      type="text"
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
  return label ? (
    <label className="field">
      <span>{label}</span>
      {field}
    </label>
  ) : (
    field
  );
}

/** Zahlenfeld; committet bei Blur/Enter, ignoriert Unsinn. */
export function NumberField({
  label,
  value,
  min,
  max,
  step,
  onCommit,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onCommit: (value: number) => void;
}) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => setLocal(String(value)), [value]);
  const commit = () => {
    const n = Number(local.replace(',', '.'));
    if (Number.isFinite(n) && n !== value) {
      onCommit(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)));
    } else {
      setLocal(String(value));
    }
  };
  return (
    <label className="field field-number">
      <span>{label}</span>
      <input
        type="number"
        value={local}
        min={min}
        max={max}
        step={step}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}

export interface ChipItem {
  id: string;
  label: string;
  /** Peek-Ziel beim Antippen; weglassen = nicht antippbar. */
  peek?: PeekKind;
}

/** Verknüpfungs-Chips: antippen = Peek der Entität, ✕ = Verknüpfung lösen. */
export function Chips({
  items,
  onRemove,
  emptyText,
}: {
  items: ChipItem[];
  onRemove?: (id: string) => void;
  emptyText?: string;
}) {
  const dispatch = useAppDispatch();
  if (items.length === 0) {
    return emptyText ? <p className="muted">{emptyText}</p> : null;
  }
  return (
    <div className="chips">
      {items.map((item) => (
        <span key={item.id} className="chip">
          {item.peek ? (
            <button
              className="chip-label"
              onClick={() => dispatch(peeked({ kind: item.peek!, id: item.id }))}
            >
              {item.label}
            </button>
          ) : (
            <span className="chip-label">{item.label}</span>
          )}
          {onRemove && (
            <button className="chip-remove" onClick={() => onRemove(item.id)} aria-label="Lösen">
              ✕
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

/** Picker: bestehende Entität verknüpfen (Auswahl setzt sich selbst zurück). */
export function LinkAdder({
  placeholder,
  options,
  onAdd,
}: {
  placeholder: string;
  options: { id: string; label: string }[];
  onAdd: (id: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <select
      className="link-adder"
      value=""
      onChange={(e) => {
        if (e.target.value) onAdd(e.target.value);
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
