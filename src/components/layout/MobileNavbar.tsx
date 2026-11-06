import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Home, Package, QrCode, ArrowLeftRight, MoreHorizontal } from 'lucide-react';

export type MobileTab = 'beranda' | 'inventaris' | 'pindai' | 'transaksi' | 'lainnya';

interface MobileNavbarProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  onOpenScanner: () => void;
}

// Geometry (px)
const TOP = 30; // y of the bar's top edge (space above for the floating bubble)
const BAR_H = 62; // bar height
const TOTAL_H = TOP + BAR_H;
const CORNER = 22; // bar corner radius
const NOTCH_HW = 48; // half-width of the notch at the top edge
const NOTCH_D = 28; // notch depth
const BUBBLE = 46; // bubble diameter
const BUBBLE_TOP = 3; // bubble top offset
const PAD_X = 12; // horizontal padding of the tab row

const buildPath = (w: number, cx: number) => {
  const r = CORNER;
  const T = TOP;
  const B = TOTAL_H;
  const x = Math.min(Math.max(cx, r), w - r);
  const l = Math.max(x - NOTCH_HW, r);
  const rr = Math.min(x + NOTCH_HW, w - r);
  const leftWidth = x - l;
  const rightWidth = rr - x;
  const d = NOTCH_D;
  return [
    `M 0,${T + r}`,
    `A ${r} ${r} 0 0 1 ${r},${T}`,
    `L ${l},${T}`,
    `C ${l + leftWidth * 0.35},${T} ${x - leftWidth * 0.38},${T + d} ${x},${T + d}`,
    `C ${x + rightWidth * 0.38},${T + d} ${rr - rightWidth * 0.35},${T} ${rr},${T}`,
    `L ${w - r},${T}`,
    `A ${r} ${r} 0 0 1 ${w},${T + r}`,
    `L ${w},${B - r}`,
    `A ${r} ${r} 0 0 1 ${w - r},${B}`,
    `L ${r},${B}`,
    `A ${r} ${r} 0 0 1 0,${B - r}`,
    'Z',
  ].join(' ');
};

export const MobileNavbar: React.FC<MobileNavbarProps> = ({
  activeTab,
  onTabChange,
  onOpenScanner,
}) => {
  const tabs = [
    { id: 'beranda', label: 'Beranda', icon: Home },
    { id: 'inventaris', label: 'Inventaris', icon: Package },
    { id: 'pindai', label: 'Pindai', icon: QrCode },
    { id: 'transaksi', label: 'Transaksi', icon: ArrowLeftRight },
    { id: 'lainnya', label: 'Lainnya', icon: MoreHorizontal },
  ] as const;

  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.id === activeTab)
  );
  const ActiveIcon = tabs[activeIndex].icon;

  const wrapRef = useRef<HTMLDivElement>(null);
  const clipPathRef = useRef<SVGPathElement>(null);
  const shadowPathRef = useRef<SVGPathElement>(null);
  const strokePathRef = useRef<SVGPathElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  const [width, setWidth] = useState(0);
  const spring = useRef({ pos: 0, vel: 0, init: false });

  const targetFor = useCallback(
    (w: number, idx: number) => PAD_X + ((w - PAD_X * 2) * (idx + 0.5)) / tabs.length,
    [tabs.length]
  );

  const draw = useCallback((w: number, cx: number) => {
    const d = buildPath(w, cx);
    clipPathRef.current?.setAttribute('d', d);
    shadowPathRef.current?.setAttribute('d', d);
    strokePathRef.current?.setAttribute('d', d);
    if (bubbleRef.current) {
      bubbleRef.current.style.transform = `translate3d(${cx - BUBBLE / 2}px,0,0)`;
    }
  }, []);

  // Measure width
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Spring animation towards the active tab (slightly underdamped, iOS-like)
  useEffect(() => {
    if (!width) return;
    const target = targetFor(width, activeIndex);
    const s = spring.current;
    if (!s.init) {
      s.pos = target;
      s.vel = 0;
      s.init = true;
      draw(width, target);
      return;
    }

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      s.pos = target;
      s.vel = 0;
      draw(width, target);
      return;
    }

    const STIFFNESS = 220;
    const DAMPING = 24;
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.032);
      last = now;
      const force = -STIFFNESS * (s.pos - target) - DAMPING * s.vel;
      s.vel += force * dt;
      s.pos += s.vel * dt;
      draw(width, s.pos);
      if (Math.abs(s.pos - target) < 0.05 && Math.abs(s.vel) < 0.05) {
        s.pos = target;
        s.vel = 0;
        draw(width, target);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [activeIndex, width, draw, targetFor]);

  const w = width || 360;
  const initialPath = buildPath(w, targetFor(w, activeIndex));

  return (
    <nav
      aria-label="Navigasi Bawah Mobile"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-4 pointer-events-none"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}
    >
      <style>{`
        @keyframes nv-pop {
          0% { transform: scale(0.4) rotate(-12deg); opacity: 0; }
          60% { transform: scale(1.12) rotate(2deg); opacity: 1; }
          100% { transform: scale(1) rotate(0); opacity: 1; }
        }
      `}</style>

      <div
        ref={wrapRef}
        className="relative max-w-md mx-auto pointer-events-auto"
        style={{ height: TOTAL_H }}
      >
        {/* Soft shadow (outside the shape only, so the glass stays see-through) */}
        <svg
          aria-hidden="true"
          className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
          width={w}
          height={TOTAL_H}
        >
          <defs>
            <filter id="nv-shadow" x="-20%" y="-30%" width="140%" height="190%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="b" />
              <feOffset in="b" dy="10" result="o" />
              <feFlood floodColor="#0f172a" floodOpacity="0.2" />
              <feComposite in2="o" operator="in" result="s" />
              <feComposite in="s" in2="SourceAlpha" operator="out" />
            </filter>
            <clipPath id="nv-clip" clipPathUnits="userSpaceOnUse">
              <path ref={clipPathRef} d={initialPath} />
            </clipPath>
          </defs>
          <path ref={shadowPathRef} d={initialPath} fill="#000" filter="url(#nv-shadow)" />
        </svg>

        {/* Glass body, clipped to the notched shape */}
        <div
          className="absolute inset-0"
          style={{
            clipPath: 'url(#nv-clip)',
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.48) 100%)',
            WebkitBackdropFilter: 'blur(28px) saturate(180%)',
            backdropFilter: 'blur(28px) saturate(180%)',
          }}
        />

        {/* Glass edge highlight */}
        <svg
          aria-hidden="true"
          className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
          width={w}
          height={TOTAL_H}
        >
          <path
            ref={strokePathRef}
            d={initialPath}
            fill="none"
            stroke="rgba(255,255,255,0.75)"
            strokeWidth="1"
          />
        </svg>

        {/* Floating bubble */}
        <div
          ref={bubbleRef}
          aria-hidden="true"
          className="absolute left-0 pointer-events-none flex items-center justify-center rounded-full text-white"
          style={{
            top: BUBBLE_TOP,
            width: BUBBLE,
            height: BUBBLE,
            transform: `translate3d(${targetFor(w, activeIndex) - BUBBLE / 2}px,0,0)`,
            willChange: 'transform',
            background: 'linear-gradient(160deg, #2d6a4f 0%, #1b4332 100%)',
            border: '2px solid rgba(255,255,255,0.9)',
            boxShadow:
              '0 8px 18px rgba(27,67,50,0.38), inset 0 1px 0 rgba(255,255,255,0.28)',
          }}
        >
          <span
            key={activeTab}
            className="flex"
            style={{ animation: 'nv-pop 420ms cubic-bezier(0.32, 0.72, 0, 1) both' }}
          >
            <ActiveIcon className="w-[22px] h-[22px]" strokeWidth={2.1} />
          </span>
        </div>

        {/* Tabs */}
        <div
          className="absolute left-0 right-0 grid grid-cols-5"
          style={{ top: TOP, height: BAR_H, paddingInline: PAD_X }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'pindai') onOpenScanner();
                  onTabChange(tab.id as MobileTab);
                }}
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
                className="relative flex flex-col items-center justify-end gap-1 pb-2.5 cursor-pointer select-none rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 active:scale-90"
                style={{
                  transition: 'transform 250ms cubic-bezier(0.32, 0.72, 0, 1)',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <Icon
                  className="w-[22px] h-[22px]"
                  strokeWidth={1.8}
                  style={{
                    color: '#475569',
                    opacity: isActive ? 0 : 1,
                    transform: isActive ? 'translateY(-10px) scale(0.5)' : 'translateY(0) scale(1)',
                    transition:
                      'opacity 250ms ease, transform 400ms cubic-bezier(0.32, 0.72, 0, 1)',
                  }}
                />
                <span
                  className="text-[10px] leading-none"
                  style={{
                    color: isActive ? '#1b4332' : '#475569',
                    fontWeight: isActive ? 700 : 500,
                    transition: 'color 300ms ease',
                  }}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
