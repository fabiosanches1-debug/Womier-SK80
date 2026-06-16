import LCD from "@SignalRGB/lcd";
export function Name() { return "NZXT Kraken Elite v2"; }
export function VendorId() { return 0x1E71; }
export function Documentation(){ return "troubleshooting/nzxt"; }
export function ProductId() { return [0x3012, 0x3014]; }
export function Publisher() { return "WhirlwindFX, Cryptofyre, and RickOfficial"; }
export function Size() { return [21, 21]; }
export function DefaultPosition(){return [165, 60];}
export function DefaultScale(){return 7.0;}
export function DeviceType(){return "aio";}
/* global
shutdownColor:readonly
LightingMode:readonly
forcedColor:readonly
enableLcd:readonly
*/
export function ControllableParameters(){
	return [
		{"property":"shutdownColor", "group":"lighting", "label":"Shutdown Color", description: "This color is applied to the device when the System, or SignalRGB is shutting down", "min":"0", "max":"360", "type":"color", "default":"#000000"},
		{"property":"LightingMode", "group":"lighting", "label":"Lighting Mode", description: "Determines where the device's RGB comes from. Canvas will pull from the active Effect, while Forced will override it to a specific color", "type":"combobox", "values":["Canvas", "Forced"], "default":"Canvas"},
		{"property":"forcedColor", "group":"lighting", "label":"Forced Color", description: "The color used when 'Forced' Lighting Mode is enabled", "min":"0", "max":"360", "type":"color", "default":"#009bde"},
		{"property":"enableLcd", "group":"", "label":"Enable LCD Control", "type":"boolean", "default":"true"},
	];
}

export function DefaultComponentBrand() { return "NZXT";}
export function SupportsFanControl(){ return true; }

const DeviceMaxLedLimit = 40;
const MinimumSpeed = 25;

//Channel Name, Led Limit
const ChannelArray = [ ["Channel 1", 40] ];
const ConnectedFans = [ ];

let Pump_RPM;
let Pump_Speed;
let Fan_RPM;
let Fan_Speed;
let Liquid_Temp;
const ConnectedProbes = [];

const vLedPositions = [
	[7, 0],		[10, 0],		[13, 0],
	[5, 1],							[15, 1],
	[3, 3],									[17, 3],
	[1, 5],											[19, 5],
	[0, 7],													[20, 7],
	[0, 10],													[20, 10],
	[0, 13],													[20, 13],
	[1, 15],											[19, 15],
	[3, 17],									[17, 17],
	[5, 19],							[15, 19],
	[7, 20],		[10, 20],	[13, 20],

];

const vLedNames = [
	"Led 1", "Led 2", "Led 3", "Led 4", "Led 5", "Led 6", "Led 7", "Led 8",
	"Led 9", "Led 10", "Led 11", "Led 12", "Led 13", "Led 14", "Led 15", "Led 16",
	"Led 17", "Led 18", "Led 19", "Led 20", "Led 21", "Led 22", "Led 23", "Led 24"
];

const vLeds = [
	23,	0,	1,
	22,				2,
	21,						3,
	20,								4,
	19,								5,
	18,								6,
	17,								7,
	16,						8,
	15,						9,
	14,				10,
	13,	12,	11,
];

export function LedNames() {
	return vLedNames;
}

export function LedPositions() {
	return vLedPositions;
}

function SetupChannels(){
	device.SetLedLimit(DeviceMaxLedLimit);

	for(let i = 0; i < ChannelArray.length; i++) {
		device.addChannel(ChannelArray[i][0], ChannelArray[i][1]);
	}
}

export function onEnableLcdChanged() {
	if(enableLcd) {
		device.setProtocol("hybrid");
		device.setFrameRateTarget(30);
		LCD.initialize({ width: 640, height: 640 });
	} else {
		device.setProtocol("hid");
		device.setFrameRateTarget(30);
	}
}


export function Initialize() {
	SetupChannels();
	BurstFans();
	onEnableLcdChanged();
}

export function Render() {
	sendPumpData();
	sendChannel1Colors();
	PollFans();

	if(enableLcd) {
		writeLCDQ565();
	}
}

export function Shutdown(SystemSuspending) {
	if(SystemSuspending){
		sendChannel1Colors('#000000');
		sendPumpData('#000000');
		submitLightingColors();
	}else{
		sendChannel1Colors(shutdownColor);
		sendPumpData(shutdownColor);
		submitLightingColors();
	}
}

function WriteInt32LittleEndian(value){
	return [value & 0xFF, ((value >> 8) & 0xFF), ((value >> 16) & 0xFF), ((value >> 24) & 0xFF)];
}

function writeLCDQ565() {
	device.write([0x36, 0x01, 0x00, 0x01, 0x08], 64);
	device.pause(1);

	const frameData = LCD.getFrame({format: "NZXT::Q565"});

	device.bulk_transfer(0x02, [0x12, 0xfa, 0x01, 0xe8, 0xab, 0xcd, 0xef, 0x98, 0x76, 0x54, 0x32, 0x10, 0x08, 0x00, 0x00, 0x00].concat(WriteInt32LittleEndian(frameData.length)), 20);
	device.bulk_transfer(0x02, frameData, frameData.length, 2000);
}

function sendPumpData(overrideColor) {
	const RGBData = [];

	for(let iIdx = 0; iIdx < vLedPositions.length; iIdx++) {

		const iPxX = vLedPositions[iIdx][0];
		const iPxY = vLedPositions[iIdx][1];
		let col;

		if(overrideColor) {
			col = hexToRgb(overrideColor);
		} else if (LightingMode === "Forced") {
			col = hexToRgb(forcedColor);
		} else {
			col = device.color(iPxX, iPxY);
		}

		RGBData[vLeds[iIdx] *3] = col[1];
		RGBData[vLeds[iIdx] *3 + 1] = col[0];
		RGBData[vLeds[iIdx] *3 + 2] = col[2];
	}

	device.write([0x26, 0x14, 0x01, 0x01].concat(RGBData), 512);
	device.pause(1);
}

function sendChannel1Colors(overrideColor) {
	let ChannelLedCount = device.channel(ChannelArray[0][0]).LedCount();
	const componentChannel = device.channel(ChannelArray[0][0]);

	let RGBData = [];

	if(overrideColor){
		RGBData = device.createColorArray(overrideColor, ChannelLedCount, "Inline", "GRB");
	}else if(LightingMode === "Forced") {
		RGBData = device.createColorArray(forcedColor, ChannelLedCount, "Inline", "GRB");
	} else if(componentChannel.shouldPulseColors()) {

		ChannelLedCount = 24;

		const pulseColor = device.getChannelPulseColor(ChannelArray[0][0]);
		RGBData = device.createColorArray(pulseColor, ChannelLedCount, "Inline", "GRB");
	} else {
		RGBData = device.channel(ChannelArray[0][0]).getColors("Inline", "GRB");
	}

	device.write([0x26, 0x14, 0x02, 0x02].concat(RGBData), 512);
	device.pause(1);
}

function submitLightingColors() {
	device.write([0x26, 0x06, 0x01, 0x00, 0x01, 0x00, 0x00, 0x18, 0x00, 0x00, 0x80, 0x00, 0x32, 0x00, 0x00, 0x01], 512);
	device.pause(1);
	//hardcode count to 24 because it gets angry if you don't
}

let savedPollFanTimer = Date.now();
const PollModeInternal = 3000;

function PollFans() {
	//Break if were not ready to poll
	if (Date.now() - savedPollFanTimer < PollModeInternal) {
		return;
	}

	savedPollFanTimer = Date.now();

	if(device.fanControlDisabled()) {
		return;
	}

	getStatus();//Grab all of our RPM's and make sure stuff is connected.

	if(device.fanControlDisabled()){
		return;
	} // This catches the fanMode prop not being present.

	if(!ConnectedProbes.includes(0) && Liquid_Temp !== 0){
		ConnectedProbes.push(0);
		device.createTemperatureSensor(`Liquid Temperature`);
	}

	if(Liquid_Temp !== 0) {
		device.SetTemperature(`Liquid Temperature`, Liquid_Temp);
	}

	const pump = 1;
	const pumprpm = Pump_RPM;
	device.log(`Pump RPM: ${pumprpm}`);

	if(pumprpm > 0) {
		device.createFanControl(`Pump ${pump}`);
	}

	device.setRPM(`Pump ${pump}`, pumprpm);

	const newSpeed = device.getNormalizedFanlevel(`Pump ${pump}`) * 100;
	setPumpSpeed(newSpeed);

	//We're leaving this here in case a user for some reason doesn't use the fan hub built into the Z series coolers.
	const fan = 1;
	const fanrpm = Fan_RPM;
	device.log(`Fan ${fan}: ${fanrpm}rpm`);

	if(fanrpm > 0 && !ConnectedFans.includes(`Fan ${fan}`)) {
		ConnectedFans.push(`Fan ${fan}`);
		device.createFanControl(`Fan ${fan}`);
	}

	if(ConnectedFans.includes(`Fan ${fan}`)) {
		device.setRPM(`Fan ${fan}`, fanrpm);

		const newSpeed = device.getNormalizedFanlevel(`Fan ${fan}`) * 100;
		SetFanSpeed(newSpeed);
	}
}

function BurstFans() {
	const BurstSpeed = 50;

	if(device.fanControlDisabled()) {
		return;
	}

	device.log("Bursting Fans for RPM based Detection");

	setPumpSpeed(BurstSpeed);
	SetFanSpeed(BurstSpeed);
}

function getStatus()//This gets temp, pump, and fan status.
{
	device.write([0x74, 0x01], 512);

	do {
		const packet = device.read([0x0], 512, 1);

		if(packet[0] === 0x75 && packet[1] === 0x01) {
			Liquid_Temp = packet[15] + packet[16]/10;
			Pump_RPM = packet[18] << 8 | packet[17];
			Pump_Speed = packet[19];
			Fan_RPM = packet[24] << 8 | packet[23];
			Fan_Speed = packet[25];
			device.log("Reported Pump Speed: " + Pump_Speed + " %");
			device.log("Reported Fan Speed: " + Fan_Speed + " %");
			device.log("Liquid Temperature: " + Liquid_Temp + " °C");
			break;
		}

	}
	while(device.getLastReadSize() > 0);
}

function SetFanSpeed(speed)//I'm leaving this as a separate function because the fans can do zero rpm
{

	const packet = [0x72, 0x02, 0x01, 0x01];

	for(let RPMBytes = 0; RPMBytes < 40; RPMBytes++) {
		const Offset = RPMBytes + 4;
		packet[Offset] = speed;
	}

	device.log(`Setting Kraken Fans to ${Math.round(speed)}% `);
	device.write(packet, 512);
}

function setPumpSpeed(speed) {

	const packet = [0x72, 0x01, 0x00, 0x00];

	for(let RPMBytes = 0; RPMBytes < 40; RPMBytes++) {
		const Offset = RPMBytes + 4;
		packet[Offset] = Math.max(speed, MinimumSpeed);
	}

	device.log(`Setting Kraken Pump to ${Math.round(speed)}% `);
	device.write(packet, 512);
}

function hexToRgb(hex) {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	const colors = [];
	colors[0] = parseInt(result[1], 16);
	colors[1] = parseInt(result[2], 16);
	colors[2] = parseInt(result[3], 16);

	return colors;
}

/** @param {HidEndpoint} endpoint */
export function Validate(endpoint) {
	return endpoint.interface === 1;
}

export function ImageUrl(){
	return "https://assets.signalrgb.com/devices/brands/nzxt/aio/kraken-z3-aio.png";
}