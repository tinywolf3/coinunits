import { Decimal } from 'decimal.js';

import './style.css';
import './app.css';

import * as app from "../wailsjs/go/main/App.js";
import * as runtime from "../wailsjs/runtime/runtime.js";

function numberWithCommas(x) {
    var parts = x.toString().split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
}

const symbolElement = document.getElementById("symbol");
const decimalsElement = document.getElementById("decimals");
const amountElement = document.getElementById("amount");
const amountUnitElement = document.getElementById("unit_amount");
const uintElement = document.getElementById("uint");
const uintUnitElement = document.getElementById("unit_uint");
amountElement.focus();

window.onload = async () => {
	const json = await app.LoadConf();
	runtime.LogDebug(json);
	const data = JSON.parse(json);
	if (data?.symbol) {
		symbolElement.value = data.symbol;
	}
	if (data?.decimals) {
		decimalsElement.value = data.decimals;
	}
	if (data?.amount) {
		amountElement.value = data.amount;
	}
	window.changeSymbol();
}

runtime.EventsOn("onBeforeClose", async () => {
	runtime.LogDebug("onBeforeClose");
	const conf = {
		symbol: symbolElement.value,
		decimals: parseInt(decimalsElement.value),
		amount: amountElement.value,
	};
	const json = JSON.stringify(conf, null, 2);
	runtime.LogDebug(json);
	await app.SaveConf(json);
	app.AppClose();
});

window.changeSymbol = () => {
	let symbol = symbolElement.value;
	symbol = symbol.toUpperCase();
	symbolElement.value = symbol;
	amountUnitElement.innerHTML = symbol;
	window.changeDecimals();
}

window.changeDecimals = () => {
	window.setDecimals(decimalsElement.value);
}

window.setDecimals = (decimals) => {
	let dec = 0;
	try {
		dec = parseInt(decimals);
	} catch (e) {}
	decimalsElement.value = dec;
	let symbol = symbolElement.value;
	symbol = symbol.toLowerCase();
	if (dec < 0)
		symbol = "❌" + symbol;
	else if (dec == 0)
		symbol = "" + symbol;
	else if (dec <= 1)
		symbol = "d" + symbol;
	else if (dec <= 2)
		symbol = "c" + symbol;
	else if (dec <= 3)
		symbol = "m" + symbol;
	else if (dec <= 6)
		symbol = "0".repeat(6 - dec) + "u" + symbol;
	else if (dec <= 9)
		symbol = "0".repeat(9 - dec) + "n" + symbol;
	else if (dec <= 12)
		symbol = "0".repeat(12 - dec) + "p" + symbol;
	else if (dec <= 15)
		symbol = "0".repeat(15 - dec) + "f" + symbol;
	else if (dec <= 18)
		symbol = "0".repeat(18 - dec) + "a" + symbol;
	else if (dec <= 21)
		symbol = "0".repeat(21 - dec) + "z" + symbol;
	else if (dec <= 24)
		symbol = "0".repeat(24 - dec) + "y" + symbol;
	else if (dec <= 27)
		symbol = "0".repeat(27 - dec) + "r" + symbol;
	else if (dec <= 30)
		symbol = "0".repeat(30 - dec) + "q" + symbol;
	else
		symbol = dec + "~" + symbol;
	uintUnitElement.innerHTML = symbol;
	window.changeAmount();
}

window.inputAmount = () => {
	const decimals = parseInt(decimalsElement.value);
	let amount = amountElement.value;
	let uint;
	if (amount == null || (typeof amount === 'string' && amount.length == 0)) {
		uintElement.value = "";
		return "";
	}
	if (typeof amount === 'string') {
		if (amount.trim().endsWith(amountUnitElement.innerHTML)) {
			amount = amount.substring(0, amount.length - amountUnitElement.innerHTML.length).trim();
			amountElement.value = amount;
		}
		amount = amount.replace(/[^\.\d]/g, '');
	}
	try {
		amount = new Decimal(amount);
		uint = amount.times(new Decimal(10).toPower(decimals));
	} catch (e) {
		runtime.LogError(e);
		amount = parseFloat(amountElement.value);
		runtime.LogWarning('parseFloat: ' + amount);
		if (isNaN(amount))
			return amountElement.value;
		amount = new Decimal(uint);
		return amount.toDecimalPlaces(decimals).toFixed();
	}
	uintElement.value = uint.toDecimalPlaces(0).toFixed();
	return amount.toDecimalPlaces(decimals).toFixed();
}

window.changeAmount = () => {
	amountElement.value = numberWithCommas(window.inputAmount());
}

window.inputUint = () => {
	const decimals = parseInt(decimalsElement.value);
	let amount;
	let uint = uintElement.value;
	if (uint == null || (typeof uint === 'string' && uint.length == 0)) {
		amountElement.value = "";
		return "";
	}
	if (typeof uint === 'string') {
		if (uint.trim().endsWith(uintUnitElement.innerHTML)) {
			uint = uint.substring(0, uint.length - uintUnitElement.innerHTML.length).trim();
			uintElement.value = uint;
		}
		uint = uint.replace(/[^\.\d]/g, '');
	}
	try {
		uint = new Decimal(uint);
		amount = uint.dividedBy(new Decimal(10).toPower(decimals));
	} catch (e) {
		runtime.LogError(e);
		uint = parseInt(uintElement.value);
		runtime.LogWarning('parseInt: ' + uint);
		if (isNaN(uint))
			return uintElement.value;
		uint = new Decimal(uint);
		return uint.toDecimalPlaces(0).toFixed();
	}
	amountElement.value = amount.toDecimalPlaces(decimals).toFixed();
	return uint.toDecimalPlaces(0).toFixed();
}

window.changeUint = () => {
	uintElement.value = window.inputUint();
}

function fadeoutDiv(id) {
	const div = document.getElementById(id);
	if (div?.style) {
		div.style.opacity = 1.0;
		setTimeout(() => fadeDiv(id, -0.05, 10), 10);
	}
}

function fadeDiv(id, step, interval) {
	const div = document.getElementById(id);
	const opacity = parseFloat(div?.style?.opacity);
	if (step < 0 && opacity > 0) {
		div.style.opacity = opacity + step;
		setTimeout(() => fadeDiv(id, step, interval), interval);
	}
 	else if (step > 0 && opacity < 1) {
		div.style.opacity = opacity + step;
		setTimeout(() => fadeDiv(id, step, interval), interval);
	}
}

async function copyToClipboard(str) {
	const ret = await runtime.ClipboardSetText(str);
	if (ret) {
		document.querySelector('#app').innerHTML = `
			<div id="messagebox" class="messageBox">
				${str}<br />
				Copied
			</div>
		`;
		setTimeout(() => fadeoutDiv('messagebox'), 500);
	}
	else {
		document.querySelector('#app').innerHTML = `
			<div id="messagebox" class="messageBox">
				Not Copied
			</div>
		`;
		setTimeout(() => fadeoutDiv('messagebox'), 500);
	}
}

window.copyAmount = () => {
	copyToClipboard(amountElement.value + ' ' + amountUnitElement.innerHTML);
}

window.copyUint = () => {
	copyToClipboard(uintElement.value + uintUnitElement.innerHTML);
}
