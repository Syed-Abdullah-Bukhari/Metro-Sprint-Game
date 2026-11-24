import type { RunResult } from '../game/engine';
import { CoinIcon, HomeIcon, PlayIcon, RetryIcon } from './icons';

export function PauseOverlay({ onResume, onQuit }: { onResume: () => void; onQuit: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="animate-pop max-h-full w-full max-w-sm overflow-y-auto rounded-[2rem] border-4 border-white/25 bg-slate-900/90 p-7 text-center shadow-2xl">
        <h2 className="title-3d text-5xl font-black uppercase text-yellow-300">Paused</h2>
        <p className="mt-2 text-sm text-slate-300">Take a breath. The guard is waiting.</p>
        <button
          autoFocus
          onClick={onResume}
          className="btn-chunky mt-6 flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-white/70 bg-gradient-to-b from-lime-300 to-emerald-500 py-3 text-2xl font-black uppercase text-emerald-950 shadow-[0_6px_0_#047857]"
        >
          <PlayIcon className="h-7 w-7" /> Resume
        </button>
        <button
          onClick={onQuit}
          className="btn-chunky mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-white/40 bg-slate-700 py-2.5 text-lg font-bold uppercase text-white shadow-[0_5px_0_#1e293b]"
        >
          <HomeIcon className="h-5 w-5" /> Quit to menu
        </button>
        <div className="mt-4 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Press P or Esc to resume
        </div>
      </div>
    </div>
  );
}

export function GameOverOverlay({
  result,
  onRetry,
  onMenu,
}: {
  result: RunResult;
  onRetry: () => void;
  onMenu: () => void;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-red-950/70 via-slate-950/70 to-slate-950/85 p-4 backdrop-blur-sm">
      <div className="animate-pop max-h-full w-full max-w-sm overflow-y-auto rounded-[2rem] border-4 border-white/25 bg-slate-900/90 p-6 text-center shadow-2xl sm:p-7">
        <h2 className="title-3d -rotate-1 text-5xl font-black uppercase text-red-400 sm:text-6xl">Busted!</h2>
        <p className="mt-1 text-sm text-slate-300">The guard caught up with you.</p>

        {result.newBest && (
          <div className="animate-pulse-soft mx-auto mt-4 inline-block rounded-full border-2 border-white bg-gradient-to-r from-fuchsia-500 to-orange-400 px-4 py-1 text-sm font-black uppercase tracking-widest text-white shadow-[0_4px_0_#86198f]">
            ★ New best! ★
          </div>
        )}

        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1 text-sm font-black uppercase tracking-wider text-sky-200">
          Reached level {result.level} · {result.levelName} · {result.kmh} km/h
        </div>

        <div className="mt-3 rounded-2xl bg-white/10 px-4 py-3">
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Score</div>
          <div className="text-5xl font-black text-white">{result.score.toLocaleString()}</div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white/10 px-2 py-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Coins</div>
            <div className="flex items-center justify-center gap-1.5 text-xl font-black text-amber-300">
              <CoinIcon className="h-5 w-5" />
              {result.coins}
            </div>
          </div>
          <div className="rounded-2xl bg-white/10 px-2 py-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Distance</div>
            <div className="text-xl font-black text-sky-300">{result.distance.toLocaleString()}m</div>
          </div>
          <div className="rounded-2xl bg-white/10 px-2 py-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Best</div>
            <div className="text-xl font-black text-lime-300">{result.best.toLocaleString()}</div>
          </div>
        </div>

        <button
          autoFocus
          onClick={onRetry}
          className="btn-chunky mt-6 flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-white/70 bg-gradient-to-b from-yellow-300 to-amber-400 py-3 text-2xl font-black uppercase text-amber-950 shadow-[0_6px_0_#b45309]"
        >
          <RetryIcon className="h-6 w-6" /> Run again
        </button>
        <button
          onClick={onMenu}
          className="btn-chunky mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-white/40 bg-slate-700 py-2.5 text-lg font-bold uppercase text-white shadow-[0_5px_0_#1e293b]"
        >
          <HomeIcon className="h-5 w-5" /> Menu
        </button>
        <div className="mt-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Press <span className="text-white">Enter</span> to run again
        </div>
      </div>
    </div>
  );
}
