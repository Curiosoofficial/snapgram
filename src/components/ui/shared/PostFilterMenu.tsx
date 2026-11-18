import { useEffect, useRef, useState } from "react";

import { canFollow } from "@/lib/api";
import { postFilters } from "@/constants";
import { IPostFilter } from "@/types";

type PostFilterMenuProps = {
  value: IPostFilter;
  onChange: (value: IPostFilter) => void;
};

// Filter dropdown on the Explore page
const PostFilterMenu = ({ value, onChange }: PostFilterMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // close when clicking somewhere else or pressing Escape
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  // "Following" and "Popular" need the own backend or the offline demo
  if (!canFollow) return null;

  const current = postFilters.find((f) => f.value === value) ?? postFilters[0];

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="flex-center gap-3 bg-dark-3 rounded-xl px-4 py-2 cursor-pointer hover:bg-dark-4 transition"
      >
        <span className="small-medium md:base-medium text-light-2">{current.label}</span>
        <img src="/assets/icons/filter.svg" width={20} height={20} alt="" />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-40 rounded-xl border border-dark-4 bg-dark-3 p-1 z-30 shadow-lg"
        >
          {postFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              role="menuitemradio"
              aria-checked={filter.value === value}
              onClick={() => {
                onChange(filter.value);
                setIsOpen(false);
              }}
              className={`w-full text-left rounded-lg px-3 py-2 small-medium transition hover:bg-dark-4 ${
                filter.value === value ? "text-primary-500" : "text-light-2"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PostFilterMenu;
