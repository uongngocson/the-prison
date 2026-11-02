import { useEffect, useRef } from 'react';
import { useUI } from './ui/store';
import { useSettings } from './ui/settings';
import { controller } from './app/controller';
import { Landing, Auth, Menu, Loading, Lobby, Credits, Fatal, Ending } from './ui/screens/Shell';
import { Create } from './ui/screens/Create';
import { Hud, Dialogue, useVerbHotkeys } from './ui/screens/Hud';
import { Pause, Inventory, Journal, MapPanel, SchedulePanel, Handbook, SleepPanel, ScenePanel, LibraryPanel, NewsPanel, MenuBoardPanel, NotificationsPanel } from './ui/screens/Panels';
import { ProfilePanel } from './ui/screens/Profile';
import { SavesPanel, SettingsPanel } from './ui/screens/SavesSettings';
import { LifeHub } from './ui/life/LifeHub';
import { TouchControls, RotateHint, useGamepadUI } from './ui/screens/TouchControls';
import { QuickMenu } from './ui/screens/MobileHud';
import { Setup, CustodyPanel, InCellPanel } from './ui/screens/Custody';
import { startDeviceWatch } from './ui/device';
import { audio } from './audio/audio';

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
      {screen === 'lobby' && <Lobby />}
      {screen === 'credits' && <Credits />}
      {screen === 'ending' && <Ending />}
      {inGame && <TouchControls />}
      {inGame && <Hud />}
      {inGame && <RotateHint />}
      {inGame && <Dialogue />}
      {inGame && overlay === 'quickmenu' && <QuickMenu />}
      {inGame && overlay === 'pause' && <Pause />}
      {inGame && overlay === 'custody' && <CustodyPanel />}
      {inGame && overlay === 'incell' && <InCellPanel />}
      {inGame && overlay === 'inventory' && <Inventory />}
      {inGame && overlay === 'journal' && <Journal />}
      {inGame && overlay === 'map' && <MapPanel />}
      {inGame && overlay === 'schedule' && <SchedulePanel />}
      {inGame && overlay === 'profile' && <ProfilePanel />}
      {inGame && overlay === 'handbook' && <Handbook />}
      {inGame && overlay === 'life' && <LifeHub />}
      {inGame && overlay === 'sleep' && <SleepPanel />}
      {inGame && overlay === 'scene' && <ScenePanel />}
      {inGame && overlay === 'library' && <LibraryPanel />}
      {inGame && overlay === 'news' && <NewsPanel />}
      {inGame && overlay === 'menu_board' && <MenuBoardPanel />}
      {inGame && overlay === 'notifications' && <NotificationsPanel />}
      {overlay === 'saves' && <SavesPanel />}
      {overlay === 'settings' && <SettingsPanel />}
      {fatal && <Fatal />}
    </>
  );
}
