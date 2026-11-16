// Banco de materiais físicos: aparência PBR + propriedades de engenharia.
// Densidades em g/cm³ (valores de referência de engenharia). Custo em R$/kg é estimativa de matéria-prima.

export type Finish = 'none' | 'brushed' | 'bead' | 'fine' | 'carbon' | 'knurl';

export interface PhysMaterial {
  label: string;
  group: 'Metais' | 'Vidros e transparentes' | 'Plásticos' | 'Eletrônica' | 'Outros';
  color: string;
  metalness: number;
  roughness: number;
  /** densidade g/cm³ */
  density: number;
  /** R$ por kg (matéria-prima, estimativa) */
  costPerKg?: number;
  finish?: Finish;
  /** intensidade do acabamento procedural (0..1) */
  finishStrength?: number;
  transmission?: number;
  ior?: number;
  thickness?: number;
  attenuationColor?: string;
  attenuationDistance?: number;
  dispersion?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  anisotropy?: number;
  iridescence?: number;
  iridescenceIOR?: number;
  sheen?: number;
  emissive?: string;
  emissiveIntensity?: number;
  specularIntensity?: number;
}

export const MATERIALS: Record<string, PhysMaterial> = {
  // ---- Metais
  aluminio:         { label: 'Alumínio 6061 escovado', group: 'Metais', color: '#d3d6da', metalness: 1, roughness: 0.28, density: 2.70, costPerKg: 28, finish: 'brushed', finishStrength: 0.8, anisotropy: 0.75 },
  aluminio_jateado: { label: 'Alumínio jateado (bead blast)', group: 'Metais', color: '#c6c9cd', metalness: 1, roughness: 0.42, density: 2.70, costPerKg: 28, finish: 'bead', finishStrength: 0.7 },
  aluminio_preto:   { label: 'Alumínio anodizado grafite', group: 'Metais', color: '#3a3d42', metalness: 1, roughness: 0.38, density: 2.70, costPerKg: 30, finish: 'bead', finishStrength: 0.6 },
  aluminio_azul:    { label: 'Alumínio anodizado azul', group: 'Metais', color: '#3d5f8f', metalness: 1, roughness: 0.36, density: 2.70, costPerKg: 30, finish: 'bead', finishStrength: 0.6 },
  titanio:          { label: 'Titânio grau 5 escovado', group: 'Metais', color: '#9a958e', metalness: 1, roughness: 0.3, density: 4.43, costPerKg: 210, finish: 'brushed', finishStrength: 0.9, anisotropy: 0.8 },
  titanio_natural:  { label: 'Titânio natural jateado', group: 'Metais', color: '#a8a39b', metalness: 1, roughness: 0.4, density: 4.43, costPerKg: 210, finish: 'bead', finishStrength: 0.7 },
  aco_inox:         { label: 'Aço inox 304', group: 'Metais', color: '#c4c8cc', metalness: 1, roughness: 0.18, density: 8.00, costPerKg: 25, finish: 'fine', finishStrength: 0.5 },
  aco_estampado:    { label: 'Aço estampado (blindagem RF)', group: 'Metais', color: '#bfc3c7', metalness: 1, roughness: 0.32, density: 7.85, costPerKg: 12, finish: 'fine', finishStrength: 0.6 },
  aco_preto:        { label: 'Aço oxidado preto', group: 'Metais', color: '#2a2b2e', metalness: 0.9, roughness: 0.45, density: 7.85, costPerKg: 12, finish: 'fine', finishStrength: 0.4 },
  cobre:            { label: 'Cobre', group: 'Metais', color: '#d0875a', metalness: 1, roughness: 0.25, density: 8.96, costPerKg: 60 },
  latao:            { label: 'Latão', group: 'Metais', color: '#d8b56a', metalness: 1, roughness: 0.25, density: 8.50, costPerKg: 45 },
  ouro:             { label: 'Ouro (ENIG / contatos)', group: 'Metais', color: '#f0c25e', metalness: 1, roughness: 0.16, density: 19.3 },
  estanho:          { label: 'Solda SAC305', group: 'Metais', color: '#d8dcdf', metalness: 1, roughness: 0.14, density: 7.40 },
  niquel:           { label: 'Níquel (terminais)', group: 'Metais', color: '#c9c5bd', metalness: 1, roughness: 0.22, density: 8.90 },

  // ---- Vidros e transparentes
  vidro:            { label: 'Vidro temperado (Gorilla)', group: 'Vidros e transparentes', color: '#ffffff', metalness: 0, roughness: 0.015, density: 2.42, transmission: 1, ior: 1.51, thickness: 0.7, attenuationColor: '#dff2e8', attenuationDistance: 60, dispersion: 0.15, specularIntensity: 1 },
  vidro_fosco:      { label: 'Vidro fosco (matte)', group: 'Vidros e transparentes', color: '#f3f5f7', metalness: 0, roughness: 0.38, density: 2.42, transmission: 0.96, ior: 1.51, thickness: 0.7 },
  vidro_fume:       { label: 'Vidro fumê', group: 'Vidros e transparentes', color: '#8b939c', metalness: 0, roughness: 0.03, density: 2.42, transmission: 0.9, ior: 1.51, thickness: 0.7, attenuationColor: '#5c636b', attenuationDistance: 3 },
  safira:           { label: 'Cristal de safira', group: 'Vidros e transparentes', color: '#ffffff', metalness: 0, roughness: 0.01, density: 3.98, transmission: 1, ior: 1.77, thickness: 0.5, dispersion: 0.1 },
  policarbonato:    { label: 'Policarbonato transparente', group: 'Vidros e transparentes', color: '#f6faff', metalness: 0, roughness: 0.05, density: 1.20, costPerKg: 35, transmission: 0.98, ior: 1.585, thickness: 1, attenuationColor: '#eef4ff', attenuationDistance: 40 },
  acrilico:         { label: 'Acrílico (PMMA)', group: 'Vidros e transparentes', color: '#ffffff', metalness: 0, roughness: 0.01, density: 1.18, costPerKg: 30, transmission: 1, ior: 1.49, thickness: 2 },
  lente:            { label: 'Lente óptica com AR coating', group: 'Vidros e transparentes', color: '#ffffff', metalness: 0, roughness: 0.0, density: 2.5, transmission: 1, ior: 1.6, thickness: 1.5, iridescence: 1, iridescenceIOR: 1.38, specularIntensity: 1 },

  // ---- Plásticos
  abs_preto:        { label: 'ABS preto', group: 'Plásticos', color: '#18191c', metalness: 0, roughness: 0.55, density: 1.05, costPerKg: 14, finish: 'fine', finishStrength: 0.3 },
  abs_branco:       { label: 'ABS branco', group: 'Plásticos', color: '#ebebe7', metalness: 0, roughness: 0.5, density: 1.05, costPerKg: 14, finish: 'fine', finishStrength: 0.3 },
  pbt_preto:        { label: 'PBT preto (conectores)', group: 'Plásticos', color: '#121315', metalness: 0, roughness: 0.48, density: 1.31 },
  nylon_bege:       { label: 'Nylon 46 bege (JST/ZIF)', group: 'Plásticos', color: '#e7dcc4', metalness: 0, roughness: 0.55, density: 1.18 },
  lcp_preto:        { label: 'LCP preto (BTB)', group: 'Plásticos', color: '#1a1a1a', metalness: 0, roughness: 0.4, density: 1.62 },
  pla_cinza:        { label: 'PLA (impressão 3D) cinza', group: 'Plásticos', color: '#8f949a', metalness: 0, roughness: 0.62, density: 1.24, costPerKg: 110, finish: 'fine', finishStrength: 0.5 },
  petg_preto:       { label: 'PETG preto', group: 'Plásticos', color: '#202225', metalness: 0, roughness: 0.4, density: 1.27, costPerKg: 120 },
  silicone:         { label: 'Silicone / borracha', group: 'Plásticos', color: '#24262a', metalness: 0, roughness: 0.85, density: 1.10, sheen: 0.3 },
  poliimida:        { label: 'Poliimida (flex)', group: 'Plásticos', color: '#c27a12', metalness: 0, roughness: 0.32, density: 1.42, transmission: 0.25, thickness: 0.1, clearcoat: 0.6 },
  pvc_cinza:        { label: 'PVC cinza (fita IDC)', group: 'Plásticos', color: '#9ea2a6', metalness: 0, roughness: 0.6, density: 1.38 },
  plastico_azul:    { label: 'Plástico azul', group: 'Plásticos', color: '#2c66c7', metalness: 0, roughness: 0.45, density: 1.10 },
  plastico_laranja: { label: 'Plástico laranja', group: 'Plásticos', color: '#ff7a1a', metalness: 0, roughness: 0.45, density: 1.10 },
  plastico_vermelho:{ label: 'Plástico vermelho', group: 'Plásticos', color: '#cf2424', metalness: 0, roughness: 0.45, density: 1.10 },

  // ---- Eletrônica
  fr4_verde:        { label: 'PCB FR4 · máscara verde', group: 'Eletrônica', color: '#0f5b2c', metalness: 0, roughness: 0.32, density: 1.85, clearcoat: 0.5 },
  fr4_preto:        { label: 'PCB FR4 · máscara preta', group: 'Eletrônica', color: '#0d0f11', metalness: 0, roughness: 0.3, density: 1.85, clearcoat: 0.5 },
  fr4_azul:         { label: 'PCB FR4 · máscara azul', group: 'Eletrônica', color: '#0c3f7a', metalness: 0, roughness: 0.32, density: 1.85, clearcoat: 0.5 },
  fr4_teal:         { label: 'PCB FR4 · teal (Arduino)', group: 'Eletrônica', color: '#007a84', metalness: 0, roughness: 0.32, density: 1.85, clearcoat: 0.5 },
  fr4_roxo:         { label: 'PCB FR4 · roxo', group: 'Eletrônica', color: '#40246b', metalness: 0, roughness: 0.32, density: 1.85, clearcoat: 0.5 },
  fr4_borda:        { label: 'FR4 (núcleo exposto)', group: 'Eletrônica', color: '#6f6a4c', metalness: 0, roughness: 0.75, density: 1.85 },
  encapsulamento:   { label: 'Encapsulamento epóxi (chip)', group: 'Eletrônica', color: '#141517', metalness: 0, roughness: 0.42, density: 1.95 },
  die:              { label: 'Die de silício', group: 'Eletrônica', color: '#2c3046', metalness: 0.7, roughness: 0.12, density: 2.33, iridescence: 0.6 },
  ceramica_mlcc:    { label: 'Cerâmica MLCC', group: 'Eletrônica', color: '#a88c64', metalness: 0, roughness: 0.6, density: 5.5 },
  resistor_smd:     { label: 'Resistor SMD (filme espesso)', group: 'Eletrônica', color: '#111214', metalness: 0, roughness: 0.5, density: 3.9 },
  ferrite:          { label: 'Ferrite', group: 'Eletrônica', color: '#2a2a2b', metalness: 0.15, roughness: 0.75, density: 4.8 },
  tela_off:         { label: 'Painel OLED (desligado)', group: 'Eletrônica', color: '#040506', metalness: 0.3, roughness: 0.08, density: 2.6, clearcoat: 1, clearcoatRoughness: 0.02 },
  tela_on:          { label: 'Painel OLED (ligado)', group: 'Eletrônica', color: '#05070c', metalness: 0, roughness: 0.15, density: 2.6, emissive: '#ffffff', emissiveIntensity: 1 },
  polarizador:      { label: 'Polarizador / filme óptico', group: 'Eletrônica', color: '#0b0c10', metalness: 0.1, roughness: 0.2, density: 1.3, transmission: 0.4, thickness: 0.2 },
  bateria_pouch:    { label: 'Pouch de bateria (alumínio laminado)', group: 'Eletrônica', color: '#9da3ab', metalness: 0.85, roughness: 0.33, density: 2.4, finish: 'fine', finishStrength: 0.4 },
  sensor_cmos:      { label: 'Sensor CMOS', group: 'Eletrônica', color: '#3a2a55', metalness: 0.6, roughness: 0.1, density: 2.33, iridescence: 1, iridescenceIOR: 1.8 },
  led_vermelho:     { label: 'LED vermelho', group: 'Eletrônica', color: '#ff3b30', metalness: 0, roughness: 0.08, density: 1.2, transmission: 0.55, thickness: 2, emissive: '#ff1a10', emissiveIntensity: 0.6 },
  led_verde:        { label: 'LED verde', group: 'Eletrônica', color: '#3cff7a', metalness: 0, roughness: 0.08, density: 1.2, transmission: 0.55, thickness: 2, emissive: '#10ff50', emissiveIntensity: 0.6 },
  led_azul:         { label: 'LED azul', group: 'Eletrônica', color: '#4a8bff', metalness: 0, roughness: 0.08, density: 1.2, transmission: 0.55, thickness: 2, emissive: '#2060ff', emissiveIntensity: 0.6 },
  led_branco:       { label: 'LED branco', group: 'Eletrônica', color: '#fffdf4', metalness: 0, roughness: 0.08, density: 1.2, transmission: 0.55, thickness: 2, emissive: '#fff6d8', emissiveIntensity: 0.5 },
  led_ambar:        { label: 'LED âmbar (SMD)', group: 'Eletrônica', color: '#ffb02e', metalness: 0, roughness: 0.1, density: 1.2, emissive: '#ff9a00', emissiveIntensity: 0.4 },

  // ---- Outros
  fibra_carbono:    { label: 'Fibra de carbono 3K', group: 'Outros', color: '#17181a', metalness: 0.35, roughness: 0.28, density: 1.60, costPerKg: 900, finish: 'carbon', finishStrength: 1, clearcoat: 1, clearcoatRoughness: 0.05 },
  madeira:          { label: 'Madeira (nogueira)', group: 'Outros', color: '#7a4f2e', metalness: 0, roughness: 0.65, density: 0.65 },
  ceramica:         { label: 'Cerâmica técnica', group: 'Outros', color: '#efece6', metalness: 0, roughness: 0.25, density: 3.9, clearcoat: 0.6 },
  feltro:           { label: 'Espuma / fita adesiva', group: 'Outros', color: '#222222', metalness: 0, roughness: 0.95, density: 0.3 },
};

export const DEFAULT_MATERIAL = 'pla_cinza';

export function materialOf(key: string | null | undefined): PhysMaterial {
  return (key && MATERIALS[key]) || MATERIALS[DEFAULT_MATERIAL];
}

export function materialGroups(): { group: string; items: { key: string; label: string }[] }[] {
  const map = new Map<string, { key: string; label: string }[]>();
  for (const [key, m] of Object.entries(MATERIALS)) {
    if (!map.has(m.group)) map.set(m.group, []);
    map.get(m.group)!.push({ key, label: m.label });
  }
  return [...map.entries()].map(([group, items]) => ({ group, items }));
}
