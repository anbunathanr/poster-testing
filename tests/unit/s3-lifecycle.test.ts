import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { S3Stack } from '../../infrastructure/lib/stacks/s3-stack';

describe('S3 Lifecycle Policies (Task 8.5)', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let s3Stack: S3Stack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack', {
      env: {
        account: '123456789012',
        region: 'us-east-1',
      },
    });
    s3Stack = new S3Stack(stack, 'S3Stack', {
      environment: 'test',
    });
    template = Template.fromStack(stack);
  });

  describe('Evidence Bucket Lifecycle Policies', () => {
    test('Evidence bucket has lifecycle policies configured', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        LifecycleConfiguration: {
          Rules: [
            {
              Id: 'archive-old-evidence',
              Status: 'Enabled',
              Transitions: [
                {
                  StorageClass: 'GLACIER',
                  TransitionInDays: 90,
                },
              ],
            },
            {
              Id: 'delete-very-old-evidence',
              Status: 'Enabled',
              ExpirationInDays: 365,
            },
          ],
        },
      });
    });

    test('Lifecycle policy archives evidence to Glacier after 90 days', () => {
      const buckets = template.findResources('AWS::S3::Bucket');
      const evidenceBucket = Object.values(buckets).find((bucket: any) => 
        bucket.Properties.LifecycleConfiguration?.Rules?.some((rule: any) => 
          rule.Id === 'archive-old-evidence'
        )
      );
      
      expect(evidenceBucket).toBeDefined();
      const archiveRule = evidenceBucket?.Properties.LifecycleConfiguration.Rules.find(
        (rule: any) => rule.Id === 'archive-old-evidence'
      );
      
      expect(archiveRule).toBeDefined();
      expect(archiveRule.Status).toBe('Enabled');
      expect(archiveRule.Transitions).toHaveLength(1);
      expect(archiveRule.Transitions[0].TransitionInDays).toBe(90);
      expect(archiveRule.Transitions[0].StorageClass).toBe('GLACIER');
    });

    test('Lifecycle policy deletes evidence after 365 days', () => {
      const buckets = template.findResources('AWS::S3::Bucket');
      const evidenceBucket = Object.values(buckets).find((bucket: any) => 
        bucket.Properties.LifecycleConfiguration?.Rules?.some((rule: any) => 
          rule.Id === 'delete-very-old-evidence'
        )
      );
      
      expect(evidenceBucket).toBeDefined();
      const deleteRule = evidenceBucket?.Properties.LifecycleConfiguration.Rules.find(
        (rule: any) => rule.Id === 'delete-very-old-evidence'
      );
      
      expect(deleteRule).toBeDefined();
      expect(deleteRule.Status).toBe('Enabled');
      expect(deleteRule.ExpirationInDays).toBe(365);
    });

    test('Both lifecycle rules are enabled', () => {
      const buckets = template.findResources('AWS::S3::Bucket');
      const evidenceBucket = Object.values(buckets).find((bucket: any) => 
        bucket.Properties.LifecycleConfiguration?.Rules
      );
      
      expect(evidenceBucket).toBeDefined();
      const rules = evidenceBucket?.Properties.LifecycleConfiguration.Rules;
      
      expect(rules).toHaveLength(2);
      rules.forEach((rule: any) => {
        expect(rule.Status).toBe('Enabled');
      });
    });

    test('Lifecycle policies apply to all objects in the bucket', () => {
      const buckets = template.findResources('AWS::S3::Bucket');
      const evidenceBucket = Object.values(buckets).find((bucket: any) => 
        bucket.Properties.LifecycleConfiguration?.Rules
      );
      
      expect(evidenceBucket).toBeDefined();
      const rules = evidenceBucket?.Properties.LifecycleConfiguration.Rules;
      
      // Rules without a Prefix or Filter apply to all objects
      rules.forEach((rule: any) => {
        expect(rule.Prefix).toBeUndefined();
        expect(rule.Filter).toBeUndefined();
      });
    });
  });
});
