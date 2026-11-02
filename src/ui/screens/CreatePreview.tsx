// Lazy 3D preview for U03 (engine chunk loads only after Play intent).
import { useEffect, useRef } from 'react';
import { ArcRotateCamera, Color3, Color4, Engine, HemisphericLight, MeshBuilder, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';
import { Humanoid } from '../../presentation/characters';
import { stripe } from '../../presentation/palette';
import type { Appearance } from '../../domain/types';

export default function Preview({ look, rot }: { look: Appearance; rot: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const st = useRef<{ engine: Engine; scene: Scene; h: Humanoid | null; cam: ArcRotateCamera } | null>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const engine = new Engine(canvas, true, { antialias: true }, true);
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.09, 0.13, 0.14, 1);
    const cam = new ArcRotateCamera('pc', Math.PI / 2 + Math.PI, 1.35, 3.4, new Vector3(0, 1.0, 0), scene);
    new HemisphericLight('h', new Vector3(0.3, 1, -0.4), scene).intensity = 1.05;
    const floor = MeshBuilder.CreateDisc('f', { radius: 0.9, tessellation: 40 }, scene);
    floor.rotation.x = Math.PI / 2;
    const fm = new StandardMaterial('fm', scene);
    fm.diffuseColor = Color3.FromHexString('#2b3b3e');
    floor.material = fm;
    st.current = { engine, scene, h: null, cam };
    let t = 0;
    engine.runRenderLoop(() => { t += engine.getDeltaTime() / 1000; st.current?.h?.animate(engine.getDeltaTime() / 1000, 'idle', 0, false); scene.render(); });
    const onR = () => engine.resize();
    window.addEventListener('resize', onR);
    return () => { window.removeEventListener('resize', onR); engine.stopRenderLoop(); scene.dispose(); engine.dispose(); st.current = null; void t; };
  }, []);
  useEffect(() => {
    const s = st.current;
    if (!s) return;
    s.h?.dispose();
    s.h = new Humanoid(s.scene, 'preview', look, stripe(look.outfit));
  }, [look]);
  useEffect(() => { if (st.current) st.current.cam.alpha = Math.PI / 2 + Math.PI + rot; }, [rot]);
  return <canvas ref={ref} className="preview3d" aria-label="Xem trước nhân vật" />;
}

