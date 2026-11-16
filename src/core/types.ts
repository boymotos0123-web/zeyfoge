// Tipos centrais do ZeyForge. Este arquivo é o contrato entre núcleo, motor, biblioteca e UI.
// Convenções: 1 unidade = 1 mm · eixo Y para cima · ângulos em graus no documento · massa em gramas.

export type Vec3 = [number, number, number];
export type Id = string;

/* ---------------- Encaixes (sockets) ---------------- */

/** Família elétrica/mecânica do encaixe. Define com quem ele pode se conectar. */
export type SocketKind =
  | 'fpc'          // conector ZIF/FPC genérico (flat flex)
  | 'mipi-dsi'     // display (flex do painel)
  | 'mipi-csi'     // câmera (flex do sensor)
  | 'bms'          // pads/conector da placa de proteção da bateria
  | 'btb-plug'     // board-to-board (macho) — encaixe direto
  | 'btb-recept'   // board-to-board (fêmea)
  | 'header-male'  // barra de pinos macho
  | 'header-female'// barra de pinos fêmea
  | 'usb-c'
  | 'jst'
  | 'mount-top'    // furo de fixação (lado de cima)
  | 'mount-bottom' // furo de fixação (lado de baixo)
  | 'screw'        // parafuso (assento da cabeça)
  | 'standoff-top'
  | 'standoff-bottom'
  | 'custom';

export type PinType = 'gpio' | 'analog' | 'gnd' | '3v3' | '5v' | 'vin' | 'vbat' | 'vcc' | 'signal' | 'diff' | 'nc' | 'reset' | 'enable' | 'i2c' | 'spi' | 'uart' | 'usb';

export interface SocketDef {
  id: string;
  label: string;
  kind: SocketKind;
  pins: number;
  /** passo entre pinos em mm */
  pitch: number;
  /** posição local (mm) do centro do encaixe */
  pos: Vec3;
  /** direção de saída (para onde o cabo/peça que encaixa "olha") */
  normal: Vec3;
  /** direção da fileira de pinos (largura do flat) */
  axis: Vec3;
  pinNames?: string[];
  pinTypes?: PinType[];
  /** tensão lógica dos GPIOs desse encaixe (V) — usada para validar 5 V em 3,3 V */
  logicVoltage?: number;
  /** posição local de cada pino (se omitido: fileira única ao longo de axis, centrada em pos) */
  pinOffsets?: Vec3[];
  /** como o cabo termina neste encaixe: conector BTB por cima, inserção ZIF, solda direta ou pino */
  termination?: 'btb' | 'zif' | 'solder' | 'pin';
}

/* ---------------- Documento ---------------- */

export type NodeKind = 'part' | 'assembly' | 'import' | 'mesh';

export interface MaterialOverride {
  /** id em MATERIALS (core/materials-db) ou null = material original do componente */
  preset: string | null;
  color: string | null;
  opacity: number;
}

export interface DocNode {
  id: Id;
  name: string;
  kind: NodeKind;
  /** tipo do componente na biblioteca (kind === 'part') */
  type: string;
  params: Record<string, unknown>;
  pos: Vec3;
  rot: Vec3;
  scl: Vec3;
  mat: MaterialOverride;
  visible: boolean;
  locked: boolean;
  parent: Id | null;
  expanded: boolean;
  /** custo unitário (R$) */
  cost: number;
  qty: number;
  /** massa manual (g); null = automática (biblioteca ou volume×densidade) */
  massOverride: number | null;
  supplier: string;
  partNumber: string;
  notes: string;
  /** asset (GLB importado ou malha de booleana) */
  asset: Id | null;
  /** encaixes adicionados pelo usuário (editor de encaixes) */
  customSockets: SocketDef[];
}

export type CableKind = 'fpc' | 'ribbon' | 'wire' | 'usb';

export interface Endpoint {
  node: Id;
  socket: string;
  /** índice do pino (0-based) quando a conexão é de um fio individual */
  pin?: number;
}

export interface Cable {
  id: Id;
  name: string;
  kind: CableKind;
  a: Endpoint;
  b: Endpoint;
  /** largura (fita) ou diâmetro externo (fio), mm */
  width: number;
  thickness: number;
  conductors: number;
  pitch: number;
  layers: number;
  color: string | null;
  /** pontos de passagem em coordenadas do mundo (mm) */
  waypoints: Vec3[];
  /** quanto o cabo sai reto do conector antes de curvar (mm) */
  lead: number;
  /** folga extra (0..1) que faz o cabo "barrigar" */
  slack: number;
  stiffener: boolean;
  visible: boolean;
  cost: number | null;
  notes: string;
}

export interface Pricing {
  assembly: number;
  packaging: number;
  shipping: number;
  tax: number;
  margin: number;
}

export interface Asset {
  id: Id;
  name: string;
  /** 'glb' = modelo importado; 'mesh' = geometria binária (resultado de booleana / STL) */
  type: 'glb' | 'mesh';
  /** fator para converter as unidades do arquivo para mm */
  unitScale: number;
  data: Uint8Array;
}

export interface ZDocument {
  app: 'ZeyForge';
  format: number;
  name: string;
  units: 'mm';
  created: string;
  modified: string;
  nodes: DocNode[];
  cables: Cable[];
  pricing: Pricing;
  /** assets binários (não entram no histórico de desfazer — são imutáveis) */
  assets: Record<Id, Asset>;
}

/* ---------------- Validação ---------------- */

export type Severity = 'error' | 'warning' | 'info';

export interface Issue {
  severity: Severity;
  message: string;
  cable?: Id;
  node?: Id;
}
