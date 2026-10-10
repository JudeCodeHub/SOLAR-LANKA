"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useLayoutEffect, useRef } from "react";

import { NAV_ICONS } from "@/components/shell/nav-icons";
import { type SidebarCategory, locate } from "@/lib/navigation";
import { saveSidebarState, useSidebarState } from "@/lib/shell-state";
import { cn } from "@/lib/utils";
import { format, messages } from "@/messages";

/** Measures of the branch drawing, in px; they match the CSS variables of the same names. */
const PAD = 6;
const MARK = 16;
const ROW = 36;
const INDENT = 40;
const TRUNK = 14;
const RADIUS = 10;

const radius = Math.min(RADIUS, ROW / 2 - 2);
const endX = INDENT - 8;
const rowY = (k: number) => PAD + k * ROW + ROW / 2;
const branch = (k: number) => `M ${TRUNK} ${rowY(k) - radius} A ${radius} ${radius} 0 0 0 ${TRUNK + radius} ${rowY(k)} H ${endX}`;
const reach = (k: number) => `M ${TRUNK} 0 V ${rowY(k) - radius} A ${radius} ${radius} 0 0 0 ${TRUNK + radius} ${rowY(k)} H ${endX}`;
const length = (k: number) => rowY(k) - radius + (Math.PI * radius) / 2 + (endX - TRUNK - radius);

/** The sidebar's categories as a branching tree (the "BranchedMenu" idea from React Bits, written for this app): a thin rail runs down the left, each category folds open to show its links on curved branches off a trunk, and an orange line draws itself along the branch to the page you are on while a small orange marker glides to that category's name. */
export function BranchedNav({ categories, pathname, onNavigate }: { categories: readonly SidebarCategory[]; pathname: string; onNavigate?: () => void }) {
  const state = useSidebarState();
  const place = locate(pathname, categories);
  const navRef = useRef<HTMLElement>(null);
  const heads = useRef<(HTMLElement | null)[]>([]);
  const marker = useRef<HTMLSpanElement>(null);

  const activeIndex = categories.findIndex((category) => category.id === place?.category.id);
  const openOf = (category: SidebarCategory) => state.overrides[category.id] ?? place?.category.id === category.id;
  const active = activeIndex >= 0 ? categories[activeIndex] : undefined;
  const markerShown = active !== undefined && (active.items.length === 1 || openOf(active));
  const signature = categories.map((category) => `${category.id}:${openOf(category)}`).join("|");

  useLayoutEffect(() => {
    const place = (glide: boolean) => {
      const mark = marker.current;
      const head = heads.current[activeIndex];
      if (!mark) return;
      const on = markerShown && head;
      if (!glide) mark.style.transition = "none";
      if (on) mark.style.top = `${head.offsetTop + (head.offsetHeight - MARK) / 2}px`;
      mark.toggleAttribute("data-on", Boolean(on));
      if (!glide) {
        void mark.offsetHeight;
        mark.style.transition = "";
      }
    };
    place(true);
    let first = true;
    const observer = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      place(false);
    });
    if (navRef.current) observer.observe(navRef.current);
    return () => observer.disconnect();
  }, [activeIndex, markerShown, signature]);

  return (
    <nav ref={navRef} className="branched-menu" data-branched-menu>
      <span ref={marker} className="branched-menu__marker" aria-hidden />
      {categories.map((category, index) => {
        const single = category.items.length === 1 ? category.items[0] : undefined;
        const open = openOf(category);
        const here = place?.category.id === category.id;
        const bodyHeight = PAD * 2 + category.items.length * ROW;
        return (
          <div key={category.id} className="branched-menu__section" data-open={!single && open ? "" : undefined} data-category={category.id}>
            {single ? (
              <Link
                ref={(element) => {
                  heads.current[index] = element;
                }}
                href={single.href}
                onClick={onNavigate}
                aria-current={here ? "page" : undefined}
                data-active={here ? "" : undefined}
                className="branched-menu__head"
              >
                {category.label}
              </Link>
            ) : (
              <>
                <button
                  ref={(element) => {
                    heads.current[index] = element;
                  }}
                  type="button"
                  aria-expanded={open}
                  aria-controls={`branch-${category.id}`}
                  aria-label={format(messages.shell.toggleCategory, { category: category.label })}
                  data-active={here ? "" : undefined}
                  className="branched-menu__head"
                  onClick={() => saveSidebarState({ ...state, overrides: { ...state.overrides, [category.id]: !open } })}
                >
                  <span className="flex-1 truncate">{category.label}</span>
                  <ChevronDown aria-hidden className={cn("mr-1 size-4 shrink-0 text-ink-3 transition-transform duration-300 motion-reduce:transition-none", open ? "rotate-180" : "")} />
                </button>
                <div className="branched-menu__body" id={`branch-${category.id}`}>
                  <div className="branched-menu__fold" inert={!open}>
                    <div className="branched-menu__tree" style={{ height: bodyHeight }}>
                      <svg className="branched-menu__lines" width={INDENT} height={bodyHeight} aria-hidden>
                        <path className="branched-menu__base" d={`M ${TRUNK} 0 V ${rowY(category.items.length - 1) - radius}`} />
                        {category.items.map((entry, k) => (
                          <path key={entry.id} className="branched-menu__base" d={branch(k)} />
                        ))}
                        {category.items.map((entry, k) => (
                          <path key={entry.id} className="branched-menu__reach" d={reach(k)} style={{ strokeDasharray: length(k), strokeDashoffset: place?.item.id === entry.id ? 0 : length(k) }} />
                        ))}
                      </svg>
                      {category.items.map((entry) => {
                        const Icon = NAV_ICONS[entry.id];
                        const current = place?.item.id === entry.id;
                        return (
                          <Link
                            key={entry.id}
                            href={entry.href}
                            onClick={onNavigate}
                            aria-current={current ? "page" : undefined}
                            data-active={current ? "" : undefined}
                            tabIndex={open ? 0 : -1}
                            className="branched-menu__item"
                          >
                            {Icon ? <Icon aria-hidden className="branched-menu__icon" /> : null}
                            <span className="branched-menu__label">{entry.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}
    </nav>
  );
}
