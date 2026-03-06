# Playwright Lambda Layer Setup Guide

This guide explains how to build, deploy, and use the Playwright Lambda Layer for browser automation in AWS Lambda.

## Overview

The Playwright Lambda Layer provides Chromium browser capabilities for the Test Execution Lambda function. It uses the `playwright-aws-lambda` package which is optimized for AWS Lambda's constraints.

## Prerequisites

- Node.js 18.x or later
- npm
- AWS CLI configured with appropriate credentials
- Bash shell (for build script)

## Building the Layer

### Step 1: Navigate to Layer Directory

```bash
cd layers/playwright
```

### Step 2: Make Build Script Executable

```bash
chmod +x build-layer.sh
```

### Step 3: Build the Layer

```bash
./build-layer.sh
```

This will:
- Install playwright-aws-lambda and playwright-core
- Create the correct directory structure (nodejs/node_modules)
- Package everything into playwright-layer.zip
- Verify size is within Lambda limits (50MB zipped)

## Deployment Options

### Option 1: Automatic Deployment with CDK (Recommended)

The layer is automatically deployed when you deploy the infrastructure stack:

```bash
cd infrastructure
npm run cdk:deploy:dev
```

The CDK stack will:
- Create the layer from the built zip file
- Attach it to the Test Execution Lambda
- Tag it appropriately for the environment

### Option 2: Manual Deployment with AWS CLI

```bash
aws lambda publish-layer-version \
  --layer-name playwright-chromium-dev \
  --description "Playwright with Chromium for Lambda" \
  --zip-file fileb://playwright-layer.zip \
  --compatible-runtimes nodejs18.x \
  --region us-east-1
```


Save the LayerVersionArn from the output.

### Option 3: AWS Console

1. Go to AWS Lambda Console
2. Click "Layers" in the left sidebar
3. Click "Create layer"
4. Name: `playwright-chromium-dev`
5. Upload `playwright-layer.zip`
6. Compatible runtimes: Node.js 18.x
7. Click "Create"

## Using the Layer in Lambda Functions

### In Test Execution Lambda Code

```typescript
import playwright from 'playwright-aws-lambda';

export const handler = async (event: any) => {
  // Launch Chromium browser optimized for Lambda
  const browser = await playwright.launchChromium({
    headless: true,
  });
  
  try {
    const page = await browser.newPage();
    
    // Navigate and interact with pages
    await page.goto('https://example.com');
    await page.screenshot({ path: '/tmp/screenshot.png' });
    
    // Your test automation logic here
    
  } finally {
    await browser.close();
  }
};
```

### Key Differences from Standard Playwright

1. **Import**: Use `playwright-aws-lambda` instead of `playwright`
2. **Launch**: Use `playwright.launchChromium()` instead of `playwright.chromium.launch()`
3. **File Storage**: Use `/tmp` directory for screenshots and downloads

## Layer Size and Limits

- **Zipped Size**: ~40-45 MB (within 50 MB limit)
- **Unzipped Size**: ~120-150 MB (within 250 MB limit)
- **Total Lambda Package**: Layer + Function code must be < 250 MB unzipped

## Updating the Layer

When Playwright releases new versions:

1. Update `layers/playwright/package.json`
2. Rebuild: `./build-layer.sh`
3. Redeploy the layer
4. Update Lambda functions to use new version

## Troubleshooting

### Build Issues

**Error: "npm install failed"**
- Ensure Node.js 18.x is installed
- Check internet connectivity
- Try clearing npm cache: `npm cache clean --force`

**Error: "Layer size exceeds limit"**
- Verify using playwright-core not full playwright
- Check package.json has only required dependencies


### Runtime Issues

**Error: "Cannot find module 'playwright-aws-lambda'"**
- Verify layer is attached to Lambda function
- Check layer ARN is correct
- Ensure layer structure has nodejs/node_modules/

**Error: "Browser executable not found"**
- Use `playwright.launchChromium()` not `playwright.chromium.launch()`
- Verify layer is properly attached
- Check Lambda has sufficient memory (2048 MB minimum)

**Error: "Out of memory"**
- Increase Lambda memory to 2048 MB or higher
- Close browser pages when done: `await page.close()`
- Close browser after use: `await browser.close()`

**Error: "Timeout waiting for browser"**
- Increase Lambda timeout to 300 seconds
- Check network connectivity from Lambda
- Verify security groups allow outbound HTTPS

## Testing Locally

### With SAM Local

```bash
# Build the function
npm run build

# Invoke with layer
sam local invoke TestExecutionFunction \
  --event events/test-execute.json \
  --env-vars env.json
```

Note: SAM Local may not fully support layers. For complete testing, deploy to AWS.

### With Docker

You can test the layer in a Lambda-like environment:

```bash
docker run --rm -v "$PWD":/var/task \
  public.ecr.aws/lambda/nodejs:18 \
  node -e "const p = require('playwright-aws-lambda'); console.log(p);"
```

## Best Practices

1. **Memory Configuration**: Use at least 2048 MB for browser automation
2. **Timeout**: Set Lambda timeout to 300 seconds (5 minutes)
3. **Cleanup**: Always close browsers and pages to free memory
4. **Error Handling**: Wrap browser operations in try-finally blocks
5. **Screenshots**: Store in /tmp and upload to S3 immediately
6. **Concurrency**: Limit concurrent executions to avoid resource exhaustion

## References

- [playwright-aws-lambda GitHub](https://github.com/JupiterOne/playwright-aws-lambda)
- [AWS Lambda Layers](https://docs.aws.amazon.com/lambda/latest/dg/configuration-layers.html)
- [Playwright Documentation](https://playwright.dev/)
