import { Decimal } from 'decimal.js';

import './style.css';
import './app.css';
import { Buffer } from "buffer";
window.Buffer = Buffer;

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
const rpcElement = document.getElementById("rpc");
const tokenElement = document.getElementById("token");
const addrElement = document.getElementById("address");
const netElement = document.getElementById("network");
let nettype = null;
let evm_chains = {};
amountElement.focus();

function evmBufferFromHex(hex /*string*/) /*Buffer*/ {
	if (hex === undefined || hex === '0x' || hex === '0x0' || hex === '0x00') {
		return Buffer.alloc(0);
	}
	if (hex.startsWith('0x')) {
		hex = hex.substring(2);
	}
	if (hex.length % 2 == 1) {
		hex = '0' + hex;
	}
	return Buffer.from(hex, 'hex');
}

function evmBufferToAddress(buffer /*Buffer*/) {
	if (buffer.length < 20) throw new Error('Buffer length must be 20');
	else if (buffer.length > 20)
		buffer = buffer.slice(buffer.length - 20, buffer.length);
	return eip55('0x' + buffer.toString('hex'));
}

function evmDataToParams(types /*string[]*/, data /*Buffer*/) /*any[]*/ {
	const params = [];
	let idx = 0;
	for (const type of types) {
		const buff = data.slice(idx, idx + 32);
		try {
			switch (type) {
				case 'number':
					{
						const n = parseInt(buff.toString('hex'), 16);
						params.push(n);
					}
					break;

				case 'bignumber':
					{
						const bn = new Decimal('0x' + buff.toString('hex'));
						params.push(bn);
					}
					break;

				case 'address':
					{
						const addr = evmBufferToAddress(buff);
						params.push(addr);
					}
					break;

				case 'bool':
					{
						const n = parseInt(buff.toString('hex'), 16);
						params.push(n != 0);
					}
					break;

				case 'string':
					{
						const pos = parseInt(buff.toString('hex'), 16);
						const len = parseInt(
							data.slice(pos, pos + 32).toString('hex'),
							16
						);
						const str = data.slice(pos + 32, pos + 32 + len).toString('utf8');
						params.push(str);
					}
					break;

				case 'bytes':
					{
						const pos = parseInt(buff.toString('hex'), 16);
						const len = parseInt(
							data.slice(pos, pos + 32).toString('hex'),
							16
						);
						const buf = Buffer.from(data.slice(pos + 32, pos + 32 + len));
						params.push(buf);
					}
					break;

				default:
					break;
			}
		} catch (e) {
			let message = 'Unknown Error';
			if (e instanceof Error) message = e.message;
			idx /= 32;
			throw new Error(
				'Cannot parse params: ' + idx + ' type ' + type + '\n' + message
			);
		}
		idx += 32;
	}
	return params;
}


function checkPlatform() {
	const userAgent = window.navigator.userAgent,
		platform = window.navigator?.userAgentData?.platform || window.navigator.platform,
		macosPlatforms = ['macOS', 'Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'],
		windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'],
		iosPlatforms = ['iPhone', 'iPad', 'iPod'];
	let os = null;

	if (macosPlatforms.indexOf(platform) !== -1) {
		os = 'Mac OS';
	} else if (iosPlatforms.indexOf(platform) !== -1) {
		os = 'iOS';
	} else if (windowsPlatforms.indexOf(platform) !== -1) {
		os = 'Windows';
	} else if (/Android/.test(userAgent)) {
		os = 'Android';
	} else if (/Linux/.test(platform)) {
		os = 'Linux';
	}

	return os;
}

window.onload = async () => {
	const os = checkPlatform();
	if (os === 'Linux') {
		// 리눅스는 뒷배경이 투명하지 않으므로 배경색 정의
		const html = document.querySelector("html");
		html.classList.add("default_background");
	}

	const json = await app.LoadConf();
	runtime.LogDebug(json);
	const conf = JSON.parse(json);
	if (conf?.symbol) {
		symbolElement.value = conf.symbol;
	}
	if (conf?.decimals) {
		decimalsElement.value = conf.decimals;
	}
	if (conf?.amount) {
		amountElement.value = conf.amount;
	}
	if (conf?.rpc) {
		rpcElement.value = conf.rpc;
	}
	if (conf?.token) {
		tokenElement.value = conf.token;
	}
	if (conf?.address) {
		addrElement.value = conf.address;
	}
	window.changeSymbol();

	const res = await fetch('https://chainid.network/chains_mini.json')
		.catch((e) => { console.debug(e); return null; });
	if (res?.ok) {
		const data = await res.json();
		// console.debug(data);
		if (Array.isArray(data)) {
			for (const item of data) {
				if (evm_chains.hasOwnProperty(item.chainId))
					continue;
				evm_chains[item.chainId] = item;
			}
		}
	}

	if (typeof rpcElement.value === 'string' && rpcElement.value.length > 0) {
		await window.checkRPC();
		if (typeof tokenElement.value === 'string' && tokenElement.value.length > 0) {
			await window.applyToken();
		}
	}
}

runtime.EventsOn("onBeforeClose", async () => {
	runtime.LogDebug("onBeforeClose");
	const conf = {
		symbol: symbolElement.value,
		decimals: parseInt(decimalsElement.value),
		amount: amountElement.value,
		rpc: rpcElement.value,
		token: tokenElement.value,
		address: addrElement.value,
	};
	const json = JSON.stringify(conf, null, 2);
	runtime.LogDebug(json);
	await app.SaveConf(json);
	app.AppClose();
});

window.changeSymbol = () => {
	let symbol = symbolElement.value;
	if (nettype !== 'evm')
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
	} catch (e) { }
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
	window.changeAmount();
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

window.resetRPC = () => {
	netElement.innerText = '';
	nettype = null;
}

window.changeRPC = (network) => {
	window.resetRPC();
	switch (network) {
		case 'XPLA': {
			rpcElement.value = 'https://dimension-lcd.xpla.dev';
		} break;
		case 'ATOM': {
			rpcElement.value = 'https://cosmos-rest.publicnode.com';
		} break;
		case 'ETH': {
			rpcElement.value = 'https://ethereum-rpc.publicnode.com';
		} break;
		case 'BNB': {
			rpcElement.value = 'https://bsc-dataseed2.binance.org/';
		} break;
	}
}

window.checkRPC = async () => {
	let rpc = rpcElement.value;
	if (typeof rpc !== 'string' || rpc.length < 1 || !rpc.startsWith('http')) {
		document.querySelector('#app').innerHTML = `
			<div id="messagebox" class="errorBox">
				URL is not valid
			</div>
		`;
		setTimeout(() => fadeoutDiv('messagebox'), 700);
		return;
	}
	if (rpc.endsWith('/')) {
		rpc = rpc.substring(0, rpc.length - 1);
		rpcElement.value = rpc;
	}

	// check for evm
	let res = await fetch(rpc, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			jsonrpc: '2.0',
			method: 'eth_chainId',
			params: [],
			id: 0,
		}),
	}).catch((e) => { console.debug(e); return null; });
	if (res?.ok) {
		const data = await res.json();
		console.debug(data);
		if (typeof data?.result === 'string') {
			try {
				const chain = parseInt(data.result, 16);
				if (chain in evm_chains) {
					const item = evm_chains[chain];
					document.querySelector('#app').innerHTML = `
						<div id="messagebox" class="messageBox">
							EVM RPC<br />
							chain: [${chain}] ${item.name}
						</div>
					`;
					setTimeout(() => fadeoutDiv('messagebox'), 2000);
					netElement.innerText = `[${chain}] ${item.name}`;
					nettype = 'evm';
					return;
				}
			}
			catch (e) {
				console.error(e);
			}
		}
	}

	// check for cosmos status
	res = await fetch(`${rpc}/cosmos/base/tendermint/v1beta1/node_info`)
		.catch((e) => { console.debug(e); return null; });
	if (res?.ok) {
		const data = await res.json();
		console.debug(data);
		if (typeof data?.default_node_info?.network === 'string') {
			document.querySelector('#app').innerHTML = `
				<div id="messagebox" class="messageBox">
					Cosmos LCD<br />
					chain-id: ${data.default_node_info.network}
				</div>
			`;
			setTimeout(() => fadeoutDiv('messagebox'), 2000);
			netElement.innerText = data.default_node_info.network;
			nettype = 'cosmos';
			return;
		}
	}

	document.querySelector('#app').innerHTML = `
		<div id="messagebox" class="errorBox">
			Calling API failed.
		</div>
	`;
	setTimeout(() => fadeoutDiv('messagebox'), 700);
	netElement.innerText = '';
	nettype = null;
}

window.applyToken = async () => {
	if (nettype !== 'cosmos' && nettype !== 'evm') {
		document.querySelector('#app').innerHTML = `
			<div id="messagebox" class="errorBox">
				API type is unknown.<br />
				Please, 'Check' API URL first.
			</div>
		`;
		setTimeout(() => fadeoutDiv('messagebox'), 2000);
		return;
	}
	let rpc = rpcElement.value;

	const token = tokenElement.value;

	// native token
	if (typeof token !== 'string' || token.length < 1) {
		switch (nettype) {
			// check for cosmos
			case 'cosmos': {
				const res = await fetch(`${rpc}/cosmos/staking/v1beta1/params`)
					.catch((e) => { console.debug(e); return null; });
				if (res?.ok) {
					const data = await res.json();
					console.debug(data);
					if (typeof data?.params?.bond_denom === 'string') {
						const denom = data.params.bond_denom;
						switch (denom[0]) {
							case 'd':
								decimalsElement.value = 1;
								break;
							case 'c':
								decimalsElement.value = 2;
								break;
							case 'm':
								decimalsElement.value = 3;
								break;
							case 'u':
								decimalsElement.value = 6;
								break;
							case 'n':
								decimalsElement.value = 9;
								break;
							case 'p':
								decimalsElement.value = 12;
								break;
							case 'f':
								decimalsElement.value = 15;
								break;
							case 'a':
								decimalsElement.value = 18;
								break;
							case 'a':
								decimalsElement.value = 18;
								break;
							case 'z':
								decimalsElement.value = 21;
								break;
							case 'y':
								decimalsElement.value = 24;
								break;
							case 'r':
								decimalsElement.value = 27;
								break;
							case 'q':
								decimalsElement.value = 30;
								break;
							default:
								decimalsElement.value = 0;
								break;
						}
						symbolElement.value = denom.substring(1).toUpperCase();
						window.changeSymbol();
						document.querySelector('#app').innerHTML = `
							<div id="messagebox" class="messageBox">
								<b>Native Token</b><br />
								Symbol: ${symbolElement.value}<br />
								Decimals: ${decimalsElement.value}
							</div>
						`;
						setTimeout(() => fadeoutDiv('messagebox'), 2000);
						return;
					}
				}
			} break;

			// check for evm
			case 'evm': {
				const res = await fetch(rpc, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						jsonrpc: '2.0',
						method: 'eth_chainId',
						params: [],
						id: 0,
					}),
				}).catch((e) => { console.debug(e); return null; });
				if (res?.ok) {
					const data = await res.json();
					console.debug(data);
					if (typeof data?.result === 'string') {
						try {
							const chain = parseInt(data.result, 16);
							if (chain in evm_chains) {
								const item = evm_chains[chain];
								symbolElement.value = item.nativeCurrency.symbol;
								decimalsElement.value = item.nativeCurrency.decimals;
								window.changeSymbol();
								document.querySelector('#app').innerHTML = `
									<div id="messagebox" class="messageBox">
										<b>Native Token</b><br />
										Symbol: ${symbolElement.value}<br />
										Decimals: ${decimalsElement.value}
									</div>
								`;
								setTimeout(() => fadeoutDiv('messagebox'), 2000);
								return;
							}
						}
						catch (e) {
							console.error(e);
						}
					}
				}
			} break;

			default: {
				document.querySelector('#app').innerHTML = `
					<div id="messagebox" class="errorBox">
						API type is not valid.
					</div>
				`;
				setTimeout(() => fadeoutDiv('messagebox'), 2000);
				return;
			} break;
		}
	}
	//cw20 or erc20 token
	else {
		switch (nettype) {
			// cosmos token
			case 'cosmos': {
				const res = await fetch(`${rpc}/cosmwasm/wasm/v1/contract/${token}/smart/eyJ0b2tlbl9pbmZvIjp7fX0%3D`)
					.catch((e) => { console.debug(e); return null; });
				if (res?.ok) {
					const data = await res.json();
					console.debug(data);
					if (typeof data?.data?.symbol === 'string') {
						symbolElement.value = data.data.symbol;
						decimalsElement.value = data.data.decimals;
						window.changeSymbol();
						document.querySelector('#app').innerHTML = `
							<div id="messagebox" class="messageBox">
								<b>CW20 Token</b><br />
								Symbol: ${symbolElement.value}<br />
								Decimals: ${decimalsElement.value}
							</div>
						`;
						setTimeout(() => fadeoutDiv('messagebox'), 2000);
						return;
					}
				}
			} break;

			// evm token
			case 'evm': {
				const res = await fetch(rpc, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						jsonrpc: '2.0',
						method: 'eth_call',
						params: [
							{	// symbol()
								data: '0x95d89b410000000000000000000000000000000000000000000000000000000000000000',
								to: token,
							},
							'latest'
						],
						id: 0,
					}),
				}).catch((e) => { console.debug(e); return null; });
				if (res?.ok) {
					const data = await res.json();
					// console.debug(data);
					if (typeof data?.result === 'string') {
						console.debug(evmDataToParams(['string'], evmBufferFromHex(data.result)));
						symbolElement.value = evmDataToParams(['string'], evmBufferFromHex(data.result))[0];
						const res = await fetch(rpc, {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								jsonrpc: '2.0',
								method: 'eth_call',
								params: [
									{	// decimals()
										data: '0x313ce5670000000000000000000000000000000000000000000000000000000000000000',
										to: token,
									},
									'latest'
								],
								id: 0,
							}),
						}).catch((e) => { console.debug(e); return null; });
						if (res?.ok) {
							const data = await res.json();
							console.debug(data);
							if (typeof data?.result === 'string') {
								decimalsElement.value = evmDataToParams(['number'], evmBufferFromHex(data.result))[0];
								window.changeSymbol();
								document.querySelector('#app').innerHTML = `
									<div id="messagebox" class="messageBox">
										<b>ERC20 Token</b><br />
										Symbol: ${symbolElement.value}<br />
										Decimals: ${decimalsElement.value}
									</div>
								`;
								setTimeout(() => fadeoutDiv('messagebox'), 2000);
								return;
							}
						}
					}
				}
			} break;

			default: {
				document.querySelector('#app').innerHTML = `
					<div id="messagebox" class="errorBox">
						API type is not valid.
					</div>
				`;
				setTimeout(() => fadeoutDiv('messagebox'), 2000);
				return;
			} break;
		}
	}
	document.querySelector('#app').innerHTML = `
		<div id="messagebox" class="errorBox">
			Calling API is failed.
		</div>
	`;
	setTimeout(() => fadeoutDiv('messagebox'), 2000);
}


window.getBalance = async () => {
	if (nettype !== 'cosmos' && nettype !== 'evm') {
		document.querySelector('#app').innerHTML = `
			<div id="messagebox" class="errorBox">
				API type is unknown.<br />
				Please, 'Check' API URL first.
			</div>
		`;
		setTimeout(() => fadeoutDiv('messagebox'), 2000);
		return;
	}
	let rpc = rpcElement.value;

	const token = tokenElement.value;
	const address = addrElement.value;
	const denom = uintUnitElement.innerText;

	// native token
	if (typeof token !== 'string' || token.length < 1) {
		switch (nettype) {
			// check for cosmos
			case 'cosmos': {
				const res = await fetch(`${rpc}/cosmos/bank/v1beta1/balances/${address}/by_denom?denom=${denom}`)
					.catch((e) => { console.debug(e); return null; });
				if (res?.ok) {
					const data = await res.json();
					console.debug(data);
					if (typeof data?.balance?.amount === 'string') {
						uintElement.value = (new Decimal(data.balance.amount)).toDecimalPlaces(0).toFixed();
						window.changeUint();
						document.querySelector('#app').innerHTML = `
							<div id="messagebox" class="messageBox">
								balance: ${uintElement.value}
							</div>
						`;
						setTimeout(() => fadeoutDiv('messagebox'), 500);
						return;
					}
				}
			} break;

			// check for evm
			case 'evm': {
				const res = await fetch(rpc, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						jsonrpc: '2.0',
						method: 'eth_getBalance',
						params: [
							address.startsWith('0x') ? address : '0x' + address,
							'latest',
						],
						id: 0,
					}),
				}).catch((e) => { console.debug(e); return null; });
				if (res?.ok) {
					const data = await res.json();
					console.debug(data);
					if (typeof data?.result === 'string') {
						uintElement.value = evmDataToParams(['bignumber'], evmBufferFromHex(data.result))[0].toFixed();
						window.changeUint();
						document.querySelector('#app').innerHTML = `
							<div id="messagebox" class="messageBox">
								balance: ${uintElement.value}
							</div>
						`;
						setTimeout(() => fadeoutDiv('messagebox'), 500);
						return;
					}
				}
			} break;

			default: {
				document.querySelector('#app').innerHTML = `
					<div id="messagebox" class="errorBox">
						API type is not valid.
					</div>
				`;
				setTimeout(() => fadeoutDiv('messagebox'), 2000);
				return;
			} break;
		}
	}
	//cw20 or erc20 token
	else {
		switch (nettype) {
			// cosmos token
			case 'cosmos': {
				const query = Buffer.from(`{"balance":{"address":"${address}"}}`).toString('base64');
				const res = await fetch(`${rpc}/cosmwasm/wasm/v1/contract/${token}/smart/${encodeURIComponent(query)}`)
					.catch((e) => { console.debug(e); return null; });
				if (res?.ok) {
					const data = await res.json();
					console.debug(data);
					if (typeof data?.data?.balance === 'string') {
						uintElement.value = (new Decimal(data.data.balance)).toDecimalPlaces(0).toFixed();
						window.changeUint();
						document.querySelector('#app').innerHTML = `
							<div id="messagebox" class="messageBox">
								balance: ${uintElement.value}
							</div>
						`;
						setTimeout(() => fadeoutDiv('messagebox'), 500);
						return;
					}
				}
			} break;

			// evm token
			case 'evm': {
				const res = await fetch(rpc, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						jsonrpc: '2.0',
						method: 'eth_call',
						params: [
							{	// balanceOf(address)
								data: '0x70a08231000000000000000000000000' + (address.startsWith('0x') ? address.substring(2) : address),
								to: token,
							},
							'latest'
						],
						id: 0,
					}),
				}).catch((e) => { console.debug(e); return null; });
				if (res?.ok) {
					const data = await res.json();
					console.debug(data);
					if (typeof data?.result === 'string') {
						uintElement.value = evmDataToParams(['bignumber'], evmBufferFromHex(data.result))[0].toFixed();
						window.changeUint();
						document.querySelector('#app').innerHTML = `
							<div id="messagebox" class="messageBox">
								balance: ${uintElement.value}
							</div>
						`;
						setTimeout(() => fadeoutDiv('messagebox'), 500);
						return;
					}
				}
			} break;

			default: {
				document.querySelector('#app').innerHTML = `
					<div id="messagebox" class="errorBox">
						API type is not valid.
					</div>
				`;
				setTimeout(() => fadeoutDiv('messagebox'), 2000);
				return;
			} break;
		}
	}
	document.querySelector('#app').innerHTML = `
		<div id="messagebox" class="errorBox">
			Calling API is failed.
		</div>
	`;
	setTimeout(() => fadeoutDiv('messagebox'), 2000);
}
