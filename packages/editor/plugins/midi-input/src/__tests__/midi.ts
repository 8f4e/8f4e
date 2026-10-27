export function createMidiInput(id = 'keys', name = 'Keys') {
	const target = Object.assign(new EventTarget(), { id, name, state: 'connected' as MIDIPortDeviceState });
	const input = target as unknown as MIDIInput;
	return {
		input,
		setState: (state: MIDIPortDeviceState) => {
			target.state = state;
		},
		send: (bytes: number[]) => {
			const event = new Event('midimessage');
			Object.defineProperty(event, 'data', { value: new Uint8Array(bytes) });
			input.dispatchEvent(event);
		},
	};
}

export function createMidiOutput(id: string, name: string, state: MIDIPortDeviceState = 'connected'): MIDIOutput {
	return Object.assign(new EventTarget(), { id, name, state }) as unknown as MIDIOutput;
}

export function createMidiAccess() {
	const inputs = new Map<string, MIDIInput>();
	const outputs = new Map<string, MIDIOutput>();
	const target = Object.assign(new EventTarget(), {
		inputs,
		outputs,
		onstatechange: null as MIDIAccess['onstatechange'],
	});
	const access = target as unknown as MIDIAccess;
	// EventTarget supplies listener dispatch; emulate the browser's event-handler property as well.
	access.addEventListener('statechange', event => access.onstatechange?.call(access, event));
	return {
		access,
		inputs,
		outputs,
		change: () => {
			const event = new Event('statechange');
			access.dispatchEvent(event);
			return event;
		},
	};
}
