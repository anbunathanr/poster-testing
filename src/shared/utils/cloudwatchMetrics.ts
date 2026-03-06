import { CloudWatchClient, PutMetricDataCommand, StandardUnit } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({});

export interface MetricData {
  metricName: string;
  value: number;
  unit?: StandardUnit;
  dimensions?: Record<string, string>;
}

/**
 * Emit a custom CloudWatch metric
 */
export async function emitMetric(data: MetricData): Promise<void> {
  const { metricName, value, unit = StandardUnit.None, dimensions = {} } = data;

  const dimensionArray = Object.entries(dimensions).map(([name, value]) => ({
    Name: name,
    Value: value,
  }));

  const command = new PutMetricDataCommand({
    Namespace: 'AiTestingPlatform',
    MetricData: [
      {
        MetricName: metricName,
        Value: value,
        Unit: unit,
        Timestamp: new Date(),
        Dimensions: dimensionArray.length > 0 ? dimensionArray : undefined,
      },
    ],
  });

  try {
    await cloudwatch.send(command);
  } catch (error) {
    console.error('Failed to emit CloudWatch metric:', error);
    // Don't throw - metrics should not break the main flow
  }
}

/**
 * Emit test generation duration metric
 */
export async function emitTestGenerationDuration(durationMs: number): Promise<void> {
  await emitMetric({
    metricName: 'TestGenerationDuration',
    value: durationMs,
    unit: StandardUnit.Milliseconds,
  });
}

/**
 * Emit test execution duration metric
 */
export async function emitTestExecutionDuration(durationMs: number): Promise<void> {
  await emitMetric({
    metricName: 'TestExecutionDuration',
    value: durationMs,
    unit: StandardUnit.Milliseconds,
  });
}

/**
 * Emit test success rate metric
 */
export async function emitTestSuccessRate(successRate: number): Promise<void> {
  await emitMetric({
    metricName: 'TestSuccessRate',
    value: successRate,
    unit: StandardUnit.None,
  });
}

/**
 * Emit test failure rate metric
 */
export async function emitTestFailureRate(failureRate: number): Promise<void> {
  await emitMetric({
    metricName: 'TestFailureRate',
    value: failureRate,
    unit: StandardUnit.None,
  });
}

/**
 * Emit API latency metric
 */
export async function emitAPILatency(latencyMs: number, endpoint: string): Promise<void> {
  await emitMetric({
    metricName: 'APILatency',
    value: latencyMs,
    unit: StandardUnit.Milliseconds,
    dimensions: {
      Endpoint: endpoint,
    },
  });
}
