mport DeviceDiscovery from "@SignalRGB/DeviceDiscovery/DeviceDiscovery.js";
export function Name() { return "Womier VK99 Custom"; }
export function VendorId() { return 0x05AC; }
export function ProductId() { return [0x024F]; }
export function Publisher() { return "Custom"; }
export function Size() { return [19, 6]; }
export function DeviceType(){ return "keyboard"; }
export function Validate(endpoint) { return endpoint.interface === 3; } // MI_03 forçada
export function ImageUrl() { return "https://assets.signalrgb.com/devices/brands/valkyrie/keyboards/vk99.png"; }

/* global
shutdownColor:readonly
LightingMode:readonly
forcedColor:readonly
*/

export function ControllableParameters(){
	return [
		{property:"shutdownColor", group:"lighting", label:"Shutdown Color", type:"color", default:"#000000"},
		{property:"LightingMode", group:"lighting", label:"Lighting Mode", type:"combobox", values:["Canvas", "Forced"], default:"Canvas"},
		{property:"forcedColor", group:"lighting", label:"Forced Color", type:"color", default:"#009bde"}
	];
}

export function Initialize() {
	SONIX.Initialize();
}

export function Render() {
	SONIX.sendColors();
}

export function Shutdown(SystemSuspending) {
	const color = SystemSuspending ? "#000000" : shutdownColor;
	SONIX.sendColors(color);
}

export class SONIX_Device_Protocol {
	constructor() {
		this.Config = {
			DeviceProductID: 0x024F,
			DeviceName: "Womier VK99 Custom",
			DeviceEndpoint: [{ "interface": 3, "usage": 0x0001, "usage_page": 0xFF13, "collection": 0x0000 }],
			LedNames: [
				"Esc",    "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12", "Del",	"Prtsc",  "Pause", "Home", "End",
				"`",   "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-_", "=+",	"Backspace", "Insert", "NumLock", "/", "*", "-",
				"Tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]",   "\\",           "PgUp", "Num 7", "Num 8", "Num 9", "+",
				"CapsLock", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'",			"Enter", "PgDn", "Num 4", "Num 5", "Num 6",
				"Left Shift",  "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "Right Shift", "Up Arrow",	 "Num 1", "Num 2", "Num 3", "Num Enter",
				"Left Ctrl", "Left Win", "Left Alt", "Space", "Right Alt", "Fn", "Right Ctrl", "Left Arrow", "Down Arrow", "Right Arrow", "Num 0", "Num ."
			],
			LedPositions: [
				[0, 0], 		[2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0], [10, 0], [11, 0], [12, 0], [13, 0], [14, 0], [15, 0], [16, 0], [17, 0], [18, 0],
				[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1], [13, 1], [14, 1], [15, 1], [16, 1], [17, 1], [18, 1],
				[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2], [13, 2], [14, 2], [15, 2], [16, 2], [17, 2], [18, 2],
				[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3],          [13, 3], [14, 3], [15, 3], [16, 3], [17, 3],
				[0, 4], 		[2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [11, 4], [12, 4], [13, 4], 		 [15, 4], [16, 4], [17, 4], [18, 4],
				[0, 5], [1, 5], [2, 5],                         [6, 5],					[9, 5], [10, 5], [11, 5], [12, 5], [13, 5], [14, 5], [15, 5], 		   [17, 5],
			],
			Leds: [
				1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,	119, 112, 115, 117, 120,
				19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 103, 116, 32, 33, 34, 122,
				37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 67, 118, 50, 51, 52, 123,
				55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66,		85, 121, 68, 69, 70,
				73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83,		84, 101, 86, 87, 88, 106,
				91, 92, 93,			94,			95, 96, 98, 99, 100, 102, 104, 105
			],
		};
	}

	Initialize() {
		console.log("Initializing Womier Custom Plugin...");
		device.setName(this.Config.DeviceName);
		device.setSize([19, 6]);
		device.setControllableLeds(this.Config.LedNames, this.Config.LedPositions);
		
		device.set_endpoint(3, 0x0001, 0xFF13, 0x0000); // Força a comunicação na MI_03
	}

	sendColors(overrideColor) {
		const RGBData = [];

		for (let iIdx = 0; iIdx < this.Config.Leds.length; iIdx++) {
			const iPxX = this.Config.LedPositions[iIdx][0];
			const iPxY = this.Config.LedPositions[iIdx][1];
			let color;

			if(overrideColor){
				color = hexToRgb(overrideColor);
			} else if (LightingMode === "Forced") {
				color = hexToRgb(forcedColor);
			} else {
				color = device.color(iPxX, iPxY);
			}

			RGBData[(this.Config.Leds[iIdx]*4)]   = this.Config.Leds[iIdx];
			RGBData[(this.Config.Leds[iIdx]*4)+1] = color[0];
			RGBData[(this.Config.Leds[iIdx]*4)+2] = color[1];
			RGBData[(this.Config.Leds[iIdx]*4)+3] = color[2];
		}

		this.writeRGBPackage(RGBData);
	}

	writeRGBPackage(data){
		device.send_report([0x00, 0x04, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08], 65);
		device.get_report([0x00], 65);

		while(data.length > 0) {
			const packet = [0x00].concat(data.splice(0, 64));
			device.send_report(packet, 65);
			device.pause(2);
		}

		device.send_report([0x00], 65);
		device.send_report([0x00, 0x04, 0x02], 65);
		device.get_report([0x00], 65);
	}
}

const SONIX = new SONIX_Device_Protocol();

function hexToRgb(hex) {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	const colors = [];
	colors[0] = parseInt(result[1], 16);
	colors[1] = parseInt(result[2], 16);
	colors[2] = parseInt(result[3], 16);
	return colors;
}