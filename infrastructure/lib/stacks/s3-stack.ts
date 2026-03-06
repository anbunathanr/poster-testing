import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface S3StackProps {
  environment: string;
}

export class S3Stack extends Construct {
  public readonly evidenceBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: S3StackProps) {
    super(scope, id);

    const { environment } = props;

    // Evidence Bucket for screenshots, logs, and reports
    this.evidenceBucket = new s3.Bucket(this, 'EvidenceBucket', {
      bucketName: `ai-testing-evidence-${environment}-${cdk.Aws.ACCOUNT_ID}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: environment !== 'prod',
      lifecycleRules: [
        {
          id: 'archive-old-evidence',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
        {
          id: 'delete-very-old-evidence',
          enabled: true,
          expiration: cdk.Duration.days(365),
        },
      ],
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
          ],
          allowedOrigins: ['*'], // Should be restricted to actual frontend domains in production
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    });

    // Tags
    cdk.Tags.of(this.evidenceBucket).add('Component', 'Storage');
  }
}
