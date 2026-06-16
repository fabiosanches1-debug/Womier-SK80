import LCD from "@SignalRGB/lcd";
export function Name() { return "NZXT Kraken"; }
export function VendorId() { return 0x1E71; }
export function Documentation(){ return "troubleshooting/nzxt"; }
export function ProductId() { return Object.keys(NZXTKrakenProductNames); }
export function Publisher() { return "WhirlwindFX"; }
export function Size() { return [4, 4]; }
export function DefaultPosition(){return [165, 60];}
export function DefaultScale(){return 7.0;}
export function DeviceType(){return "aio";}
export function Validate(endpoint) { return endpoint.interface === 1; }
export function ImageUrl(){ return "https://assets.signalrgb.com/devices/brands/nzxt/aio/kraken-z3-aio.png"; }
/* global
enableLcd:readonly
device
*/
export function ControllableParameters(){
	return [ 
		{"property":"enableLcd", "group":"", "label":"Enable LCD Control", "type":"boolean", "default":"true"},
	];
}

export function SupportsFanControl(){ return true; }

const NZXTKrakenProductNames = {
	0x300E: "NZXT Kraken",
	0x300C: "NZXT Kraken Elite",
};

const MinimumSpeed = 25;

//Channel Name, Led Limit
const ConnectedFans = [];

let Pump_RPM;
let Pump_Speed;
let Fan_RPM;
let Fan_Speed;
let Liquid_Temp;
const ConnectedProbes = [];
let baseModel = false;
let newFirmware = false;

export function onEnableLcdChanged() {
	if(enableLcd) {
		device.setProtocol("hybrid");
		device.setFrameRateTarget(30);

		if(baseModel) {
			LCD.initialize({ width: 240, height: 240 });
		} else {
			LCD.initialize({ width: 640, height: 640 });
		}
	} else {
		device.setProtocol("hid");
		device.setFrameRateTarget(30);
	}
}

export function Initialize() {
	const DeviceName = NZXTKrakenProductNames[device.productId()];
	device.setName(DeviceName);

	if(DeviceName === "NZXT Kraken") {
		baseModel = true;
	}

	onEnableLcdChanged()

	getFirmwareVersion();
	BurstFans();
}

export function Render() {
	PollFans();
	
	if(enableLcd) {
		writeLCD();
	}
}

export function Shutdown(SystemSuspending) {
}

function WriteInt32LittleEndian(value){
		return [value & 0xFF, ((value >> 8) & 0xFF), ((value >> 16) & 0xFF), ((value >> 24) & 0xFF)];
}


function writeLCDQ565() {
	device.write([0x36, 0x01, 0x00, 0x01, 0x08], 64);

	const frameData = LCD.getFrame({format: "NZXT::Q565"});
	
	device.bulk_transfer(0x02, [0x12, 0xfa, 0x01, 0xe8, 0xab, 0xcd, 0xef, 0x98, 0x76, 0x54, 0x32, 0x10, 0x08, 0x00, 0x00, 0x00].concat(WriteInt32LittleEndian(frameData.length)), 20);
	device.bulk_transfer(0x02, frameData, frameData.length, 2000);

	device.write([0x36, 0x02, 0x00], 64);
}

function writeLCDRGB565() {
	device.write([0x36, 0x01, 0x00, 0x01, 0x06], 64);

	const frameData = LCD.getFrame({format: "NZXT::RGB565"});
	
	device.bulk_transfer(0x02, [0x12, 0xfa, 0x01, 0xe8, 0xab, 0xcd, 0xef, 0x98, 0x76, 0x54, 0x32, 0x10, 0x06, 0x00, 0x00, 0x00, 0x00, 0xc2, 0x01], 20);
	device.bulk_transfer(0x02, frameData, frameData.length, 2000);

	device.write([0x36, 0x02, 0x00], 64);
}

function writeLCD() {
	if(baseModel) {
		writeLCDRGB565();
	} else {
		writeLCDQ565();
	}
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

function getFirmwareVersion() {
	device.write([0x10, 0x02], 64);

	const packet = device.read([0x0], 64, 10);

	if(packet[0] == 0x11 && packet[1] == 0x02) {
		const major = packet[16];
		const minor = packet[17];
		const patch = packet[18];
		device.log(`Firmware Version: ${major}.${minor}.${patch}`);

		newFirmware = (major > 2) || (major === 2 && minor > 1) || (major === 2 && minor === 1 && patch >= 1);
	}
}

function getStatus()//This gets temp, pump, and fan status.
{
	device.write([0x74, 0x01], 64);

	do {
		const packet = device.read([0x0], 64, 10);

		if(packet[0] == 0x75 && packet[1] == (newFirmware ? 0x02 : 0x01)) {
			Liquid_Temp = packet[15] + packet[16]/10;
			Pump_RPM = packet[18] << 8 | packet[17];
			Pump_Speed = packet[19];
			Fan_RPM = packet[24] << 8 | packet[23];
			Fan_Speed = packet[25];
			device.log("Reported Pump Speed: " + Pump_Speed + " %");
			device.log("Reported Fan Speed: " + Fan_Speed + " %");
			device.log("Liquid Temperature: " + Liquid_Temp + " °C");
		}
	}
	while(device.getLastReadSize() > 0);
}

function SetFanSpeed(speed)//I'm leaving this as a separate function because the fans can do zero rpm
{

	const packet = newFirmware ? [0x72, 0x02, 0x01, 0x01] : [0x72, 0x02, 0x00, 0x00];

	for(let RPMBytes = 0; RPMBytes < 40; RPMBytes++) {
		const Offset = RPMBytes + 4;
		packet[Offset] = speed;
	}

	device.log(`Setting Kraken Fans to ${Math.round(speed)}% `);
	device.write(packet, 64);
}

function setPumpSpeed(speed) {

	const packet = newFirmware ? [0x72, 0x01, 0x01, 0x00] : [0x72, 0x01, 0x00, 0x00];

	for(let RPMBytes = 0; RPMBytes < 40; RPMBytes++) {
		const Offset = RPMBytes + 4;
		packet[Offset] = Math.max(speed, MinimumSpeed);
	}

	device.log(`Setting Kraken Pump to ${Math.round(speed)}% `);
	device.write(packet, 64);
}
