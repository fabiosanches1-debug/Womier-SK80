// Modifying SMBUS Plugins is -DANGEROUS- and can -DESTROY- devices.
import systeminfo from "@SignalRGB/systeminfo";
export function Name() {
  return "Asus SMBus Motherboard Controller";
}
export function Publisher() {
  return "WhirlwindFX";
}
export function Type() {
  return "SMBUS";
}
export function Size() {
  return [1, 1];
}
export function DefaultPosition() {
  return [0, 0];
}
export function DefaultScale() {
  return 8.0;
}
export function LedNames() {
  return vLedNames;
}
export function LedPositions() {
  return vLedPositions;
}
export function DeviceType() {
  return "lightingcontroller";
}
/* global
LightingMode:readonly
forcedColor:readonly
*/
export function ControllableParameters() {
  return [
    {
      property: "LightingMode",
      group: "lighting",
      label: "Lighting Mode",
      description:
        "Determines where the device's RGB comes from. Canvas will pull from the active Effect, while Forced will override it to a specific color",
      type: "combobox",
      values: ["Canvas", "Forced"],
      default: "Canvas",
    },
    {
      property: "forcedColor",
      group: "lighting",
      label: "Forced Color",
      description: "The color used when 'Forced' Lighting Mode is enabled",
      min: "0",
      max: "360",
      type: "color",
      default: "#009bde",
    },
  ];
}

const motherboardInfo = systeminfo.GetMotherboardInfo();
const MotherboardName = motherboardInfo.model;

/** @param {FreeAddressBus} bus */
export function Scan(bus) {
  const FoundAddresses = [];
  const addys = [0x39, 0x40, 0x4e, 0x4f, 0x66];

  const AsusSMBusInterface = new AsusSMBusInterfaceFree(bus);
  const AsusMobo = new AsusSMBus(AsusSMBusInterface);

  // Skip any non AMD / Nuvoton Busses

  for (const addr of addys) {
    if (!bus.IsAMDBus() && !bus.IsNuvotonBus()) {
      return [];
    }

    const result = bus.WriteQuick(addr);

    if (result === 0x00) {
      //Log good addresses
      bus.log("DeviceAddress: " + addr + " DeviceResult: " + result);

      const ValidModel = AsusMobo.TestDeviceModel(addr);
      const ValidManufacturer = AsusMobo.TestManufactureName(addr);

      if (ValidModel && ValidManufacturer) {
        bus.log(
          "Motherboard Returned Valid Model and Non-Micron Manufacturer."
        );
        FoundAddresses.push(addr);
      }
    }
  }

  return FoundAddresses;
}

const vLedNames = [];
const vLedPositions = [];

/** @type {Object<String, AuraMotherboardLed>} */
let LedChannels = {};

let configTable = [];
let deviceLEDCount = 0;
let deviceName = "";
let deviceProtocolVersion = "";
let ParentDeviceName = "";

export function SubdeviceController() {
  return true;
}

export function Initialize() {
  device.setName(MotherboardName + " Motherboard Controller");
  ParentDeviceName = MotherboardName;
  AsusMotherboard.getDeviceInformation();
  AsusMotherboard.getDeviceLEDs();
  AsusMotherboard.createSubdevices();
  AsusMotherboard.setDirectMode(0x01);
}

export function Render() {
  if (!AsusMotherboard.ValidDeviceID) {
    return;
  }

  sendColors();
}

export function Shutdown(SystemSuspending) {
  if (!AsusMotherboard.ValidDeviceID) {
    return;
  }

  if (SystemSuspending) {
    sendColors("#000000"); // Go Dark on System Sleep/Shutdown
  } else {
    AsusMotherboard.setDirectMode(0x00);
  }
}

function GetLedColor(ChannelName, Led, overrideColor) {
  if (overrideColor) {
    return hexToRgb(overrideColor);
  }

  if (LightingMode === "Forced") {
    return hexToRgb(forcedColor);
  }

  return device.subdeviceColor(ChannelName, ...Led.LedPosition);
}

function sendColors(overrideColor) {
  const RGBData = [];

  for (const ChannelName in LedChannels) {
    for (const AuraLed of LedChannels[ChannelName]) {
      const color = GetLedColor(ChannelName, AuraLed, overrideColor);

      RGBData[AuraLed.ConfigIndex * 3] = color[0];
      RGBData[AuraLed.ConfigIndex * 3 + 1] = color[2];
      RGBData[AuraLed.ConfigIndex * 3 + 2] = color[1];
    }
  }

  if (deviceProtocolVersion === "V1") {
    AsusMotherboard.auraWriteRegisterBlock(
      AsusMotherboard.auraCommands.colorCtlV1,
      RGBData.length,
      RGBData
    );
    AsusMotherboard.auraWriteRegister(AsusMotherboard.auraCommands.apply, 0x01);
  } else {
    AsusMotherboard.auraWriteRegisterBlock(
      AsusMotherboard.auraCommands.colorCtlV2,
      RGBData.length,
      RGBData
    );
  }
}

class AsusSMBusInterface {
  constructor(bus) {
    this.bus = bus;
  }
  ReadRegister() {
    this.bus.log("Unimplimented Virtual Function!");
  }
  WriteRegister() {
    this.bus.log("Unimplimented Virtual Function!");
  }
  WriteBlock() {
    this.bus.log("Unimplimented Virtual Function!");
  }
}

class AsusSMBusInterfaceFree extends AsusSMBusInterface {
  constructor(bus) {
    super(bus);
  }

  ReadRegister(address, register) {
    this.bus.WriteWord(
      address,
      0x00,
      ((register << 8) & 0xff00) | ((register >> 8) & 0x00ff)
    );

    return this.bus.ReadByte(address, 0x81);
  }

  WriteRegister(address, register, value) {
    this.bus.WriteWord(
      address,
      0x00,
      ((register << 8) & 0xff00) | ((register >> 8) & 0x00ff)
    );
    this.bus.WriteByte(address, 0x01, value);
  }
  WriteBlock(address, register, data) {
    this.bus.WriteWord(
      address,
      0x00,
      ((register << 8) & 0xff00) | ((register >> 8) & 0x00ff)
    );
    this.bus.WriteBlock(address, 0x03, data.length, data);
  }
}

class AsusSMBusInterfaceFixed extends AsusSMBusInterface {
  constructor(bus) {
    super(bus);
  }

  WriteBlock(register, data) {
    this.bus.WriteWord(
      0x00,
      ((register << 8) & 0xff00) | ((register >> 8) & 0x00ff)
    );
    this.bus.WriteBlock(0x03, data.length, data);
  }

  WriteRegister(register, value) {
    this.bus.WriteWord(
      0x00,
      ((register << 8) & 0xff00) | ((register >> 8) & 0x00ff)
    );
    this.bus.WriteByte(0x01, value);
  }
  ReadRegister(register) {
    this.bus.WriteWord(
      0x00,
      ((register << 8) & 0xff00) | ((register >> 8) & 0x00ff)
    );

    return this.bus.ReadByte(0x81);
  }
}

class AsusSMBus {
  constructor(Interface) {
    this.Interface = Interface;

    this.registers = {
      DeviceName: 0x1000,
      ManufactureName: 0x1025,
    };

    this.deviceNameDict = {
      "LED-0116": "V1",
      "AUMA0-E8K4-0101": "V1",
      "AUMA0-E6K5-0104": "V2",
      "AUMA0-E6K5-0105": "V2",
      "AUMA0-E6K5-0106": "V2",
      "AUMA0-E6K5-0107": "GPU V2",
    };
  }

  Bus() {
    return this.Interface.bus;
  }

  IsFixedBus() {
    return this.Interface instanceof AsusSMBusInterfaceFixed;
  }

  TestDeviceModel(address) {
    // This can only be used while we have a free address bus.
    // if we do we can't directly call bus. We need to use this.Bus()
    if (this.IsFixedBus()) {
      this.Bus().log(
        'Bus Interface must be a "Free" Type to use this function! This can only be done inside of the Scan() export.'
      );

      return false;
    }

    const Characters = [];

    for (let iIdx = 0; iIdx < 16; iIdx++) {
      const iRet = this.Interface.ReadRegister(
        address,
        this.registers.DeviceName + iIdx
      );
      this.Bus().pause(3);

      if (iRet > 0) {
        Characters.push(iRet);
      } else {
        this.Bus().log(
          `Address: [${address}], Failed to read Device Model Character: [${iIdx}]`,
          { toFile: true }
        );
        // throw new Error(
        // 	`Failed to read Device Model Character: [${iIdx}]`
        // ); // Stop the scan if we can't read a character
      }
    }

    const DeviceModel = String.fromCharCode(...Characters);

    this.Bus().log(
      `Address: [${address}], Found Device Model: [${DeviceModel}]`,
      { toFile: true }
    );

    if (DeviceModel in this.deviceNameDict) {
      return true;
    }
  }

  TestManufactureName(address) {
    // This can only be used while we have a free address bus.
    // if we do we can't directly call bus. We need to use this.Bus()
    if (this.IsFixedBus()) {
      this.Bus().log(
        'Bus Interface must be a "Free" Type to use this function! This can only be done inside of the Scan() export.'
      );

      return false;
    }

    const Characters = [];

    for (let iIdx = 0; iIdx < 21; iIdx++) {
      const iRet = this.Interface.ReadRegister(
        address,
        this.registers.ManufactureName + iIdx
      );
      this.Bus().pause(3);

      if (iRet > 0) {
        Characters.push(iRet);
      }
    }

    const ManufactureName = String.fromCharCode(...Characters);

    const InvalidManufactureString = ManufactureName.includes("Micron");

    if (InvalidManufactureString) {
      this.Bus().log(
        `Address: [${address}], Found Micron Manufacturer Name: [${ManufactureName}]`
      );

      return false;
    }

    this.Bus().log(
      `Valid Manufacture Name on address: [${address}]. Address Found: [${ManufactureName}]`
    );

    return true;
  }
}

class AsusAuraSMBusController {
  constructor() {
    this.registers = {
      command: 0x00,
      direction: 0x01,
      speed: 0x02,
      color: 0x03,
    };

    this.commands = {
      action: 0x80,
      speed: 0x20,
      direction: 0x24,
      apply: 0x2f,
    };

    this.speeds = {
      slow: 0x05,
      medium: 0x00,
      fast: 0xfb,
    };

    this.auraCommands = {
      deviceName: 0x1000,
      configTable: 0x1c00,
      directAccess: 0x8020,
      effectMode: 0x8021,
      colorCtlV1: 0x8000,
      colorCtlV2: 0x8100,
      apply: 0x80a0,
    };

    this.ledConfigs = {
      V1: 0x13,
      V2: 0x1b,
    };

    this.ValidDeviceID = false;

    this.deviceNameDict = {
      "LED-0116": "V1",
      "AUMA0-E8K4-0101": "V1",
      "AUDA0-E6K5-0101": "V2",
      "AUMA0-E6K5-0104": "V2",
      "AUMA0-E6K5-0105": "V2",
      "AUMA0-E6K5-0106": "V2",
      "AUMA0-E6K5-0107": "V2",
    };
    //Map of zones to their respective names
    this.motherboardZones = {
      0x04: "Sync",
      0x05: "DRAM_2",
      0x82: "Center_Start",
      0x83: "Center",
      0x84: "Audio",
      0x85: "Back_IO",
      0x86: "RGBHeader",
      0x87: "RGBHeader_2",
      0x88: "Backplate",
      0x8a: "DRAM",
      0x8b: "PCIE",
      0x91: "RGBHeader_3",
      0x95: "QLED",
      0x98: "Power/Reset",
      0x99: "Chipset Top",
      0x9a: "Chipset Middle",
      0x9b: "Chipset Bottom",
      0x9c: "Chipset Bottom Zone 2",
      0xa0: "IOShield",
      0xa2: "M.2 Cover",
      0xa3: "M.2 Cover Zone 2",
    };
  }

  auraReadRegister(reg) {
    bus.WriteWord(0x00, ((reg << 8) & 0xff00) | ((reg >> 8) & 0x00ff));

    return bus.ReadByte(0x81);
  }

  auraWriteRegister(reg, value) {
    bus.WriteWord(0x00, ((reg << 8) & 0xff00) | ((reg >> 8) & 0x00ff));

    bus.WriteByte(this.registers.direction, value);
  }

  auraWriteRegisterBlock(reg, size, data) {
    bus.WriteWord(0x00, ((reg << 8) & 0xff00) | ((reg >> 8) & 0x00ff));
    bus.WriteBlock(this.registers.color, size, data);
  }

  createSubdevices() {
    // For each Led Channel we found before
    for (const ChannelName of Object.keys(LedChannels)) {
      const vChannelLEDNames = [];
      const vChannelLEDPositions = [];

      for (let i = 0; i < LedChannels[ChannelName].length; i++) {
        vChannelLEDNames.push(`LED ${i + 1}`);
        vChannelLEDPositions.push([i, 0]);
      }

      device.log(
        `Channel ${ChannelName} has ${LedChannels[ChannelName].length} LEDs.`
      );

      device.createSubdevice(ChannelName);
      device.setSubdeviceName(
        ChannelName,
        `${ParentDeviceName} - ${ChannelName}`
      );
      device.setSubdeviceSize(ChannelName, LedChannels[ChannelName].length, 1);
      device.setSubdeviceLeds(
        ChannelName,
        vChannelLEDNames,
        vChannelLEDPositions
      );
    }
  }

  getDeviceLEDs() {
    const ProtocolVersionOffset = this.ledConfigs[deviceProtocolVersion];
    let RGBHeaderCount = 0;
    LedChannels = {}; //No more infinite led glitch.

    for (let i = 0; i < deviceLEDCount; i++) {
      // Get Zone name of the current LED in the config table
      const Led = configTable[ProtocolVersionOffset + i];

      if (!this.motherboardZones.hasOwnProperty(Led)) {
        device.log(`unknown channel idx: ${ProtocolVersionOffset} + ${i}`);
        continue;
      }

      let ChannelName =
        this.motherboardZones[configTable[ProtocolVersionOffset + i]];

      // Rename 12V Headers as they can share a name in the config table
      if (ChannelName.includes("RGBHeader")) {
        ChannelName = `RGB Header ${++RGBHeaderCount}`;
      }

      // Add Empty Channel array if it doesn't exist;
      if (!LedChannels.hasOwnProperty(ChannelName)) {
        LedChannels[ChannelName] = [];
      }

      const ChannelLength = LedChannels[ChannelName].length;

      LedChannels[ChannelName].push(
        new AuraMotherboardLed(i, ChannelLength, [ChannelLength, 0])
      );
    }
  }

  getDeviceInformation() {
    deviceName = this.getDeviceName();
    deviceProtocolVersion = this.deviceNameDict[deviceName];
    configTable = this.getDeviceConfigTable();
    deviceLEDCount = configTable[2];

    for (let attempts = 0; attempts < 5; attempts++) {
      if (deviceName in this.deviceNameDict) {
        device.log(`Init hit on attempt: ${attempts}.`);
        break;
      } else {
        deviceName = this.getDeviceName();
        deviceProtocolVersion = this.deviceNameDict[deviceName];

        configTable = this.getDeviceConfigTable();
        device.log(configTable);

        deviceLEDCount = configTable[2];
      }
    }

    if (deviceName in this.deviceNameDict) {
      this.ValidDeviceID = true;
    } else {
      device.log("Invalid Model Returned, Aborting Render Loop");
    }

    device.log("Device Type: " + deviceName, { toFile: true });
    device.log("Device Protocol Version: " + deviceProtocolVersion, {
      toFile: true,
    });
    device.log("Device Onboard LED Count: " + deviceLEDCount, {
      toFile: true,
    });
  }

  getDeviceName() {
    const deviceName = [];

    for (let iIdx = 0; iIdx < 16; iIdx++) {
      const character = this.auraReadRegister(
        this.auraCommands.deviceName + iIdx
      );
      device.pause(3);

      if (character > 0) {
        deviceName.push(character);
      }
    }

    return String.fromCharCode(...deviceName);
  }

  getDeviceConfigTable() {
    const configTable = new Array(65);

    for (let iIdx = 0; iIdx < 64; iIdx++) {
      configTable[iIdx] = this.auraReadRegister(
        this.auraCommands.configTable + iIdx
      );
      device.pause(3);
    }

    device.log("Config Table", { toFile: true });

    for (let i = 0; i < configTable.length; i += 8) {
      device.log(configTable.slice(i, i + 8), { toFile: true });
    }

    return configTable;
  }

  setDirectMode(enabled) {
    this.auraWriteRegister(this.auraCommands.directAccess, enabled);
    this.auraWriteRegister(this.auraCommands.apply, 0x01);
  }
}

const AsusMotherboard = new AsusAuraSMBusController();

class AuraMotherboardLed {
  constructor(ConfigIndex, ChannelIndex, LedPosition) {
    this.ConfigIndex = ConfigIndex;
    this.ChannelIndex = ChannelIndex;
    this.LedPosition = LedPosition;
  }
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  const colors = [];
  colors[0] = parseInt(result[1], 16);
  colors[1] = parseInt(result[2], 16);
  colors[2] = parseInt(result[3], 16);

  return colors;
}

export function ImageUrl() {
  return "https://assets.signalrgb.com/devices/brands/asus/motherboards/motherboard.png";
}
