import { CHARACTERS } from '../game/characters';
import { levelInfo, type QualityPref } from '../game/engine';
import { ICON_KINDS, ICON_LABELS, iconURL } from '../game/icons';
import { CoinIcon, KeyCap, PlayIcon, SoundIcon } from './icons';

interface Props {
  best: number;
  total: number;
  charIdx: number;
  maxLevel: number;
  selLevel: number;
  quality: { pref: QualityPref; effective: 'high' | 'low' };
  muted: boolean;
  onChar: (i: number) => void;
  onLevel: (l: number) => void;
  onQuality: () => void;
  onPlay: () => void;
  onToggleSound: () => void;
}

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

const Q_LABEL: Record<QualityPref, string> = { auto: 'Auto', high: 'High', low: 'Low' };

export default function Menu({
  best,
  total,
  charIdx,
  maxLevel,
  selLevel,
  quality,
  muted,
  onChar,
  onLevel,
  onQuality,
  onPlay,
  onToggleSound,
}: Props) {
  const info = levelInfo(selLevel);
  return (
    <div className="pointer-events-none absolute inset-0 flex items-end justify-center p-3 sm:p-6 md:items-center md:justify-start md:pl-14">
      <div className="pointer-events-auto absolute right-3 top-3 flex items-center gap-2 sm:right-6 sm:top-5">
        <button
          onClick={onQuality}
          title="Graphics quality"
          className="btn-chunky flex h-12 items-center gap-2 rounded-xl border-2 border-white/60 bg-violet-500 px-3 text-sm font-black uppercase tracking-wide text-white shadow-[0_4px_0_#5b21b6]"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 3 1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4z" />
            <path d="m19 15 .8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
          </svg>
          <span className="hidden sm:inline">Graphics:</span> {Q_LABEL[quality.pref]}
          {quality.pref === 'auto' && <span className="hidden text-[10px] opacity-80 sm:inline">({quality.effective})</span>}
        </button>
        <button
          aria-label="Toggle sound"
          onClick={onToggleSound}
          className="btn-chunky flex h-12 w-12 items-center justify-center rounded-xl border-2 border-white/60 bg-sky-500 text-white shadow-[0_4px_0_#075985]"
        >
          <SoundIcon muted={muted} className="h-6 w-6" />
        </button>
      </div>

      <div className="animate-slide-up pointer-events-auto max-h-full w-full max-w-md overflow-y-auto rounded-[2rem] border-4 border-white/25 bg-slate-950/70 p-5 shadow-2xl backdrop-blur-md [scrollbar-width:none] sm:p-6 [@media(max-height:800px)]:p-4">
        <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-fuchsia-500/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
          Endless rail runner
        </div>
        <h1 className="title-3d -rotate-2 text-6xl font-black uppercase leading-[0.9] text-yellow-300 sm:text-7xl [@media(max-height:800px)]:text-5xl">
          Metro
          <br />
          <span className="bg-gradient-to-b from-lime-200 to-emerald-400 bg-clip-text text-transparent" style={{ WebkitTextStroke: '2px rgba(5,60,30,0.6)' }}>
            Sprint
          </span>
        </h1>

        {/* stats */}
        <div className="mt-4 grid grid-cols-2 gap-3 [@media(max-height:800px)]:mt-3">
          <div className="rounded-2xl bg-white/10 px-4 py-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Best score</div>
            <div className="text-2xl font-black text-white">{best.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total coins</div>
            <div className="flex items-center gap-2 text-2xl font-black text-amber-300">
              <CoinIcon className="h-6 w-6" />
              {total.toLocaleString()}
            </div>
          </div>
        </div>

        {/* level select */}
        <div className="mt-4 [@media(max-height:800px)]:mt-3">
          <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <span>Start level</span>
            <span>
              Unlocked {maxLevel}
            </span>
          </div>
          <div className="flex items-stretch gap-2">
            <button
              aria-label="Previous level"
              disabled={selLevel <= 1}
              onClick={() => onLevel(selLevel - 1)}
              className="btn-chunky w-11 rounded-xl border-2 border-white/30 bg-white/10 text-2xl font-black text-white disabled:opacity-30"
            >
              ‹
            </button>
            <div
              key={selLevel}
              className="animate-pop flex-1 rounded-2xl border-2 px-3 py-2 text-center"
              style={{ borderColor: info.accent, background: `${info.accent}22` }}
            >
              <div className="text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: info.accent }}>
                Level {selLevel}
              </div>
              <div className="text-lg font-black uppercase leading-tight text-white">{info.name}</div>
              <div className="text-[11px] font-semibold leading-snug text-slate-300">{info.twist}</div>
            </div>
            <button
              aria-label="Next level"
              disabled={selLevel >= maxLevel}
              onClick={() => onLevel(selLevel + 1)}
              className="btn-chunky w-11 rounded-xl border-2 border-white/30 bg-white/10 text-2xl font-black text-white disabled:opacity-30"
            >
              ›
            </button>
          </div>
          {maxLevel === 1 && (
            <div className="mt-1.5 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Reach level 2 to unlock the next world
            </div>
          )}
        </div>

        {/* characters */}
        <div className="mt-4 [@media(max-height:800px)]:mt-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Choose your runner</div>
          <div className="grid grid-cols-4 gap-2">
            {CHARACTERS.map((c, i) => (
              <button
                key={c.name}
                onClick={() => onChar(i)}
                className={`btn-chunky flex flex-col items-center gap-1 rounded-2xl border-2 px-1 py-1.5 text-xs font-bold ${
                  i === charIdx
                    ? 'border-yellow-300 bg-yellow-300/20 text-yellow-200 shadow-[0_0_0_3px_rgba(253,224,71,0.25)]'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                <span
                  className="relative h-8 w-8 overflow-hidden rounded-full border-2 border-white/70"
                  style={{ background: `linear-gradient(180deg, ${hex(c.cap)} 0 34%, ${hex(c.skin)} 34% 50%, ${hex(c.jacket)} 50% 100%)` }}
                />
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* play */}
        <button
          onClick={onPlay}
          className="btn-chunky animate-pulse-soft mt-4 flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-white/70 bg-gradient-to-b from-yellow-300 to-amber-400 py-3 text-3xl font-black uppercase tracking-wide text-amber-950 shadow-[0_7px_0_#b45309]"
        >
          <PlayIcon className="h-8 w-8" /> Play
        </button>
        <div className="mt-2 text-center text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Press <span className="text-white">Enter</span> to start
        </div>

        {/* controls */}
        <div className="mt-4 hidden grid-cols-2 gap-x-4 gap-y-2 text-xs font-semibold text-slate-300 sm:grid [@media(max-height:860px)]:hidden">
          <div className="flex items-center gap-2">
            <KeyCap>←</KeyCap>
            <KeyCap>→</KeyCap> Switch lane
          </div>
          <div className="flex items-center gap-2">
            <KeyCap>↑</KeyCap>
            <KeyCap>Space</KeyCap> Jump
          </div>
          <div className="flex items-center gap-2">
            <KeyCap>↓</KeyCap> Roll / slam down
          </div>
          <div className="flex items-center gap-2">
            <KeyCap>P</KeyCap> Pause
          </div>
        </div>
        <div className="mt-4 text-center text-xs font-semibold text-slate-300 sm:hidden">
          Swipe left / right to change lanes, up to jump, down to roll
        </div>

        {/* power-ups */}
        <div className="mt-4 flex items-center justify-between gap-1 border-t border-white/10 pt-3 [@media(max-height:900px)]:hidden">
          {ICON_KINDS.map((k) => (
            <div key={k} className="flex flex-col items-center gap-1 text-center">
              <img src={iconURL(k)} alt="" className="h-8 w-8" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{ICON_LABELS[k]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
