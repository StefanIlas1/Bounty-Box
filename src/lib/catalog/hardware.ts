/** Physical hardware discovery and quote normalization. No purchasing side effects. */
export type HardwareTargetId = 'pico-rp2040' | 'icebreaker-up5k';
export interface HardwareTarget {
  id: HardwareTargetId;
  name: string;
  kind: 'mcu' | 'fpga';
  device: string;
  language: 'c' | 'verilog';
  capabilities: string[];
  sourceUrls: string[];
  purchaseUrl: string;
  toolchain: string[];
  accessories: Array<{ id: string; name: string; quantity: number }>;
}
export const HARDWARE_TARGETS: readonly HardwareTarget[] = [
  {
    id: 'pico-rp2040', name: 'Raspberry Pi Pico (original non-wireless RP2040)',
    kind: 'mcu', device: 'RP2040', language: 'c',
    capabilities: ['gpio', 'uart', 'spi', 'i2c', 'pwm', 'usb', 'onboard-led'],
    sourceUrls: ['https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html', 'https://github.com/raspberrypi/pico-examples/tree/master/blink'],
    purchaseUrl: 'https://www.raspberrypi.com/products/raspberry-pi-pico/',
    toolchain: ['Pico C/C++ SDK', 'CMake', 'ARM GNU toolchain'],
    accessories: [{ id: 'usb-micro-data', name: 'Host-compatible USB data cable with Micro-B board connector', quantity: 1 }],
  },
  {
    id: 'icebreaker-up5k', name: 'iCEBreaker iCE40UP5K (SG48)', kind: 'fpga',
    device: 'iCE40UP5K-SG48', language: 'verilog',
    capabilities: ['gpio', 'uart', 'spi', 'i2c', 'pwm', 'custom-logic', 'onboard-led'],
    sourceUrls: ['https://docs.icebreaker-fpga.org/hardware/icebreaker/', 'https://codeberg.org/icebreaker-fpga/icebreaker-verilog-examples'],
    purchaseUrl: 'https://docs.icebreaker-fpga.org/hardware/icebreaker/',
    toolchain: ['Icarus Verilog', 'Yosys', 'nextpnr-ice40', 'IceStorm'],
    accessories: [{ id: 'usb-micro-data', name: 'Host-compatible USB data cable with Micro-B board connector', quantity: 1 }],
  },
];
export interface HardwareRequirements {
  kind?: 'mcu' | 'fpga';
  capabilities: string[];
  upfrontBudget: number;
  currency: string;
  region: string;
  /** Already owned items do not need a supplier quote. */
  ownedItemIds?: string[];
}
export interface HardwareQuote {
  itemId: string;
  unitPrice: number;
  shipping: number | null;
  tax: number | null;
  currency: string;
  region: string;
  available: boolean;
  url: string;
  observedAt: string;
  expiresAt: string;
  mode: 'live' | 'fixture';
}
export interface HardwareRecommendation {
  target: HardwareTarget;
  bom: Array<{ itemId: string; name: string; quantity: number; owned: boolean; quote?: HardwareQuote }>;
  compatibility: 'compatible' | 'incompatible';
  blockers: string[];
  landedCost: number | null;
  currency: string;
  withinBudget: boolean | null;
  purchaseReady: boolean;
  scope: 'reference-led-bringup';
}
function httpsUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}
export function getHardwareTarget(id: HardwareTargetId): HardwareTarget {
  const target = HARDWARE_TARGETS.find(item => item.id === id);
  if (!target) throw new Error(`Unsupported hardware target: ${id}`);
  return structuredClone(target);
}
export function createHardwareCatalog() {
  return {
    listTargets: () => structuredClone(HARDWARE_TARGETS),
    recommend(requirements: HardwareRequirements, quotes: HardwareQuote[] = [], now = Date.now()): HardwareRecommendation[] {
      if (!Number.isFinite(requirements.upfrontBudget) || requirements.upfrontBudget < 0 || !/^[A-Z]{3}$/.test(requirements.currency) || !requirements.region.trim() || !Number.isFinite(now)) {
        throw new Error('Hardware budget, ISO currency, region and current time are required.');
      }
      return HARDWARE_TARGETS.filter(target => !requirements.kind || target.kind === requirements.kind).map(original => {
        const target = structuredClone(original);
        const missing = requirements.capabilities.filter(cap => !target.capabilities.includes(cap));
        const blockers = missing.map(cap => `Unsupported capability: ${cap}`);
        const items = [{ id: target.id, name: target.name, quantity: 1 }, ...target.accessories];
        let total = 0;
        let known = true;
        const bom = items.map(item => {
          const owned = requirements.ownedItemIds?.includes(item.id) ?? false;
          const quote = quotes.filter(q => q.itemId === item.id && q.currency === requirements.currency && q.region === requirements.region)
            .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0];
          if (!owned) {
            const valid = quote && quote.mode === 'live' && quote.available && httpsUrl(quote.url)
              && Number.isFinite(Date.parse(quote.observedAt)) && Date.parse(quote.observedAt) <= now
              && Date.parse(quote.expiresAt) > now && Date.parse(quote.expiresAt) > Date.parse(quote.observedAt)
              && [quote.unitPrice, quote.shipping, quote.tax].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0);
            if (!valid) { known = false; blockers.push(`Current available quote including shipping/tax required: ${item.id}`); }
            else total += quote.unitPrice * item.quantity + quote.shipping! + quote.tax!;
          }
          return { itemId: item.id, name: item.name, quantity: item.quantity, owned, ...(quote ? { quote: structuredClone(quote) } : {}) };
        });
        const landedCost = known ? Math.round(total * 100) / 100 : null;
        const withinBudget = landedCost === null ? null : landedCost <= requirements.upfrontBudget;
        if (withinBudget === false) blockers.push('Hardware landed cost exceeds upfront budget.');
        return { target, bom, compatibility: missing.length ? 'incompatible' as const : 'compatible' as const,
          blockers, landedCost, currency: requirements.currency, withinBudget,
          purchaseReady: blockers.length === 0, scope: 'reference-led-bringup' as const };
      }).sort((a, b) => Number(b.purchaseReady) - Number(a.purchaseReady) || (a.landedCost ?? Infinity) - (b.landedCost ?? Infinity));
    },
  };
}
