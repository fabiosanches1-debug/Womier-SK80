import DeviceDiscovery from "@SignalRGB/DeviceDiscovery";
export function Name() { return "SONIX Device 2"; }
export function VendorId() { return 0x0C45; }
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
			DeviceName: "SONIX Device 2",
			DeviceEndpoint: [{ "interface": 3, "usage": 0x0001, "usage_page": 0xFF13, "collection": 0x0000 }],
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

	writeRGBPackage(RGBData){

		// Pre-apply
		device.send_report([0x00, 0x04, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08], 65);
		device.get_report([0x00], 65);

		// Send data
		while(RGBData.length > 0) {
			const packet = [0x00].concat(RGBData.splice(0, 64));
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
				vendorId: 0x0C45
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
			0x8006: "SONIX Device",
			0x8009: "SONIX Device",
			0x800A: "SONIX Device",
			0x8801: "SONIX Device",
			0x80B1: "SONIX Device",

			//0xFEFE: "SONIX Device", // Dongle
		};

		this.LEDLibrary	=	{

			"AULA F75Max": {
				name: "AULA F75 Max",
				image: "https://assets.signalrgb.com/devices/brands/aula/keyboards/f75-max.png",
				layout:	"F75 Max",
				endpoint: [{ "interface": 3, "usage": 0x0001, "usage_page": 0xFF13, "collection": 0x0000 }]
			},
			"AK820": {
				name: "AK820",
				image: "https://assets.signalrgb.com/devices/brands/ajazz/keyboards/ak820-pro.png",
				layout:	"AK820",
				endpoint: [{ "interface": 3, "usage": 0x0001, "usage_page": 0xFF13, "collection": 0x0000 }]
			},
			"AK820MAX": {
				name: "AK820 Max",
				image: "https://assets.signalrgb.com/devices/brands/ajazz/keyboards/ak820-pro.png",
				layout:	"AK820",
				endpoint: [{ "interface": 3, "usage": 0x0001, "usage_page": 0xFF13, "collection": 0x0000 }]
			},
			"AK820 MAX": {
				name: "AK820 Max",
				image: "https://assets.signalrgb.com/devices/brands/ajazz/keyboards/ak820-pro.png",
				layout:	"AK820",
				endpoint: [{ "interface": 3, "usage": 0x0001, "usage_page": 0xFF13, "collection": 0x0000 }]
			},
			"AK980 PRO": {
				name: "AK980 PRO",
				image: "https://assets.signalrgb.com/devices/brands/ajazz/keyboards/ak980-pro.png",
				layout:	"AK980",
				endpoint: [{ "interface": 3, "usage": 0x0001, "usage_page": 0xFF13, "collection": 0x0000 }]
			},
			"AJAZZ AK980 PRO 2.4G": {
				name: "AK980 PRO",
				image: "https://assets.signalrgb.com/devices/brands/ajazz/keyboards/ak980-pro.png",
				layout:	"AK980",
				endpoint: [{ "interface": 3, "usage": 0x0001, "usage_page": 0xFF13, "collection": 0x0000 }]
			},
			"AJAZZ AK35I V3 MAX": {
				name: "AJAZZ AK35I V3 MAX",
				image: "https://assets.signalrgb.com/devices/brands/ajazz/keyboards/ak35i-v3-max.png",
				layout:	"Full",
				endpoint: [{ "interface": 3, "usage": 0x0001, "usage_page": 0xFF13, "collection": 0x0000 }]
			},
			"AULA F108Pro": {
				name: "AULA F108 Pro",
				image: "https://assets.signalrgb.com/devices/brands/aula/keyboards/f108-pro.png",
				layout:	"Full",
				endpoint: [{ "interface": 3, "usage": 0x0001, "usage_page": 0xFF13, "collection": 0x0000 }]
			},
			"DP-KD-87A-000102-GMS": {
				name: "Dark Project KD87A",
				image: "https://assets.signalrgb.com/devices/brands/dark-project/keyboards/kd87a.png",
				layout:	"TKL",
				endpoint: [{ "interface": 3, "usage": 0x0001, "usage_page": 0xFF13, "collection": 0x0000 }]
			},
			"AULA L99": {
				name: "AULA L99",
				image: "https://assets.signalrgb.com/devices/brands/aula/keyboards/l99.png",
				layout:	"AULA L99",
				endpoint: [{ "interface": 3, "usage": 0x0001, "usage_page": 0xFF13, "collection": 0x0000 }]
			},
			"AULA-F98Pro V3": {
				name: "AULA F98 PRO V3",
				image: "https://assets.signalrgb.com/devices/brands/aula/keyboards/f98pro-v3.png",
				layout:	"AULA F98",
				endpoint: [{ "interface": 3, "usage": 0x0001, "usage_page": 0xFF13, "collection": 0x0000 }]
			},

			"None": {
				name: "SONIX Device",
				image: "https://assets.signalrgb.com/devices/default/misc/usb-drive-render.png",
				layout:	"None",
				endpoint: [{ "interface": 3, "usage": 0x0001, "usage_page": 0xFF13, "collection": 0x0000 }]
			},

		};

		this.LEDLayout = {

			"Full": {
				vLedNames: [
					"Esc",     "F1", "F2", "F3", "F4",   "F5", "F6", "F7", "F8",    "F9", "F10", "F11", "F12",		"Print Screen",	"Scroll Lock",	"Pause Break",
					"`", "1",  "2", "3", "4", "5",  "6", "7", "8", "9", "0",  "-",   "+",  "Backspace",				"Insert",		"Home",			"Page Up",		"NumLock", "Num /", "Num *", "Num -",
					"Tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", "\\",						"Del",			"End",			"Page Down",	"Num 7", "Num 8", "Num 9", "Num +",
					"CapsLock", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'", 			 "Enter",															"Num 4", "Num 5", "Num 6",
					"Left Shift", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", 	  "Right Shift",							"Up Arrow",						"Num 1", "Num 2", "Num 3", "Num Enter",
					"Left Ctrl", "Left Win", "Left Alt", "Space", "Right Alt", "Fn", "Menu", "Right Ctrl",			"Left Arrow",	"Down Arrow",	"Right Arrow",	"Num 0",		  "Num .",
				],
				vLeds:  [
					1,   2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,				112, 113, 115,
					19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 103,	116, 117, 118,	32, 33, 34, 122,
					37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 67,		119, 120, 121,	50, 51, 52, 123,
					55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 85,							68, 69, 70,
					73,    74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84,				101,		86, 87, 88, 106,
					91, 92, 93,		   94,			 95, 96, 97, 98,       		 99, 100,  102,	104,  105,
				],
				vLedPositions: [
					[0, 0],			[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [ 9, 0], [11, 0], [12, 0], [13, 0],		[14, 0], [15, 0], [16, 0],
					[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1], [13, 1],		[14, 1], [15, 1], [16, 1],		[17, 1], [18, 1], [19, 1], [20, 1],
					[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2], [13, 2],		[14, 2], [15, 2], [16, 2],		[17, 2], [18, 2], [19, 2], [20, 2],
					[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3], 		   [13, 3],										[17, 3], [18, 3], [19, 3],
					[0, 4], 		[2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [11, 4],		   [13, 4],				 [15, 4],				[17, 4], [18, 4], [19, 4], [20, 4],
					[0, 5], [1, 5], [2, 5],							[6, 5],							[10, 5], [11, 5], [12, 5], [13, 5],		[14, 5], [15, 5], [16, 5],		[17, 5],		  [19, 5],
				],
				size: [21, 6],
			},
			"TKL": {
				vLedNames: [
					"Esc", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",					   "PrtSc", "ScrLk", "Pause",
					"`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-_", "=+", "Backspace",                        "Insert", "Home", "Page Up",
					"Tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", "\\",                               "Del", "End", "Page Down",
					"CapsLock", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'", "Enter",								"Logo 1", "Logo 2", "Logo 3",
					"Left Shift", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "Right Shift",                                  "Up Arrow",
					"Left Ctrl", "Left Win", "Left Alt", "Space", "Right Alt", "Fn", "Menu", "Right Ctrl",  "Left Arrow", "Down Arrow", "Right Arrow",
				],
				vLeds:  [
					[
						0,   2, 3, 4, 5,    7, 8, 9, 10,    11, 12, 13, 14,     15, 16, 17,
						22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 36, 37, 38, 39,
						44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 58, 59, 60, 61,
						66, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 80,		84, 85, 86,
						88, 	90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 102,	   104,
						110, 111, 112,		116,		120, 121, 122, 123,	  125, 126, 127,
					]
				],
				vLedPositions: [
					[0, 0], [1, 0], [2, 0], [3, 0], [4, 0],         [6, 0], [7, 0], [8, 0], [9, 0], [10, 0], [11, 0], [12, 0], [13, 0],   [14, 0], [15, 0], [16, 0],
					[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1], [13, 1],   [14, 1], [15, 1], [16, 1],
					[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2], [13, 2],   [14, 2], [15, 2], [16, 2],
					[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3],          [13, 3],	  [14, 3], [15, 3], [16, 3],
					[0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4],                   [13, 4],            [15, 4],
					[0, 5], [1, 5], [2, 5],                         [6, 5],                         [10, 5], [11, 5], [12, 5], [13, 5],   [14, 5], [15, 5], [16, 5],
				],
				size: [17, 6],
			},

			// Custom
			"F75 Max": {
				vLedNames: [
					"Esc",    "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
					"`",   "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-_", "=+", "Backspace",  "Del",
					"Tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]",   "\\",         "Page Up",
					"CapsLock", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'",   "Enter",      "Page Down",
					"Left Shift",  "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "Right Shift", "Up Arrow", "End",
					"Left Ctrl", "Left Win", "Left Alt", "Space", "Fn", "Right Ctrl",   "Left Arrow", "Down Arrow", "Right Arrow"
				],
				vLeds:  [
					1,   2,  3,  4,  5,  6,  7,  8,   9,  10, 11, 12, 13,
					19,	20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,   103,	119,
					37,  38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49,   67,	118,
					55,   56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66,		85,	121,
					73,    74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 	84,     101, 120,
					91, 92, 93,				94,			  96, 98,   	99, 100, 102,
				],
				vLedPositions: [
					[0, 0], 		[2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0], [10, 0], [11, 0], [12, 0], [13, 0],
					[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1], [13, 1], [14, 1],
					[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2], [13, 2], [14, 2],
					[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3],          [13, 3], [14, 3],
					[0, 4], 		[2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [11, 4], [12, 4], [13, 4], [14, 4],
					[0, 5], [1, 5], [2, 5],                         [6, 5],					[9, 5], [10, 5], 		  [12, 5], [13, 5], [14, 5],
				],
				size: [15, 6],
			},

			"AK820": {
				vLedNames: [
					"Esc", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12", "Del",
					"`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-_", "=+", "Backspace", "Home",
					"Tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", "\\", "PgUp",
					"CapsLock", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'", "Enter", "PgDn",
					"Left Shift", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "Right Shift", "Up Arrow", "End",
					"Left Ctrl", "Left Win", "Left Alt", "Space", "Right Alt", "Fn", "Right Ctrl", "Left Arrow", "Down Arrow", "Right Arrow",
				],
				vLeds:  [
					1,   2,  3,  4,  5,  6,  7,  8,   9,  10, 11, 12, 13, 119,
					19,	20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,   103, 	  117,
					37,  38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49,   67, 	  118,
					55,   56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66,     85, 	  121,
					73,    74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 	84,     101, 122,
					91, 92, 93,				94,			  95, 96, 98,   99, 100, 102,
				],
				vLedPositions: [
					[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0], [10, 0], [11, 0], [12, 0], [13, 0],
					[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1], [13, 1], [14, 1],
					[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2], [13, 2], [14, 2],
					[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3],		   [13, 3], [14, 3],
					[0, 4],         [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [11, 4], [12, 4], [13, 4], [14, 4],
					[0, 5], [1, 5], [2, 5],							[6, 5],					[9, 5], [10, 5], [11, 5], [12, 5], [13, 5], [14, 5],
				],
				size: [15, 6],
			},

			"AK980": {
				vLedNames: [
					"Esc",    "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12", "Del",
					"`",   "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-_", "=+",	"Backspace", "Home", "NumLock", "Num /", "Num *", "Num -",
					"Tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]",   "\\",           "PgUp", "Num 7", "Num 8", "Num 9", "Num +",
					"CapsLock", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'",			"Enter", "PgDn", "Num 4", "Num 5", "Num 6",
					"Left Shift",  "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "Right Shift", "Up Arrow",	 "Num 1", "Num 2", "Num 3", "Num Enter",
					"Left Ctrl", "Left Win", "Left Alt", "Space", "Right Alt", "Fn", "Right Ctrl", "Left Arrow", "Down Arrow", "Right Arrow", "Num 0", "Num ."
				],
				vLeds:  [
					1,	2, 3, 4, 5,		6, 7, 8, 9,		10, 11, 12, 13,		119,
					19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 103, 117,	32, 33, 34, 122,
					37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 67, 118,	50, 51, 52, 123,
					55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66,		85, 121,	68, 69, 70,
					73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83,		84, 101,		86, 87, 88, 106,
					91, 92, 93,			94,			95, 96, 98,		99, 100, 102,	104,	105
				],
				vLedPositions: [
					[0, 0], 		[2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0], [10, 0], [11, 0], [12, 0], [13, 0], [14, 0],
					[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1], [13, 1], [14, 1], [15, 1], [16, 1], [17, 1], [18, 1],
					[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2], [13, 2], [14, 2], [15, 2], [16, 2], [17, 2], [18, 2],
					[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3],          [13, 3], [14, 3], [15, 3], [16, 3], [17, 3],
					[0, 4], 		[2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [11, 4], [12, 4], [13, 4], 		 [15, 4], [16, 4], [17, 4], [18, 4],
					[0, 5], [1, 5], [2, 5],                         [6, 5],					[9, 5], [10, 5], [11, 5], [12, 5], [13, 5], [14, 5], [15, 5], 		   [17, 5],
				],
				size: [19, 6],
			},

			"AULA L99": {
				vLedNames: [
					"Esc", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12", "Del", "Print Screen", "Scroll Lock", "Pause Break",
					"`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-_", "=+", "Backspace", "Home",
					"Tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", "\\", "Page Up",
					"Caps Lock", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'", "Enter", "Page Down",
					"Left Shift", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "Right Shift", "Up Arrow", "End",
					"Left Ctrl", "Left Win", "Left Alt", "Space", 	"Fn", "Right Ctrl", "Left Arrow", "Down Arrow", "Right Arrow",
				],
				vLeds:  [
					1,   2,  3,  4,  5,  6,  7,  8,   9,  10, 11, 12, 13, 119, 112, 113, 115,
					19,	20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,   103, 	  117,
					37,  38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49,   67, 	  118,
					55,   56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66,     85, 	  121,
					73,    74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 	84,     101, 120,
					91, 92, 93,				94,			  	96, 98,   99, 100, 102,
				],
				vLedPositions: [
					[0, 0], 		[2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0], [10, 0], [11, 0], [12, 0], [13, 0], [14, 0], [15, 0], [16, 0], [17, 0],
					[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1], [13, 1], [14, 1],
					[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2], [13, 2], [14, 2],
					[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3],		   [13, 3], [14, 3],
					[0, 4],         [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [11, 4], [12, 4], [13, 4], [14, 4],
					[0, 5], [1, 5], [2, 5],							[6, 5],							[10, 5], [11, 5], [12, 5], [13, 5], [14, 5],
				],
				size: [18, 6],
			},

			"AULA F98": {
				vLedNames: [
					"Esc", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12", "Del",
					"`",    "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-_", "=+",       "Backspace",                       "Num Lock", "Num /", "Num *", "Num -",
					"Tab",    "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]",              "\\",                          "Num 7", "Num 8", "Num 9", "Num +",
					"Caps Lock",    "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'",          "Enter",                          "Num 4", "Num 5", "Num 6",
					"Left Shift",    "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/",        "Right Shift",         "Up Arrow",      "Num 1", "Num 2", "Num 3", "Num Enter",
					"Left Ctrl", "Left Win", "Left Alt", "Space", 	"Right Alt", "Fn", "Right Ctrl", "Left Arrow", "Down Arrow", "Right Arrow", "Num 0", "Num .",
				],
				vLeds:  [
					1,   2,  3,  4,  5,  6,  7,  8,   9,  10, 11, 12, 13, 119,
					19,	20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 103,      32, 33, 34, 122,
					37,  38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49,   67,        50, 51, 52, 123,
					55,   56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66,     85,         68, 69, 70,
					73,    74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 	84,       101,    86, 87, 88, 106,
					91, 92, 93,		94,		95, 96, 98,   99, 100, 102, 104, 105,
				],
				vLedPositions: [
					[0, 0], [1, 0],	[2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0], [10, 0], [11, 0], [12, 0], [13, 0],
					[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1], [13, 1], [14, 1], [15, 1], [16, 1], [17, 1],
					[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2], [13, 2], [14, 2], [15, 2], [16, 2], [17, 2],
					[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3],	   [13, 3], [14, 3], [15, 3], [16, 3],
					[0, 4],         [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [11, 4], [12, 4], [13, 4], [14, 4], [15, 4], [16, 4], [17, 4],
					[0, 5], [1, 5], [2, 5],				[6, 5],			[9, 5],	[10, 5], [11, 5], [12, 5], [13, 5], [14, 5], [15, 5], [16, 5],
				],
				size: [18, 6],
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
