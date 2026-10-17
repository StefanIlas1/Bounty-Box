import { getHardwareTarget, type HardwareTargetId } from './hardware';

export interface HardwareFile { path: string; content: string }
export interface HardwareCheck { id: string; tool: string; args: string[]; scope: 'compile' | 'simulation' | 'synthesis' | 'place-route' | 'pack' }
export interface HardwarePackage {
  targetId: HardwareTargetId;
  task: 'led-bringup';
  files: HardwareFile[];
  checks: HardwareCheck[];
  blockers: string[];
  physicalVerification: 'not-performed';
  artifactDigest: string;
}
export interface BoardPinMapping {
  /** Operator-verified exact revision. Never guessed from the device family. */
  revision: string;
  clockPin: number;
  ledPin: number;
  sourceUrl: string;
}
export async function hardwareDigest(files: HardwareFile[]): Promise<string> {
  const canonical = JSON.stringify([...files].sort((a, b) => a.path.localeCompare(b.path)).map(f => [f.path, f.content]));
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}

/** Reference bring-up generator, not a claim to implement an arbitrary project brief. */
export async function createHardwarePackage(targetId: HardwareTargetId, options: { blinkPeriodMs?: number; pins?: BoardPinMapping } = {}): Promise<HardwarePackage> {
  const target = getHardwareTarget(targetId);
  const period = options.blinkPeriodMs ?? 1000;
  if (!Number.isInteger(period) || period < 20 || period > 60000 || period % 2) throw new Error('blinkPeriodMs must be an even integer from 20 to 60000.');
  const files: HardwareFile[] = [];
  const checks: HardwareCheck[] = [];
  const blockers: string[] = [];
  let steps: string;
  if (targetId === 'pico-rp2040') {
    files.push({ path: 'main.c', content: `#include "pico/stdlib.h"\nint main(void) {\n  const uint led = PICO_DEFAULT_LED_PIN;\n  gpio_init(led);\n  gpio_set_dir(led, GPIO_OUT);\n  while (true) {\n    gpio_put(led, 1); sleep_ms(${period / 2});\n    gpio_put(led, 0); sleep_ms(${period / 2});\n  }\n}\n` });
    files.push({ path: 'CMakeLists.txt', content: 'cmake_minimum_required(VERSION 3.13)\ninclude($ENV{PICO_SDK_PATH}/external/pico_sdk_import.cmake)\nproject(bounty_blink C CXX ASM)\nset(CMAKE_C_STANDARD 11)\npico_sdk_init()\nadd_executable(bounty_blink main.c)\ntarget_link_libraries(bounty_blink pico_stdlib)\npico_add_extra_outputs(bounty_blink)\n' });
    checks.push({ id: 'configure', tool: 'cmake', args: ['-S', '.', '-B', 'build', '-DPICO_BOARD=pico'], scope: 'compile' },
      { id: 'firmware', tool: 'cmake', args: ['--build', 'build', '--parallel', '1'], scope: 'compile' });
    steps = `1. Confirm this is the original non-wireless RP2040 Pico, not Pico W or Pico 2.\n2. Install an operator-pinned Pico SDK (including its required submodules), CMake and ARM GNU compiler. Record their versions; set PICO_SDK_PATH to the SDK directory.\n3. Run: cmake -S . -B build -DPICO_BOARD=pico\n4. Run: cmake --build build --parallel 1\n5. After successful compilation, hold BOOTSEL while connecting a USB data cable. Copy build/bounty_blink.uf2 to the RPI-RP2 volume.\n6. The onboard LED should repeat every ${period} ms. No external wiring is needed. Record the physical observation separately.\n`;
  } else {
    const halfCycles = period / 2 * 12000;
    files.push({ path: 'blink.v', content: `module blink #(parameter integer HALF_CYCLES = ${halfCycles}) (input wire clk, output reg led_n = 1'b1);\n  reg [31:0] count = 0;\n  always @(posedge clk) begin\n    if (count == HALF_CYCLES - 1) begin\n      count <= 0;\n      led_n <= ~led_n;\n    end else count <= count + 1;\n  end\nendmodule\n` });
    files.push({ path: 'blink_tb.v', content: '`timescale 1ns/1ps\nmodule blink_tb;\n  reg clk = 0; wire led_n; integer i;\n  blink #(.HALF_CYCLES(4)) dut (.clk(clk), .led_n(led_n));\n  always #5 clk = ~clk;\n  initial begin\n    for (i = 1; i <= 16; i = i + 1) begin\n      @(posedge clk); #1;\n      if (led_n !== ((i / 4) % 2 == 0)) $fatal(1, "LED interval mismatch");\n    end\n    $display("Bounty hardware simulation passed"); $finish;\n  end\n  initial begin #1000; $fatal(1, "Simulation timeout"); end\nendmodule\n' });
    checks.push({ id: 'compile', tool: 'iverilog', args: ['-g2012', '-s', 'blink_tb', '-o', 'simulation', 'blink.v', 'blink_tb.v'], scope: 'compile' },
      { id: 'simulate', tool: 'vvp', args: ['simulation'], scope: 'simulation' },
      { id: 'synthesize', tool: 'yosys', args: ['-p', 'read_verilog blink.v; synth_ice40 -top blink -json design.json'], scope: 'synthesis' });
    const pins = options.pins;
    if (pins) {
      const url = new URL(pins.sourceUrl);
      if (url.protocol !== 'https:' || !pins.revision.trim() || ![pins.clockPin, pins.ledPin].every(n => Number.isInteger(n) && n >= 1 && n <= 48) || pins.clockPin === pins.ledPin) throw new Error('Provide distinct verified SG48 pins, exact board revision and HTTPS source.');
      files.push({ path: 'board.pcf', content: `set_io clk ${pins.clockPin}\nset_io led_n ${pins.ledPin}\n` },
        { path: 'board-mapping.json', content: JSON.stringify(pins, null, 2) + '\n' });
      checks.push({ id: 'place-route', tool: 'nextpnr-ice40', args: ['--up5k', '--package', 'sg48', '--json', 'design.json', '--pcf', 'board.pcf', '--asc', 'design.asc', '--freq', '12'], scope: 'place-route' },
        { id: 'bitstream', tool: 'icepack', args: ['design.asc', 'design.bin'], scope: 'pack' });
    } else blockers.push('Exact board revision and documented clock/active-low LED pin mapping required before place/route or flashing.');
    steps = `1. Confirm iCEBreaker with iCE40UP5K SG48, 12 MHz clock and default active-low onboard LED wiring. Verify board revision and pin mapping against its schematic.\n2. Install and record versions of Icarus Verilog, Yosys, nextpnr-ice40 and IceStorm.\n3. Run commands in validation-plan.json in order. Without board.pcf only simulation/synthesis is available; no flashable bitstream is supplied.\n4. After successful placement, routing and packing, connect the board with a USB data cable and run: iceprog design.bin\n5. Observe the LED repeating every ${period} ms. Record actual board identity and physical result. No external wiring is needed.\n`;
  }
  files.push({ path: 'hardware-manifest.json', content: JSON.stringify({ targetId, task: 'led-bringup', blinkPeriodMs: period, blockers, physicalVerification: 'not-performed' }, null, 2) + '\n' });
  files.push({ path: 'validation-plan.json', content: JSON.stringify(checks, null, 2) + '\n' });
  files.push({ path: 'ARRIVAL.md', content: `# ${target.name}: LED bring-up\n\nScope: reference onboard LED example. This is source code, not a compiled binary or proof of physical operation.\n\n${steps}\n## Required items\n\n- ${target.name}\n- ${target.accessories.map(a => a.name).join('\n- ')}\n- Development computer with the toolchain above\n\n## Sources\n\n${target.sourceUrls.map(url => '- ' + url).join('\n')}\n\n## Remaining gates\n\n${blockers.length ? blockers.join('\n') : 'Compile with the recorded SDK/toolchain; perform physical bring-up after arrival.'}\n` });
  return { targetId, task: 'led-bringup', files, checks, blockers, physicalVerification: 'not-performed', artifactDigest: await hardwareDigest(files) };
}
