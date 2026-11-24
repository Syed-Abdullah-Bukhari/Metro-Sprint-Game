import type { HudState } from '../game/engine';
import { ICON_COLORS, ICON_KINDS, ICON_LABELS, iconURL } from '../game/icons';
import { CoinIcon, PauseIcon, SoundIcon } from './icons';

interface Props {
  hud: HudState;
  muted: boolean;
  onPause: () => void;
  onToggleSound: () => void;
}

export default function Hud({ hud, muted, onPause, onToggleSound }: Props) {
  const active = ICON_KINDS.filter((k) => hud.timers[k] > 0);
  const speedPct = Math.min(100, Math.max(0, ((hud.speed - 18) / (56 - 18)) * 100));

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {/* danger vignette */}
      {hud.stumble && (
        <div
          className="animate-danger absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(255,40,40,0.55) 100%)' }}
        />
      )}

      {/* top left: score */}
      <div className="absolute left-3 top-3 sm:left-6 sm:top-5">
        <div className="flex items-end gap-2">
          <div className="text-outline text-4xl font-black leading-none tracking-tight text-white sm:text-6xl">
            {hud.score.toLocaleString()}
          </div>
          {hud.mult > 1 && (
            <div className="animate-pop mb-1 rounded-lg bg-emerald-400 px-2 py-0.5 text-sm font-black text-emerald-950 shadow-[0_3px_0_#0f6a32] sm:text-lg">
              x{hud.mult}
            </div>
          )}
        </div>
        <div className="text-outline mt-1 text-xs font-bold uppercase tracking-widest text-white/80 sm:text-sm">
          Best {Math.max(hud.best, hud.score).toLocaleString()}
        </div>

        {/* active power-ups */}
        <div className="mt-3 flex flex-col gap-2">
          {active.map((k) => (
            <div key={k} className="animate-pop flex items-center gap-2">
              <div
                className="relative h-11 w-11 rounded-full p-[3px] sm:h-14 sm:w-14"
                style={{
                  background: `conic-gradient(${ICON_COLORS[k]} ${hud.timers[k] * 360}deg, rgba(255,255,255,0.18) 0deg)`,
                }}
              >
                <img src={iconURL(k)} alt={ICON_LABELS[k]} className="h-full w-full rounded-full bg-slate-900/70" />
              </div>
              <span className="text-outline hidden text-sm font-bold text-white sm:block">{ICON_LABELS[k]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* top center: level + progress */}
      <div className="absolute left-1/2 top-3 w-[112px] -translate-x-1/2 text-center sm:top-5 sm:w-64">
        <div className="flex items-center justify-center gap-2">
          <span
            className="rounded-lg px-2 py-0.5 text-xs font-black uppercase tracking-wider text-slate-900 shadow-[0_3px_0_rgba(0,0,0,0.35)] sm:text-base"
            style={{ background: hud.accent }}
          >
            Lvl {hud.level}
          </span>
          <span className="text-outline hidden truncate text-sm font-bold uppercase tracking-wide text-white sm:inline">
            {hud.theme}
          </span>
        </div>
        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full border border-white/40 bg-black/40">
          <div
            className="h-full rounded-full transition-[width] duration-150"
            style={{ width: `${Math.max(3, hud.levelProgress * 100)}%`, background: hud.accent }}
          />
        </div>
        <div className="text-outline mt-0.5 hidden text-[10px] font-bold uppercase tracking-[0.25em] text-white/70 sm:block">
          Next level
        </div>
      </div>

      {/* top right: controls + coins */}
      <div className="absolute right-3 top-3 flex flex-col items-end gap-2 sm:right-6 sm:top-5">
        <div className="pointer-events-auto flex gap-2">
          <button
            aria-label="Toggle sound"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleSound();
            }}
            className="btn-chunky flex h-11 w-11 items-center justify-center rounded-xl border-2 border-white/60 bg-sky-500 text-white shadow-[0_4px_0_#075985] sm:h-12 sm:w-12"
          >
            <SoundIcon muted={muted} className="h-5 w-5" />
          </button>
          <button
            aria-label="Pause"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            className="btn-chunky flex h-11 w-11 items-center justify-center rounded-xl border-2 border-white/60 bg-amber-400 text-amber-950 shadow-[0_4px_0_#b45309] sm:h-12 sm:w-12"
          >
            <PauseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center gap-2 rounded-full border-2 border-white/50 bg-slate-900/60 py-1 pl-1 pr-4 backdrop-blur-sm">
          <CoinIcon className="h-7 w-7 sm:h-8 sm:w-8" />
          <span className="text-outline text-xl font-black text-amber-300 sm:text-2xl">{hud.coins}</span>
        </div>
      </div>

      {/* speed bar */}
      <div className="absolute bottom-3 left-1/2 hidden w-60 -translate-x-1/2 sm:block">
        <div className="h-2 overflow-hidden rounded-full bg-black/35">
          <div
            className="h-full rounded-full bg-gradient-to-r from-lime-300 via-amber-300 to-rose-500 transition-[width] duration-200"
            style={{ width: `${8 + speedPct * 0.92}%` }}
          />
        </div>
        <div className="text-outline mt-1 text-center text-[11px] font-black uppercase tracking-[0.25em] text-white/80">
          {hud.kmh} km/h
        </div>
      </div>
      <div className="text-outline absolute bottom-3 left-3 text-sm font-black uppercase tracking-widest text-white/80 sm:hidden">
        {hud.kmh} km/h
      </div>

      {/* guard warning */}
      {hud.stumble && (
        <div className="animate-pop absolute bottom-24 left-1/2 -translate-x-1/2 sm:bottom-24">
          <div className="animate-pulse-soft whitespace-nowrap rounded-full border-2 border-white bg-red-600 px-4 py-1.5 text-sm font-black uppercase tracking-wider text-white shadow-[0_4px_0_#7f1d1d] sm:text-base">
            Watch out! Guard behind you
          </div>
        </div>
      )}

      {/* first-seconds hint */}
      {hud.score < 60 && hud.level === 1 && (
        <div className="animate-slide-up absolute inset-x-0 bottom-16 flex justify-center px-4 sm:bottom-14">
          <div className="rounded-2xl border-2 border-white/30 bg-slate-900/60 px-4 py-2 text-center text-sm font-bold text-white backdrop-blur-sm">
            <span className="hidden sm:inline">← → switch lanes &nbsp;·&nbsp; ↑ / Space jump &nbsp;·&nbsp; ↓ roll</span>
            <span className="sm:hidden">Swipe ← → to switch lanes · ↑ to jump · ↓ to roll</span>
          </div>
        </div>
      )}
    </div>
  );
}
