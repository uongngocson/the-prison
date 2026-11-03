import { useEffect, useRef } from 'react';
import { useUI } from './ui/store';
import { useSettings } from './ui/settings';
import { controller } from './app/controller';
import { Landing, Auth, Menu, Loading, Credits, Fatal, Ending } from './ui/screens/Shell';
import { Create } from './ui/screens/Create';
import { Hud, Dialogue, useVerbHotkeys } from './ui/screens/Hud';
import { Pause, Inventory, Journal, MapPanel, SchedulePanel, Handbook, SleepPanel, ScenePanel, LibraryPanel, NewsPanel, MenuBoardPanel, NotificationsPanel } from './ui/screens/Panels';
import { ProfilePanel } from './ui/screens/Profile';
import { SavesPanel, SettingsPanel } from './ui/screens/SavesSettings';
import { LifeHub } from './ui/life/LifeHub';
import { TouchControls, RotateHint, useGamepadUI } from './ui/screens/TouchControls';
import { QuickMenu } from './ui/screens/MobileHud';
import { Setup, CustodyPanel, InCellPanel } from './ui/screens/Custody';
import { WorkPanel } from './ui/screens/Work';
import { OnlineLobby, ChatDock, QueueScreen } from './ui/screens/Online';
import { startDeviceWatch } from './ui/device';
import { audio } from './audio/audio';
import { ErrorBoundary } from './ui/ErrorBoundary';

export default function App() {
  const screen = useUI((s) => s.screen);
  const overlay = useUI((s) => s.overlay);
  const fatal = useUI((s) => s.fatal);
  const access = useSettings((s) => s.s.access);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useVerbHotkeys();
  useGamepadUI();
  useEffect(() => {
    controller.canvas = canvasRef.current;
    void controller.initialize();
    startDeviceWatch();
    // AudioContext chỉ mở sau cử chỉ người dùng (chạm/nhấp) — quan trọng trên iOS/Android
    const unlock = () => { if (useUI.getState().screen === 'game') audio.resume(); };
    window.addEventListener('pointerdown', unlock);
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);
  // Esc khi tiêu điểm đã rơi khỏi panel (vd. nút vừa bấm biến mất): dùng đúng nút Đóng của panel đó.
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const panel = document.querySelector('.overlay .panel');
      if (!panel || panel.contains(document.activeElement)) return;
      const btn = panel.querySelector<HTMLButtonElement>('.panel-close');
      if (btn) { e.preventDefault(); e.stopImmediatePropagation(); btn.click(); }
    };
    window.addEventListener('keydown', kd, true);
    return () => window.removeEventListener('keydown', kd, true);
  }, []);
  useEffect(() => {
    document.documentElement.style.setProperty('--ts', String(access.textScale));
    document.body.classList.toggle('hc', access.highContrast);
    document.body.classList.toggle('rm', access.reducedMotion);
  }, [access]);
  const inGame = screen === 'game';
  return (
    <>
      <canvas id="game" ref={canvasRef} tabIndex={-1} aria-label="Khung hình trò chơi 3D" style={{ visibility: inGame ? 'visible' : 'hidden' }} />
      {screen === 'landing' && <Landing />}
      {screen === 'auth' && <Auth />}
      {screen === 'menu' && <Menu />}
      {screen === 'create' && <Create />}
      {screen === 'setup' && <Setup />}
      {screen === 'loading' && <Loading />}
      {screen === 'lobby' && <OnlineLobby />}
      {screen === 'queue' && <QueueScreen />}
      {screen === 'credits' && <Credits />}
      {screen === 'ending' && <Ending />}
      {inGame && <ErrorBoundary name="TouchControls" silent><TouchControls /></ErrorBoundary>}
      {inGame && <ErrorBoundary name="Hud" silent><Hud /></ErrorBoundary>}
      {inGame && <ErrorBoundary name="chat" silent><ChatDock /></ErrorBoundary>}
      {inGame && <RotateHint />}
      {inGame && <ErrorBoundary name="Dialogue" silent><Dialogue /></ErrorBoundary>}
      {inGame && overlay === 'quickmenu' && <ErrorBoundary name="quickmenu"><QuickMenu /></ErrorBoundary>}
      {inGame && overlay === 'pause' && <ErrorBoundary name="pause"><Pause /></ErrorBoundary>}
      {inGame && overlay === 'custody' && <ErrorBoundary name="custody"><CustodyPanel /></ErrorBoundary>}
      {inGame && overlay === 'work' && <ErrorBoundary name="work"><WorkPanel /></ErrorBoundary>}
      {inGame && overlay === 'incell' && <ErrorBoundary name="incell"><InCellPanel /></ErrorBoundary>}
      {inGame && overlay === 'inventory' && <ErrorBoundary name="inventory"><Inventory /></ErrorBoundary>}
      {inGame && overlay === 'journal' && <ErrorBoundary name="journal"><Journal /></ErrorBoundary>}
      {inGame && overlay === 'map' && <ErrorBoundary name="map"><MapPanel /></ErrorBoundary>}
      {inGame && overlay === 'schedule' && <ErrorBoundary name="schedule"><SchedulePanel /></ErrorBoundary>}
      {inGame && overlay === 'profile' && <ErrorBoundary name="profile"><ProfilePanel /></ErrorBoundary>}
      {inGame && overlay === 'handbook' && <ErrorBoundary name="handbook"><Handbook /></ErrorBoundary>}
      {inGame && overlay === 'life' && <ErrorBoundary name="life"><LifeHub /></ErrorBoundary>}
      {inGame && overlay === 'sleep' && <ErrorBoundary name="sleep"><SleepPanel /></ErrorBoundary>}
      {inGame && overlay === 'scene' && <ErrorBoundary name="scene"><ScenePanel /></ErrorBoundary>}
      {inGame && overlay === 'library' && <ErrorBoundary name="library"><LibraryPanel /></ErrorBoundary>}
      {inGame && overlay === 'news' && <ErrorBoundary name="news"><NewsPanel /></ErrorBoundary>}
      {inGame && overlay === 'menu_board' && <ErrorBoundary name="menu_board"><MenuBoardPanel /></ErrorBoundary>}
      {inGame && overlay === 'notifications' && <ErrorBoundary name="notifications"><NotificationsPanel /></ErrorBoundary>}
      {overlay === 'saves' && <ErrorBoundary name="saves"><SavesPanel /></ErrorBoundary>}
      {overlay === 'settings' && <ErrorBoundary name="settings"><SettingsPanel /></ErrorBoundary>}
      {fatal && <Fatal />}
    </>
  );
}
