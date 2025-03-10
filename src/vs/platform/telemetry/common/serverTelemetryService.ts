/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { refineServiceDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IProductService } from 'vs/platform/product/common/productService';
import { ClassifiedEvent, IGDPRProperty, StrictPropertyCheck } from 'vs/platform/telemetry/common/gdprTypings';
import { ITelemetryData, ITelemetryService, TelemetryLevel } from 'vs/platform/telemetry/common/telemetry';
import { ITelemetryServiceConfig, TelemetryService } from 'vs/platform/telemetry/common/telemetryService';
import { NullTelemetryServiceShape } from 'vs/platform/telemetry/common/telemetryUtils';

export interface IServerTelemetryService extends ITelemetryService {
	updateInjectedTelemetryLevel(telemetryLevel: TelemetryLevel): Promise<void>;
}

export class ServerTelemetryService extends TelemetryService implements IServerTelemetryService {
	// Because we cannot read the workspace config on the remote site
	// the ServerTelemetryService is responsible for knowing its telemetry level
	// this is done through IPC calls and initial value injections
	private _injectedTelemetryLevel: TelemetryLevel;
	constructor(
		config: ITelemetryServiceConfig,
		injectedTelemetryLevel: TelemetryLevel,
		@IConfigurationService _configurationService: IConfigurationService,
		@IProductService _productService: IProductService
	) {
		super(config, _configurationService, _productService);
		this._injectedTelemetryLevel = injectedTelemetryLevel;
	}

	override publicLog(eventName: string, data?: ITelemetryData, anonymizeFilePaths?: boolean): Promise<void> {
		if (this._injectedTelemetryLevel < TelemetryLevel.USAGE) {
			return Promise.resolve(undefined);
		}
		return super.publicLog(eventName, data, anonymizeFilePaths);
	}

	override publicLog2<E extends ClassifiedEvent<T> = never, T extends IGDPRProperty = never>(eventName: string, data?: StrictPropertyCheck<T, E>, anonymizeFilePaths?: boolean): Promise<void> {
		return this.publicLog(eventName, data as ITelemetryData | undefined, anonymizeFilePaths);
	}

	override publicLogError(errorEventName: string, data?: ITelemetryData): Promise<void> {
		if (this._injectedTelemetryLevel < TelemetryLevel.ERROR) {
			return Promise.resolve(undefined);
		}
		return super.publicLogError(errorEventName, data);
	}

	override publicLogError2<E extends ClassifiedEvent<T> = never, T extends IGDPRProperty = never>(eventName: string, data?: StrictPropertyCheck<T, E>): Promise<void> {
		return this.publicLogError(eventName, data as ITelemetryData | undefined);
	}

	async updateInjectedTelemetryLevel(telemetryLevel: TelemetryLevel): Promise<void> {
		if (telemetryLevel === undefined) {
			this._injectedTelemetryLevel = TelemetryLevel.NONE;
			throw new Error('Telemetry level cannot be undefined. This will cause infinite looping!');
		}
		// We always take the most restrictive level because we don't want multiple clients to connect and send data when one client does not consent
		this._injectedTelemetryLevel = this._injectedTelemetryLevel ? Math.min(this._injectedTelemetryLevel, telemetryLevel) : telemetryLevel;
		if (this._injectedTelemetryLevel === TelemetryLevel.NONE) {
			this.dispose();
		}
	}
}

export const ServerNullTelemetryService = new class extends NullTelemetryServiceShape implements IServerTelemetryService {
	async updateInjectedTelemetryLevel(): Promise<void> { return; } // No-op, telemetry is already disabled
};

export const IServerTelemetryService = refineServiceDecorator<ITelemetryService, IServerTelemetryService>(ITelemetryService);
