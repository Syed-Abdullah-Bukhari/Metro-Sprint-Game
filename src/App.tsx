import { useCallback, useEffect, useRef, useState } from 'react';
import { Game, readStats, type HudState, type LevelInfo, type Phase, type QualityPref, type RunResult } from './game/engine';
import { audio } from './game/audio';
import Hud from './components/Hud';
import Menu from './components/Menu';
import LevelBanner from './components/LevelBanner';
import { GameOverOverlay, PauseOverlay } from './components/Overlays';

const INITIAL_HUD: HudState = {
  score: 0,
  coins: 0,
  best: 0,
  speed: 0,
  kmh: 0,
  mult: 1,
  timers: { magnet: 0, jetpack: 0, sneakers: 0, x2: 0 },
  stumble: false,
  level: 1,
  levelProgress: 0,
  theme: '',
  accent: '#ffd23f',
};

const NEXT_Q: Record<QualityPref, QualityPref> = { auto: 'high', high: 'low', low: 'auto' };

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const phaseRef = useRef<Phase>('menu');
  const selRef = useRef(1);

  const [phase, setPhase] = useState<Phase>('menu');
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [result, setResult] = useState<RunResult | null>(null);
  const [stats, setStats] = useState(readStats);
  const [muted, setMuted] = useState(audio.muted);
  const [glError, setGlError] = useState(false);
  const [selLevel, setSelLevel] = useState(1);
  const [banner, setBanner] = useState<(LevelInfo & { key: number }) | null>(null);
  const [quality, setQuality] = useState<{ pref: QualityPref; effective: 'high' | 'low' }>({ pref: 'auto', effective: 'high' });

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    let game: Game;
    try {
      game = new Game(el, {
        onHud: setHud,
        onPhase: (p) => {
          phaseRef.current = p;
          setPhase(p);
          if (p === 'over' || p === 'menu') {
            setStats(readStats());
            setQuality(game.getQuality());
          }
          if (p !== 'playing' && p !== 'paused') setBanner(null);
        },
        onOver: setResult,
        onLevel: (l) => setBanner({ ...l, key: Date.now() }),
      });
    } catch (err) {
      console.error(err);
      setGlError(true);
      return;
    }
    gameRef.current = game;
    setQuality(game.getQuality());
    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    audio.click();
    setResult(null);
    setHud((h) => ({ ...INITIAL_HUD, best: h.best, level: selRef.current }));
    gameRef.current?.start(selRef.current);
  }, []);

  const toMenu = useCallback(() => {
    audio.click();
    const g = gameRef.current;
    if (!g) return;
    g.toMenu();
    g.previewLevel(selRef.current);
  }, []);

  const toggleSound = useCallback(() => {
    const next = !audio.muted;
    audio.setMuted(next);
    audio.unlock();
    setMuted(next);
  }, []);

  const pickChar = useCallback((i: number) => {
    audio.click();
    gameRef.current?.setCharacter(i);
    setStats((s) => ({ ...s, ch: i }));
  }, []);

  const pickLevel = useCallback((l: number) => {
    const lv = Math.max(1, Math.min(l, readStats().maxLevel));
    selRef.current = lv;
    setSelLevel(lv);
    audio.click();
    gameRef.current?.previewLevel(lv);
  }, []);

  const cycleQuality = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    audio.click();
    g.setQualityPref(NEXT_Q[g.getQuality().pref]);
    setQuality(g.getQuality());
  }, []);

  // Enter starts / restarts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Enter' && e.code !== 'NumpadEnter') return;
      const p = phaseRef.current;
      if (p === 'menu' || p === 'over') {
        e.preventDefault();
        start();
      } else if (p === 'paused') {
        gameRef.current?.resume();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [start]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      <div ref={mountRef} className="absolute inset-0" />

      {glError && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <div className="max-w-md rounded-3xl bg-slate-900 p-8">
            <h1 className="text-3xl font-black text-yellow-300">WebGL unavailable</h1>
            <p className="mt-3 text-slate-300">
              Metro Sprint needs WebGL to render the 3D world. Please enable hardware acceleration or try another browser.
            </p>
          </div>
        </div>
      )}

      {phase === 'menu' && (
        <Menu
          best={stats.best}
          total={stats.total}
          charIdx={stats.ch}
          maxLevel={stats.maxLevel}
          selLevel={Math.min(selLevel, stats.maxLevel)}
          quality={quality}
          muted={muted}
          onChar={pickChar}
          onLevel={pickLevel}
          onQuality={cycleQuality}
          onPlay={start}
          onToggleSound={toggleSound}
        />
      )}

      {(phase === 'playing' || phase === 'paused' || phase === 'dying') && (
        <Hud hud={hud} muted={muted} onPause={() => gameRef.current?.pause()} onToggleSound={toggleSound} />
      )}

      {(phase === 'playing' || phase === 'paused') && banner && <LevelBanner key={banner.key} info={banner} />}

      {phase === 'paused' && <PauseOverlay onResume={() => gameRef.current?.resume()} onQuit={toMenu} />}

      {phase === 'over' && result && <GameOverOverlay result={result} onRetry={start} onMenu={toMenu} />}
    </div>
  );
}
