import type { AttributeValue, Span, TimeInput } from '@opentelemetry/api';
import type { Disposable } from 'vscode';
import { version as codeVersion, env } from 'vscode';
import { getProxyAgent } from '@env/fetch.js';
import { getPlatform } from '@env/platform.js';
import type { Source, TelemetryEventData, TelemetryEvents, TelemetryGlobalContext } from '../constants.telemetry.js';
import type { Container } from '../container.js';
import { configuration } from '../system/-webview/configuration.js';
import { getExtensionModeLabel } from '../system/-webview/vscode.js';

export interface TelemetryContext {
	env: string;
	extensionId: string;
	extensionMode: string;
	extensionVersion: string;
	machineId: string;
	sessionId: string;
	language: string;
	platform: string;
	vscodeEdition: string;
	vscodeHost: string;
	vscodeRemoteName: string;
	vscodeShell: string;
	vscodeUIKind: string;
	vscodeVersion: string;
}

export interface TelemetryProvider extends Disposable {
	sendEvent(name: string, data?: Record<string, AttributeValue>, startTime?: TimeInput, endTime?: TimeInput): void;
	startEvent(name: string, data?: Record<string, AttributeValue>, startTime?: TimeInput): Span;
	setGlobalAttributes(attributes: Map<string, AttributeValue>): void;
}

interface QueuedEvent<T extends keyof TelemetryEvents = keyof TelemetryEvents> {
	type: 'sendEvent';
	name: T;
	data?: TelemetryEvents[T];
	global: Map<string, AttributeValue>;
	startTime: TimeInput;
	endTime: TimeInput;
}

export class TelemetryService implements Disposable {
	private _enabled: boolean = false;
	get enabled(): boolean {
		return false;
	}

	private provider: TelemetryProvider | undefined;
	private globalAttributes = new Map<string, AttributeValue>();
	private eventQueue: QueuedEvent[] = [];

	constructor(private readonly container: Container) {
		container.context.subscriptions.push(
			configuration.onDidChange(e => {
				if (!configuration.changed(e, 'telemetry.enabled')) return;

				this.ensureTelemetry(container);
			}),
			env.onDidChangeTelemetryEnabled(() => this.ensureTelemetry(container)),
		);
		this.ensureTelemetry(container);
	}

	dispose(): void {
		this.provider?.dispose();
		this.provider = undefined;
	}

	private _initializationTimer: ReturnType<typeof setTimeout> | undefined;
	private ensureTelemetry(container: Container): void {
		this._enabled = false;
		if (this._initializationTimer != null) {
			clearTimeout(this._initializationTimer);
			this._initializationTimer = undefined;
		}

		this.eventQueue.length = 0;

		this.provider?.dispose();
		this.provider = undefined;
	}

	private async initializeTelemetry(container: Container) {
		// Telemetry disabled
	}

	sendEvent<T extends keyof TelemetryEvents>(
		name: T,
		...args: TelemetryEvents[T] extends void
			? [data?: never, source?: Source, startTime?: TimeInput, endTime?: TimeInput]
			: [data: TelemetryEvents[T], source?: Source, startTime?: TimeInput, endTime?: TimeInput]
	): void {
		// Telemetry disabled
	}

	startEvent<T extends keyof TelemetryEvents>(
		name: T,
		...args: TelemetryEvents[T] extends void
			? [data?: never, source?: Source, startTime?: TimeInput]
			: [data: TelemetryEvents[T], source?: Source, startTime?: TimeInput]
	): Disposable | undefined {
		return undefined;
	}

	// sendErrorEvent(
	// 	name: string,
	// 	data?: Record<string, string>,
	// ): void {
	// }

	// sendException(
	// 	error: Error | unknown,
	// 	data?: Record<string, string>,
	// ): void {
	// }

	setGlobalAttribute<T extends keyof TelemetryGlobalContext>(
		key: T,
		value: TelemetryGlobalContext[T] | null | undefined,
	): void {
		if (value == null) {
			this.globalAttributes.delete(`global.${key}`);
		} else {
			this.globalAttributes.set(`global.${key}`, value);
		}
		this.provider?.setGlobalAttributes(this.globalAttributes);
	}

	setGlobalAttributes(attributes: Partial<TelemetryGlobalContext>): void {
		for (const [key, value] of Object.entries(attributes)) {
			if (value == null) {
				this.globalAttributes.delete(`global.${key}`);
			} else {
				this.globalAttributes.set(`global.${key}`, value);
			}
		}
		this.provider?.setGlobalAttributes(this.globalAttributes);
	}

	deleteGlobalAttribute(key: keyof TelemetryGlobalContext): void {
		this.globalAttributes.delete(`global.${key}`);
		this.provider?.setGlobalAttributes(this.globalAttributes);
	}
}

function addSourceAttributes(
	source: Source | undefined,
	data: Record<string, AttributeValue | null | undefined> | undefined,
) {
	if (source == null) return data;

	data ??= {};
	data['source.name'] = source.source;
	if (source.correlationId != null) {
		data['source.correlationId'] = source.correlationId;
	}
	if (source.detail != null) {
		if (typeof source.detail === 'string') {
			data['source.detail'] = source.detail;
		} else if (typeof source.detail === 'object') {
			for (const [key, value] of Object.entries(source.detail)) {
				data[`source.detail.${key}`] = value;
			}
		}
	}
	return data;
}

function stripNullOrUndefinedAttributes(data: Record<string, AttributeValue | null | undefined> | undefined) {
	if (data == null) return undefined;

	const attributes: Record<string, AttributeValue> | undefined = Object.create(null);
	for (const [key, value] of Object.entries(data)) {
		if (value == null) continue;

		attributes![key] = value;
	}
	return attributes;
}

function assertsTelemetryEventData(data: any): asserts data is TelemetryEventData {
	if (data == null || typeof data === 'object') return;

	debugger;
}
