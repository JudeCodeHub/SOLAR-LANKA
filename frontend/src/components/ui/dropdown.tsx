"use client";

import { ChevronDown } from "lucide-react";
import { Children, type ComponentProps, Fragment, isValidElement, type KeyboardEvent, type ReactNode, useEffect, useCallback, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

interface Choice {
  value: string;
  label: string;
  disabled: boolean;
}

/** The `<option>` elements among the children, in order, however they are nested in fragments or groups. */
function choicesOf(children: ReactNode, found: Choice[] = []): Choice[] {
  Children.forEach(children, (child) => {
    if (!isValidElement<{ value?: string; disabled?: boolean; children?: ReactNode }>(child)) return;
    if (child.type === "option") {
      const label = Children.toArray(child.props.children).join("");
      found.push({ value: String(child.props.value ?? label), label, disabled: Boolean(child.props.disabled) });
    } else if (child.type === Fragment || child.type === "optgroup" || child.props.children) {
      choicesOf(child.props.children, found);
    }
  });
  return found;
}

/** Only the classes that place the control (width, margins, flex) are kept; the look comes from the dropdown's own styles. */
const LAYOUT = /^(?:(?:sm|md|lg|xl):)?(?:w-|min-w-|max-w-|flex|grow|shrink|self-|m[tblrxy]?-|basis-)/;

/**
 * A drop-in replacement for `<select>` with a custom list: the button fills with orange from the left as you point at it, its arrow turns over, and the list drops down under it with an orange outline and options that fill the same way.
 * The real select stays in the page, hidden, as the source of truth, so forms, react-hook-form and onChange handlers work exactly as before; the visible button takes its id so a label still points at it.
 */
export function Dropdown({ children, className, id, value, defaultValue, onChange, onBlur, disabled, ref, name, "aria-invalid": invalid, "aria-describedby": describedBy, "aria-required": required, ...rest }: ComponentProps<"select">) {
  const choices = choicesOf(children);
  const wrapper = useRef<HTMLDivElement>(null);
  const select = useRef<HTMLSelectElement | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const watchers = useRef(new Set<() => void>());
  const subscribe = useCallback((notify: () => void) => {
    watchers.current.add(notify);
    return () => {
      watchers.current.delete(notify);
    };
  }, []);
  const fallback = String(defaultValue ?? choices[0]?.value ?? "");
  const nativeValue = useSyncExternalStore(subscribe, () => select.current?.value ?? fallback, () => fallback);
  const tell = () => watchers.current.forEach((notify) => notify());

  const setSelect = (element: HTMLSelectElement | null) => {
    select.current = element;
    if (typeof ref === "function") ref(element);
    else if (ref) ref.current = element;
  };

  // A form library sets the value straight on the hidden select: notice it, so the button shows the new choice.
  useLayoutEffect(() => {
    const element = select.current;
    if (!element) return undefined;
    const original = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
    if (!original?.get || !original.set) return undefined;
    Object.defineProperty(element, "value", {
      configurable: true,
      get: () => original.get!.call(element) as string,
      set: (next: string) => {
        original.set!.call(element, next);
        tell();
      },
    });
    tell();
    return () => {
      delete (element as { value?: string }).value;
    };
  }, []);

  const current = value !== undefined ? String(value) : nativeValue;
  const shown = choices.find((choice) => choice.value === current) ?? choices[0];

  const close = (focusTrigger: boolean) => {
    setOpen(false);
    if (focusTrigger) trigger.current?.focus();
  };

  const choose = (choice: Choice) => {
    if (choice.disabled) return;
    const element = select.current;
    if (element && element.value !== choice.value) {
      element.value = choice.value;
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }
    close(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const away = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    const selected = list.current?.querySelector<HTMLElement>("[aria-selected='true']") ?? list.current?.querySelector<HTMLElement>("[role='option']");
    selected?.focus();
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const onTriggerKey = (event: KeyboardEvent) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
    }
  };

  const onOptionKey = (event: KeyboardEvent, index: number) => {
    const options = [...(list.current?.querySelectorAll<HTMLElement>("[role='option']:not([aria-disabled='true'])") ?? [])];
    const at = options.indexOf(event.currentTarget as HTMLElement);
    const go = (target: number) => options[(target + options.length) % options.length]?.focus();
    if (event.key === "ArrowDown") go(at + 1);
    else if (event.key === "ArrowUp") go(at - 1);
    else if (event.key === "Home") go(0);
    else if (event.key === "End") go(options.length - 1);
    else if (event.key === "Enter" || event.key === " ") choose(choices[index]!);
    else if (event.key === "Escape") close(true);
    else if (event.key === "Tab") setOpen(false);
    else if (event.key.length === 1) {
      const typed = event.key.toLowerCase();
      options.find((option, n) => n > at && option.textContent?.toLowerCase().startsWith(typed))?.focus();
      return;
    } else return;
    event.preventDefault();
  };

  return (
    <div
      ref={wrapper}
      className={cn("dropdown relative", (className ?? "").split(/\s+/).filter((token) => LAYOUT.test(token)).join(" "))}
      data-open={open ? "" : undefined}
      onMouseLeave={() => setOpen(false)}
      onBlur={(event) => {
        if (wrapper.current?.contains(event.relatedTarget as Node | null)) return;
        setOpen(false);
        if (select.current) onBlur?.({ target: select.current, type: "blur" } as never);
      }}
    >
      <select ref={setSelect} name={name} value={value} defaultValue={defaultValue} onChange={onChange} disabled={disabled} tabIndex={-1} aria-hidden className="sr-only" {...rest}>
        {children}
      </select>
      <button
        ref={trigger}
        type="button"
        role="combobox"
        id={id}
        className="dropdown__trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        aria-required={required}
        onClick={() => setOpen((was) => !was)}
        onKeyDown={onTriggerKey}
      >
        <span className={cn("dropdown__value", shown?.value === "" && "dropdown__placeholder")}>{shown?.label}</span>
        <ChevronDown aria-hidden className="dropdown__arrow" />
      </button>
      {open ? (
        <div ref={list} id={listId} role="listbox" className="dropdown__panel">
          {choices.map((choice, index) => (
            <div
              key={`${choice.value}-${index}`}
              role="option"
              tabIndex={-1}
              aria-selected={choice.value === current}
              aria-disabled={choice.disabled || undefined}
              className="dropdown__option"
              onClick={() => choose(choice)}
              onKeyDown={(event) => onOptionKey(event, index)}
            >
              <span>{choice.label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
