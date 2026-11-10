export type Vec3 = [number, number, number];
export type Props = Record<string, number | boolean>;

export interface EcloElement {
  id: string;
  shape: 'sphere' | 'box' | 'cylinder';
  pos: Vec3;
  size: number;
  color: string;
  label?: string;
  props: Props;
}
export interface EcloLink { id: string; from: string; to: string; props: Props }
export interface Condition { ref: string; op: '>' | '<' | '>=' | '<=' | '=='; value: number }
export interface Action { ref: string; value: number | boolean }
export interface EcloRule { if: Condition; then: Action[]; else?: Action[] }
export interface EcloControl { id: string; label: string; ref: string; min: number; max: number }
export interface EcloModel {
  title: string;
  summary: string;
  elements: EcloElement[];
  links: EcloLink[];
  rules: EcloRule[];
  controls: EcloControl[];
}

// "B1.length" = propriété "length" de l'objet "B1"
function find(m: EcloModel, id: string) {
  return [...m.elements, ...m.links].find((o) => o.id === id);
}
export function getRef(m: EcloModel, ref: string) {
  const [id, prop] = ref.split('.');
  return find(m, id)?.props[prop];
}
export function setRef(m: EcloModel, ref: string, value: number | boolean) {
  const [id, prop] = ref.split('.');
  const o = find(m, id);
  if (o) o.props[prop] = value;
}

const OPS = {
  '>': (a: number, b: number) => a > b,
  '<': (a: number, b: number) => a < b,
  '>=': (a: number, b: number) => a >= b,
  '<=': (a: number, b: number) => a <= b,
  '==': (a: number, b: number) => a === b,
};

// À appeler après chaque geste : recalcule tout le modèle
export function applyRules(m: EcloModel) {
  for (const r of m.rules) {
    const cur = getRef(m, r.if.ref);
    if (typeof cur !== 'number') continue;
    const acts = OPS[r.if.op](cur, r.if.value) ? r.then : r.else ?? [];
    acts.forEach((a) => setRef(m, a.ref, a.value));
  }
}

// Démo n°1 (codée en dur, sert aussi de plan B si l'API est indisponible)
export const demoWater: EcloModel = {
  title: "Molécule d'eau (modèle simplifié)",
  summary: "Étire une liaison O–H : au-delà d'un seuil, elle se rompt.",
  elements: [
    { id: 'O1', shape: 'sphere', pos: [0, 0, 0], size: 0.05, color: '#ff6b6b', label: 'O', props: {} },
    { id: 'H1', shape: 'sphere', pos: [0.2, 0.12, 0], size: 0.03, color: '#ffffff', label: 'H', props: { grab: true } },
    { id: 'H2', shape: 'sphere', pos: [-0.2, 0.12, 0], size: 0.03, color: '#ffffff', label: 'H', props: { grab: true } },
  ],
  links: [
    { id: 'B1', from: 'O1', to: 'H1', props: { length: 1.0, broken: false } },
    { id: 'B2', from: 'O1', to: 'H2', props: { length: 1.0, broken: false } },
  ],
  rules: [
    { if: { ref: 'B1.length', op: '>', value: 1.6 }, then: [{ ref: 'B1.broken', value: true }], else: [{ ref: 'B1.broken', value: false }] },
    { if: { ref: 'B2.length', op: '>', value: 1.6 }, then: [{ ref: 'B2.broken', value: true }], else: [{ ref: 'B2.broken', value: false }] },
  ],
  controls: [{ id: 'C1', label: 'Étirer O–H', ref: 'B1.length', min: 0.6, max: 2.2 }],
};