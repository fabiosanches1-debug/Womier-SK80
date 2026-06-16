import DeviceDiscovery from "@SignalRGB/DeviceDiscovery";
export function Name() { return "SONIX Device"; }
export function VendorId() { return 0x05AC; }
export function ProductId() { return Object.keys(SONIXdeviceLibrary.PIDLibrary); }
export function Publisher() { return "WhirlwindFx"; }
export function Documentation(){ return "troubleshooting/sonix"; }
export function Size() { return [1, 1]; }
export function DeviceType(){return "keyboard";}
export function Validate(endpoint) { return endpoint.interface === 3; }
export function ImageUrl() { return "https://assets.signalrgb.com/devices/default/misc/usb-drive-render.png"; }
/* global
shutdownColor:readonly
LightingMode:readonly
forcedColor:readonly
forcedModel:readonly
*/
export function ControllableParameters(){
	return [
		{property:"shutdownColor", group:"lighting", label:"Shutdown Color", description: "This color is applied to the device when the System, or SignalRGB is shutting down", min:"0", max:"360", type:"color", default:"#000000"},
		{property:"LightingMode", group:"lighting", label:"Lighting Mode", description: "Determines where the device's RGB comes from. Canvas will pull from the active Effect, while Forced will override it to a specific color", type:"combobox", values:["Canvas", "Forced"], default:"Canvas"},
		{property:"forcedColor", group:"lighting", label:"Forced Color", description: "The color used when 'Forced' Lighting Mode is enabled", min:"0", max:"360", type:"color", default:"#009bde"},
		{property:"forcedModel", group:"lighting", label:"Forced Model", description: "Forces a specific model when automatic detection fails", type:"combobox", values: Object.keys(SONIXdeviceLibrary.LEDLibrary), default: "None"}
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
	SONIX.sendColors(color); // Go Dark on System Sleep/Shutdown
}

export function onforcedModelChanged() {
	SONIX.updateModel(forcedModel);
}

export class SONIX_Device_Protocol {
	constructor() {
		this.Config = {
			DeviceProductID: 0x0000,
			DeviceName: "SONIX Device",
			DeviceEndpoint: [{ "interface": 2, "usage": 0x0001, "usage_page": 0xFF13, "collection": 0x0000 }],
			LedNames: [],
			LedPositions: [],
			Leds: [],
		};
	}

	getDeviceProperties(id) {

		const deviceConfig = SONIXdeviceLibrary.LEDLibrary[id];

		if(!deviceConfig) {
			console.log(`Unknown Device ID: [${id}]. Reach out to support@signalrgb.com, or visit our Discord to get it added.`);
		}

		return deviceConfig;
	};

	getModelID() { return this.Config.ModelID; }
	setModelID(modelid) { this.Config.ModelID = modelid; }

	getDeviceProductId() { return this.Config.DeviceProductID; }
	setDeviceProductId(productID) { this.Config.DeviceProductID = productID; }

	getDeviceName() { return this.Config.DeviceName; }
	setDeviceName(deviceName) { this.Config.DeviceName = deviceName; }

	getDeviceEndpoint() { return this.Config.DeviceEndpoint; }
	setDeviceEndpoint(deviceEndpoint) { this.Config.DeviceEndpoint = deviceEndpoint; }

	getLedLayout() { return this.Config.layout; }
	setLedLayout(layout) { this.Config.layout = layout; }

	getLedNames() { return this.Config.LedNames; }
	setLedNames(ledNames) { this.Config.LedNames = ledNames; }

	getLedPositions() { return this.Config.LedPositions; }
	setLedPositions(ledPositions) { this.Config.LedPositions = ledPositions; }

	getLeds() { return this.Config.Leds; }
	setLeds(leds) { this.Config.Leds = leds; }

	getDeviceImage(deviceModel) { return SONIXdeviceLibrary.LEDLibrary[deviceModel].image; }

	Initialize() {
		//Initializing vars
		this.setDeviceProductId(device.productId());

		const deviceHID = device.getDeviceInfo();

		// Fetch model
		const modelID	= forcedModel === "None" ? deviceHID.product : forcedModel;

		this.updateModel(modelID);
	}

	sendColors(overrideColor) {

		if(!this.getModelID() || this.getLedLayout() === "None") {
			return;
		}

		const deviceLedPositions	= this.getLedPositions();
		const deviceLeds			= this.getLeds();
		const RGBData				= [];

		for (let iIdx = 0; iIdx < deviceLeds.length; iIdx++) {
			const iPxX = deviceLedPositions[iIdx][0];
			const iPxY = deviceLedPositions[iIdx][1];
			let color;

			if(overrideColor){
				color = hexToRgb(overrideColor);
			}else if (LightingMode === "Forced") {
				color = hexToRgb(forcedColor);
			}else{
				color = device.color(iPxX, iPxY);
			}

			RGBData[(deviceLeds[iIdx]*4)]   = deviceLeds[iIdx];
			RGBData[(deviceLeds[iIdx]*4)+1] = color[0];
			RGBData[(deviceLeds[iIdx]*4)+2] = color[1];
			RGBData[(deviceLeds[iIdx]*4)+3] = color[2];
		}

		this.writeRGBPackage(RGBData);
	}

	writeRGBPackage(data){

		// Pre-apply
		device.send_report([0x00, 0x04, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08], 65);
		device.get_report([0x00], 65);

		// Send data
		while(data.length > 0) {
			const packet = [0x00].concat(data.splice(0, 64));
			device.send_report(packet, 65);
			device.pause(2);
		}

		// Apply
		device.send_report([0x00], 65);
		device.send_report([0x00, 0x04, 0x02], 65);
		device.get_report([0x00], 65);
	}

	updateModel(modelID) {
		const DeviceProperties = this.getDeviceProperties(modelID);

		if(DeviceProperties){
			this.setModelID(modelID);
			this.setDeviceName(DeviceProperties.name);
			this.setLedLayout(DeviceProperties.layout);

			device.log(`Device model found: ` + this.getDeviceName());
			device.setName(this.getDeviceName());
			device.setImageFromUrl(this.getDeviceImage(modelID));

			if(DeviceProperties.layout === "None"){
				device.notify("Unsupported mode", `This connection mode isn't supported due to firmware limitations.`, 2);
				console.log("This connection mode isn't supported due to firmware limitations.");
			}else{
				this.setLedNames(SONIXdeviceLibrary.LEDLayout[this.getLedLayout()].vLedNames);
				this.setLedPositions(SONIXdeviceLibrary.LEDLayout[this.getLedLayout()].vLedPositions);
				this.setLeds(SONIXdeviceLibrary.LEDLayout[this.getLedLayout()].vLeds);
				this.detectDeviceEndpoint(DeviceProperties);

				device.setSize(SONIXdeviceLibrary.LEDLayout[this.getLedLayout()].size);
				device.setControllableLeds(this.getLedNames(), this.getLedPositions());
			}
		}else{
			device.notify("Unknown device", `Reach out to support@signalrgb.com, or visit our Discord to get it added.`, 0);
			console.log("Model not found in library!");
			console.log("Unknown protocol for "+ modelID);

			DeviceDiscovery.foundVirtualDevice({
				type: "keyboard",
				name: modelID,
				supported: false,
				vendorId: 0x05AC
			});
		}
	}

	detectDeviceEndpoint(deviceLibrary) {

		console.log("Searching for endpoints...");

		const deviceEndpoints = device.getHidEndpoints();

		for (let endpoints = 0; endpoints < deviceLibrary.endpoint.length; endpoints++) {
			const endpoint = deviceLibrary.endpoint[endpoints];

			for (let endpointList = 0; endpointList < deviceEndpoints.length; endpointList++) {
				const currentEndpoint = deviceEndpoints[endpointList];

				if (
					endpoint.interface	=== currentEndpoint.interface	&&
					endpoint.usage		=== currentEndpoint.usage		&&
					endpoint.usage_page	=== currentEndpoint.usage_page	&&
					endpoint.collection	=== currentEndpoint.collection	) {

					this.setDeviceEndpoint(currentEndpoint);
					device.set_endpoint(
						currentEndpoint.interface,
						currentEndpoint.usage,
						currentEndpoint.usage_page,
						currentEndpoint.collection,
					);

					console.log("Endpoint " + JSON.stringify(currentEndpoint) + " found!");

					return;
				}
			}
		}

		console.log(`Endpoints not found in the device! - ${JSON.stringify(deviceLibrary.endpoint)}`);
	}
}

export class deviceLibrary {
	constructor(){
		this.PIDLibrary	=	{
			0x024F: "SONIX Device",
		};

		this.LEDLibrary	=	{
			"Womier SK80": {
				name: "Womier SK80",
				image: "https://assets.signalrgb.com/devices/brands/valkyrie/keyboards/vk99.png",
				layout:	"SK80",
				endpoint: [{ "interface": 2, "usage": 0x0001, "usage_page": 0xFF13, "collection": 0x0000 }]
			},
			"Valkyrie-99": {
				name: "Valkyrie VK99",
				image: "https://assets.signalrgb.com/devices/brands/valkyrie/keyboards/vk99.png",
				layout:	"VK99",
				endpoint: [{ "interface": 2, "usage": 0x0001, "usage_page": 0xFF13, "collection": 0x0000 }]
			},
			"Zuoya GMK67": {
				name: "Zuoya GMK67",
				image: "https://assets.signalrgb.com/devices/brands/zuoya/keyboards/gmk67.png",
				layout:	"GMK67",
				endpoint: [{ "interface": 2, "usage": 0x0001, "usage_page": 0xFF13, "collection": 0x0000 }]
			},
			"KN85 Keyboard": {
				name: "Kisnt KN85",
				image: "https://assets.signalrgb.com/devices/brands/kisnt/keyboards/kn85.png",
				layout:	"KN85",
				endpoint: [{ "interface": 2, "usage": 0x0001, "usage_page": 0xFF13, "collection": 0x0000 }]
			},

			"2.4G Dongle": {
				name: "Wireless Dongle",
				image: "https://assets.signalrgb.com/devices/default/misc/usb-drive-render.png",
				layout:	"None",
			},
			"VK99 Wireless Receiver": {
				name: "Valkyrie VK99 Wireless",
				image: "https://assets.signalrgb.com/devices/brands/valkyrie/keyboards/vk99.png",
				layout:	"None",
			},
			"None": {
				name: "SONIX Device",
				image: "https://assets.signalrgb.com/devices/default/misc/usb-drive-render.png",
				layout:	"None",
				endpoint: [{ "interface": 2, "usage": 0x0001, "usage_page": 0xFF13, "collection": 0x0000 }]
			},

		};

		this.LEDLayout = {
                        "SK80": {
				vLedNames: [
					"Esc",    "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
					"`",   "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-_", "=+", "Backspace",  "Insert",
					"Tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]",   "\\",         "Del",
					"CapsLock", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'",   "Enter",      "Page Up",
					"Left Shift",  "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "Right Shift", "Up Arrow", "Page Down",
					"Left Ctrl", "Left Win", "Left Alt", "Space", "Right Alt","Fn", "Right Ctrl",   "Left Arrow", "Down Arrow", "Right Arrow"
				],
				vLeds:  [
					1,   2,  3,  4,  5,  6,  7,  8,   9,  10, 11, 12, 13,
					19,	20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,   103,	116,
					37,  38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49,   67,	119,
					55,   56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66,		85,	118,
					73,    74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 	84,     101, 121,
					91, 92, 93,				94,			  95, 96, 98,	99, 100, 102,
				],
				vLedPositions: [
					[0, 0], 		[2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0], [10, 0], [11, 0], [12, 0], [13, 0],
					[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1], [13, 1], [14, 1],
					[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2], [13, 2], [14, 2],
					[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3],          [13, 3], [14, 3],
					[0, 4], 		[2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [11, 4], [12, 4], [13, 4], [14, 4],
					[0, 5], [1, 5], [2, 5],                         [6, 5],					[9, 5], [10, 5], [11, 5],	  [12, 5], [13, 5], [14, 5],
				],
				size: [15, 6],
			},
			"VK99": {
				vLedNames: [
					"Esc",    "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12", "Del",	"Prtsc",  "Pause", "Home", "End",
					"`",   "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-_", "=+",	"Backspace", "Insert", "NumLock", "/", "*", "-",
					"Tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]",   "\\",           "PgUp", "Num 7", "Num 8", "Num 9", "+",
					"CapsLock", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'",			"Enter", "PgDn", "Num 4", "Num 5", "Num 6",
					"Left Shift",  "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "Right Shift", "Up Arrow",	 "Num 1", "Num 2", "Num 3", "Num Enter",
					"Left Ctrl", "Left Win", "Left Alt", "Space", "Right Alt", "Fn", "Right Ctrl", "Left Arrow", "Down Arrow", "Right Arrow", "Num 0", "Num ."
				],
				vLeds:  [
					1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,	119, 112, 115, 117, 120,
					19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 103, 116, 32, 33, 34, 122,
					37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 67, 118, 50, 51, 52, 123,
					55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66,		85, 121, 68, 69, 70,
					73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83,		84, 101, 86, 87, 88, 106,
					91, 92, 93,			94,			95, 96, 98, 99, 100, 102, 104, 105
				],
				vLedPositions: [
					[0, 0], 		[2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0], [10, 0], [11, 0], [12, 0], [13, 0], [14, 0], [15, 0], [16, 0], [17, 0], [18, 0],
					[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1], [13, 1], [14, 1], [15, 1], [16, 1], [17, 1], [18, 1],
					[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2], [13, 2], [14, 2], [15, 2], [16, 2], [17, 2], [18, 2],
					[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3],          [13, 3], [14, 3], [15, 3], [16, 3], [17, 3],
					[0, 4], 		[2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [11, 4], [12, 4], [13, 4], 		 [15, 4], [16, 4], [17, 4], [18, 4],
					[0, 5], [1, 5], [2, 5],                         [6, 5],					[9, 5], [10, 5], [11, 5], [12, 5], [13, 5], [14, 5], [15, 5], 		   [17, 5],
				],
				size: [19, 6],
			},

			"GMK67": {
				vLedNames: [
					"Esc", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-_", "=+", "Backspace",
					"Tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", "\\", "Home",
					"CapsLock", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'", "Enter", "PgUp",
					"Left Shift", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "Right Shift", "Up Arrow", "PgDn",
					"Left Ctrl", "Left Win", "Left Alt",        "Space",      "Right Alt", "ContextMenu", "Left Arrow", "Down Arrow", "Right Arrow"
				],
				vLeds:  [
					1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,	119,
					19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 103, 116,
					37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 	49,	67,
					55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66,		85, 121,
					73, 74, 75,				76,				77, 78, 79, 80, 81,
				],
				vLedPositions: [
					[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0], [10, 0], [11, 0], [12, 0], [13, 0],
					[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1], 			[13, 1], [15, 1],
					[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], 		   [12, 2],			 [15, 2],
					[0, 3], 		[2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3], 		   [12, 3],	[14, 3], [15, 3],
					[0, 4], [1, 4], [2, 4],                         [6, 4],									 [11, 4], [12, 4], [13, 4], [14, 4], [15, 4]
				],
				size: [16, 5],
			},

			"KN85": {
				vLedNames: [
					"Esc",    "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12", "Prtsc",	"Pause",
					"`",   "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-_", "=+",	"Backspace", "Insert", "Home",
					"Tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]",   "\\",           "Delete", "End",
					"CapsLock", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'",			"Enter", "PgUp", "PgDn",
					"Left Shift",  "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "Right Shift", "Up Arrow",
					"Left Ctrl", "Left Win", "Left Alt", "Space", "Right Alt", "Fn", "Right Ctrl", "Left Arrow", "Down Arrow", "Right Arrow",
				],
				vLeds:  [
					1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,	119, 112,
					19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 103, 116, 32,
					37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 67, 118, 50,
					55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66,		85, 121, 68,
					73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83,		84, 101,
					91, 92, 93,			94,			95, 96, 98, 99, 100, 102,
				],
				vLedPositions: [
					[0, 0], 		[2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0], [10, 0], [11, 0], [12, 0], [13, 0], [14, 0], [15, 0],
					[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1], [13, 1], [14, 1], [15, 1],
					[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2], [13, 2], [14, 2], [15, 2],
					[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3],          [13, 3], [14, 3], [15, 3],
					[0, 4], 		[2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [11, 4], [12, 4], 			[14, 4],
					[0, 5], [1, 5], [2, 5],                         [6, 5],					[9, 5], [10, 5], [11, 5], 		   [13, 5], [14, 5], [15, 5],
				],
				size: [16, 6],
			},
		};
	}
}

const SONIXdeviceLibrary = new deviceLibrary();
const SONIX = new SONIX_Device_Protocol();

function hexToRgb(hex) {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	const colors = [];
	colors[0] = parseInt(result[1], 16);
	colors[1] = parseInt(result[2], 16);
	colors[2] = parseInt(result[3], 16);

	return colors;
}
