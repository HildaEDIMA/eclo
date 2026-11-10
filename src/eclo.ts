import {
  BoxGeometry, Color, CylinderGeometry, DistanceGrabbable, Mesh,
  MeshStandardMaterial, MovementMode, Quaternion, RayInteractable,
  SphereGeometry, Vector3, World, createSystem,
} from '@iwsdk/core';
import { applyRules, getRef, setRef, type EcloModel } from './model.js';

const ORIGIN = new Vector3(0, 1.2, -0.5); // où le modèle apparaît (à ajuster)
const UP = new Vector3(0, 1, 0);
const cOk = new Color('#2bb3a3');
const cWarn = new Color('#ffb703');
const cBreak = new Color('#ef476f');
const tmp = new Color();

interface Bond { id: string; from: string; to: string; rest: number; mesh: Mesh; wasBroken: boolean }
interface Live { model: EcloModel; atoms: Map<string, Mesh>; bonds: Bond[] }
let live: Live | null = null;

function geometryFor(shape: string, s: number) {
  if (shape === 'box') return new BoxGeometry(s * 2, s * 2, s * 2);
  if (shape === 'cylinder') return new CylinderGeometry(s, s, s * 2, 24);
  return new SphereGeometry(s, 32, 32);
}

export function mountEclo(world: World, model: EcloModel) {
  const atoms = new Map<string, Mesh>();
  for (const el of model.elements) {
    const mesh = new Mesh(
      geometryFor(el.shape, el.size),
      new MeshStandardMaterial({ color: el.color, roughness: 0.35 }),
    );
    mesh.position.set(ORIGIN.x + el.pos[0], ORIGIN.y + el.pos[1], ORIGIN.z + el.pos[2]);
    const entity = world.createTransformEntity(mesh);
    if (el.props.grab) {
      entity
        .addComponent(RayInteractable)
        .addComponent(DistanceGrabbable, { movementMode: MovementMode.MoveFromTarget });
    }
    atoms.set(el.id, mesh);
  }

  const bonds: Bond[] = model.links.map((l) => {
    const mesh = new Mesh(
      new CylinderGeometry(0.012, 0.012, 1, 16),
      new MeshStandardMaterial({ color: '#2bb3a3', roughness: 0.4 }),
    );
    world.createTransformEntity(mesh);
    const rest = atoms.get(l.from)!.position.distanceTo(atoms.get(l.to)!.position);
    return { id: l.id, from: l.from, to: l.to, rest, mesh, wasBroken: false };
  });

  live = { model, atoms, bonds };
}

const vA = new Vector3();
const vB = new Vector3();
const dir = new Vector3();

export class EcloSystem extends createSystem({}) {
  update(): void {
    if (!live) return;
    const { model, atoms, bonds } = live;

    // 1) les gestes déplacent les atomes -> on met à jour les longueurs
    for (const b of bonds) {
      atoms.get(b.from)!.getWorldPosition(vA);
      atoms.get(b.to)!.getWorldPosition(vB);
      setRef(model, `${b.id}.length`, vA.distanceTo(vB) / b.rest);
    }

    // 2) les règles recalculent tout
    applyRules(model);

    // 3) l'affichage suit le modèle
    for (const b of bonds) {
      atoms.get(b.from)!.getWorldPosition(vA);
      atoms.get(b.to)!.getWorldPosition(vB);
      dir.subVectors(vB, vA);
      const len = dir.length();
      b.mesh.position.copy(vA).addScaledVector(dir, 0.5);
      b.mesh.scale.set(1, len, 1);
      if (len > 1e-5) b.mesh.quaternion.setFromUnitVectors(UP, dir.normalize());

      const ratio = getRef(model, `${b.id}.length`) as number;
      const broken = getRef(model, `${b.id}.broken`) === true;
      const t = Math.min(Math.max((ratio - 1) / 0.6, 0), 1);
      (b.mesh.material as MeshStandardMaterial).color.copy(
        t < 0.5 ? tmp.copy(cOk).lerp(cWarn, t * 2) : tmp.copy(cWarn).lerp(cBreak, (t - 0.5) * 2),
      );
      b.mesh.visible = !broken;

      if (broken !== b.wasBroken) {
        console.log(`[eclo] liaison ${b.id} ${broken ? 'rompue' : 'reformée'}`);
        b.wasBroken = broken;
      }
    }
  }
}