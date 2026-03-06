import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import * as path from 'path';

export interface PlaywrightLayerProps {
  /**
   * Description for the layer
   * @default 'Playwright with Chromium for Lambda'
   */
  description?: string;

  /**
   * Layer name
   * @default 'playwright-chromium'
   */
  layerName?: string;
}

/**
 * CDK Construct for Playwright Lambda Layer
 * 
 * This construct creates a Lambda Layer containing Playwright and Chromium
 * optimized for AWS Lambda execution environment.
 * 
 * The layer uses playwright-aws-lambda which provides:
 * - Chromium binary optimized for Lambda
 * - Proper /tmp directory handling
 * - Required system dependencies
 * - Memory optimization for Lambda constraints
 * 
 * @example
 * ```typescript
 * const playwrightLayer = new PlaywrightLayer(this, 'PlaywrightLayer', {
 *   layerName: 'playwright-chromium-dev',
 *   description: 'Playwright layer for dev environment',
 * });
 * 
 * const lambda = new lambda.Function(this, 'TestExec', {
 *   // ... other props
 *   layers: [playwrightLayer.layer],
 * });
 * ```
 */
export class PlaywrightLayer extends Construct {
  /**
   * The Lambda Layer
   */
  public readonly layer: lambda.LayerVersion;

  constructor(scope: Construct, id: string, props?: PlaywrightLayerProps) {
    super(scope, id);

    const description = props?.description || 'Playwright with Chromium for Lambda';
    const layerName = props?.layerName || 'playwright-chromium';

    // Create the layer from the built package
    // Note: The layer must be built first using layers/playwright/build-layer.sh
    this.layer = new lambda.LayerVersion(this, 'Layer', {
      layerVersionName: layerName,
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../../../layers/playwright/playwright-layer.zip')
      ),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Retain layer versions for rollback
    });

    // Add tags
    cdk.Tags.of(this.layer).add('Component', 'Lambda-Layer');
    cdk.Tags.of(this.layer).add('Purpose', 'Playwright-Browser-Automation');
  }
}
