import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { mockClient } from 'aws-sdk-client-mock';
import {
  emitMetric,
  emitTestGenerationDuration,
  emitTestExecutionDuration,
  emitTestSuccessRate,
  emitTestFailureRate,
  emitAPILatency,
} from '../../src/shared/utils/cloudwatchMetrics';

const cloudwatchMock = mockClient(CloudWatchClient);

describe('CloudWatch Metrics', () => {
  beforeEach(() => {
    cloudwatchMock.reset();
  });

  describe('emitMetric', () => {
    it('should emit a basic metric', async () => {
      cloudwatchMock.on(PutMetricDataCommand).resolves({});

      await emitMetric({
        metricName: 'TestMetric',
        value: 100,
      });

      expect(cloudwatchMock.calls()).toHaveLength(1);
      const call = cloudwatchMock.call(0);
      expect(call.args[0].input).toMatchObject({
        Namespace: 'AiTestingPlatform',
        MetricData: [
          {
            MetricName: 'TestMetric',
            Value: 100,
            Unit: 'None',
          },
        ],
      });
    });

    it('should emit a metric with custom unit', async () => {
      cloudwatchMock.on(PutMetricDataCommand).resolves({});

      await emitMetric({
        metricName: 'DurationMetric',
        value: 5000,
        unit: 'Milliseconds',
      });

      const call = cloudwatchMock.call(0);
      const input = call.args[0].input as any;
      expect(input.MetricData[0].Unit).toBe('Milliseconds');
    });

    it('should emit a metric with dimensions', async () => {
      cloudwatchMock.on(PutMetricDataCommand).resolves({});

      await emitMetric({
        metricName: 'APIMetric',
        value: 200,
        dimensions: {
          Endpoint: '/tests/generate',
          Environment: 'DEV',
        },
      });

      const call = cloudwatchMock.call(0);
      const input = call.args[0].input as any;
      expect(input.MetricData[0].Dimensions).toEqual([
        { Name: 'Endpoint', Value: '/tests/generate' },
        { Name: 'Environment', Value: 'DEV' },
      ]);
    });

    it('should not throw on CloudWatch error', async () => {
      cloudwatchMock.on(PutMetricDataCommand).rejects(new Error('CloudWatch error'));

      await expect(
        emitMetric({
          metricName: 'TestMetric',
          value: 100,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('emitTestGenerationDuration', () => {
    it('should emit test generation duration metric', async () => {
      cloudwatchMock.on(PutMetricDataCommand).resolves({});

      await emitTestGenerationDuration(3000);

      const call = cloudwatchMock.call(0);
      expect(call.args[0].input).toMatchObject({
        Namespace: 'AiTestingPlatform',
        MetricData: [
          {
            MetricName: 'TestGenerationDuration',
            Value: 3000,
            Unit: 'Milliseconds',
          },
        ],
      });
    });
  });

  describe('emitTestExecutionDuration', () => {
    it('should emit test execution duration metric', async () => {
      cloudwatchMock.on(PutMetricDataCommand).resolves({});

      await emitTestExecutionDuration(45000);

      const call = cloudwatchMock.call(0);
      expect(call.args[0].input).toMatchObject({
        Namespace: 'AiTestingPlatform',
        MetricData: [
          {
            MetricName: 'TestExecutionDuration',
            Value: 45000,
            Unit: 'Milliseconds',
          },
        ],
      });
    });
  });

  describe('emitTestSuccessRate', () => {
    it('should emit test success rate metric', async () => {
      cloudwatchMock.on(PutMetricDataCommand).resolves({});

      await emitTestSuccessRate(0.95);

      const call = cloudwatchMock.call(0);
      expect(call.args[0].input).toMatchObject({
        Namespace: 'AiTestingPlatform',
        MetricData: [
          {
            MetricName: 'TestSuccessRate',
            Value: 0.95,
            Unit: 'None',
          },
        ],
      });
    });
  });

  describe('emitTestFailureRate', () => {
    it('should emit test failure rate metric', async () => {
      cloudwatchMock.on(PutMetricDataCommand).resolves({});

      await emitTestFailureRate(0.05);

      const call = cloudwatchMock.call(0);
      expect(call.args[0].input).toMatchObject({
        Namespace: 'AiTestingPlatform',
        MetricData: [
          {
            MetricName: 'TestFailureRate',
            Value: 0.05,
            Unit: 'None',
          },
        ],
      });
    });
  });

  describe('emitAPILatency', () => {
    it('should emit API latency metric with endpoint dimension', async () => {
      cloudwatchMock.on(PutMetricDataCommand).resolves({});

      await emitAPILatency(250, '/tests/generate');

      const call = cloudwatchMock.call(0);
      expect(call.args[0].input).toMatchObject({
        Namespace: 'AiTestingPlatform',
        MetricData: [
          {
            MetricName: 'APILatency',
            Value: 250,
            Unit: 'Milliseconds',
            Dimensions: [{ Name: 'Endpoint', Value: '/tests/generate' }],
          },
        ],
      });
    });
  });
});
