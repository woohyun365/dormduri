import { Injectable, Logger } from '@nestjs/common';
import type {
  OperatorAlertSinkPayload,
  OperatorAlertSinkPort,
  OperatorAlertSinkResult,
} from './operator-alert-sink.port.js';

@Injectable()
export class LoggerOperatorAlertSink implements OperatorAlertSinkPort {
  private readonly logger = new Logger(LoggerOperatorAlertSink.name);

  dispatch(payload: OperatorAlertSinkPayload): Promise<OperatorAlertSinkResult> {
    this.logger.warn(
      `operator alert sink disabled alertId=${payload.alertId} sourceType=${payload.sourceType} sourceId=${payload.sourceId} category=${payload.category} riskTier=${payload.riskTier ?? 'NONE'} severity=${payload.severity}`,
    );
    return Promise.resolve({ delivered: false, skippedReason: 'EXTERNAL_SINK_DISABLED' });
  }
}
