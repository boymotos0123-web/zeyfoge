// Pinagens reais (ordem física dos pinos) usadas na validação elétrica.

/** ESP32 DevKit V1 (DOIT, 30 pinos). Lado A = lado com EN; ordem a partir da ponta da antena. */
export const ESP32_DEVKIT_A = ['EN', 'VP', 'VN', 'D34', 'D35', 'D32', 'D33', 'D25', 'D26', 'D27', 'D14', 'D12', 'D13', 'GND', 'VIN'];
export const ESP32_DEVKIT_B = ['D23', 'D22', 'TX0', 'RX0', 'D21', 'D19', 'D18', 'D5', 'TX2', 'RX2', 'D4', 'D2', 'D15', 'GND', '3V3'];

/** Arduino Uno R3 (esquerda → direita, com o USB à esquerda). */
export const UNO_DIGITAL_HIGH = ['SCL', 'SDA', 'AREF', 'GND', 'D13', 'D12', 'D11', 'D10', 'D9', 'D8'];
export const UNO_DIGITAL_LOW = ['D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'TX', 'RX'];
export const UNO_POWER = ['NC', 'IOREF', 'RESET', '3V3', '5V', 'GND', 'GND', 'VIN'];
export const UNO_ANALOG = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'];
export const UNO_ICSP = ['MISO', '5V', 'SCK', 'MOSI', 'RESET', 'GND'];

/** Raspberry Pi 4 — header de 40 pinos (pino 1 → 40). */
export const RPI_40 = [
  '3V3', '5V', 'GPIO2', '5V', 'GPIO3', 'GND', 'GPIO4', 'GPIO14', 'GND', 'GPIO15',
  'GPIO17', 'GPIO18', 'GPIO27', 'GND', 'GPIO22', 'GPIO23', '3V3', 'GPIO24', 'GPIO10', 'GND',
  'GPIO9', 'GPIO25', 'GPIO11', 'GPIO8', 'GND', 'GPIO7', 'ID_SD', 'ID_SC', 'GPIO5', 'GND',
  'GPIO6', 'GPIO12', 'GPIO13', 'GND', 'GPIO19', 'GPIO16', 'GPIO26', 'GPIO20', 'GND', 'GPIO21',
];

/** Raspberry Pi Pico — pinos 1–20 (lado esquerdo, de cima p/ baixo) e 21–40 (lado direito, de baixo p/ cima). */
export const PICO_LEFT = ['GP0', 'GP1', 'GND', 'GP2', 'GP3', 'GP4', 'GP5', 'GND', 'GP6', 'GP7', 'GP8', 'GP9', 'GND', 'GP10', 'GP11', 'GP12', 'GP13', 'GND', 'GP14', 'GP15'];
export const PICO_RIGHT = ['GP16', 'GP17', 'GND', 'GP18', 'GP19', 'GP20', 'GP21', 'GND', 'GP22', 'RUN', 'GP26', 'GP27', 'GND', 'GP28', 'ADC_VREF', '3V3', '3V3_EN', 'GND', 'VSYS', 'VBUS'];

/** Arduino Nano (lado D e lado A). */
export const NANO_D = ['D13', '3V3', 'AREF', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', '5V', 'RESET', 'GND', 'VIN'];
export const NANO_A = ['D12', 'D11', 'D10', 'D9', 'D8', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'GND', 'RESET', 'RX', 'TX'];

/** Módulo OLED 0,96" I²C. */
export const OLED_I2C = ['GND', 'VCC', 'SCL', 'SDA'];
