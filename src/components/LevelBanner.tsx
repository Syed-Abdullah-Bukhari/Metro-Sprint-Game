import type { LevelInfo } from '../game/engine';

/** Slim banner that sits at the top of the screen so the track stays fully visible. */
export default function LevelBanner({ info }: { info: LevelInfo }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[58px] flex justify-center px-3 sm:top-[96px]">
      <div className="animate-banner flex max-w-[94vw] items-center gap-3 rounded-2xl border-2 border-white/35 bg-slate-950/60 px-2.5 py-2 shadow-xl backdrop-blur-sm sm:max-w-xl sm:gap-4 sm:px-4 sm:py-2.5">
        <div
          className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl text-slate-900 shadow-[0_3px_0_rgba(0,0,0,0.35)] sm:h-14 sm:w-14"
          style={{ background: info.accent }}
        >
          <span className="text-[8px] font-black uppercase leading-none tracking-widest sm:text-[9px]">
            {info.start ? 'Start' : 'Level'}
          </span>
          <span className="text-xl font-black leading-none sm:text-3xl">{info.level}</span>
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-black uppercase tracking-wide text-white sm:text-xl" style={{ textShadow: `0 2px 0 ${info.accent}55` }}>
            {info.name}
          </div>
          <div className="text-[11px] font-semibold leading-snug text-white/85 sm:text-sm">{info.twist}</div>
          {info.bonus > 0 && (
            <div className="text-[11px] font-black uppercase tracking-wider text-amber-300 sm:text-xs">
              Level up! +{info.bonus.toLocaleString()} bonus
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
