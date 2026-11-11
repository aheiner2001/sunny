import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Deploy Lambda Workflow Configuration', () => {
  const workflowPath = path.resolve(process.cwd(), '.github/workflows/deploy-lambda.yml');

  it('exists and includes required CI/CD deployment steps', () => {
    expect(fs.existsSync(workflowPath)).toBe(true);
    const content = fs.readFileSync(workflowPath, 'utf8');

    expect(content).toContain('name: Deploy Lambda to AWS');
    expect(content).toContain('workflow_dispatch:');
    expect(content).toContain('id-token: write');
    expect(content).toContain('aws-actions/configure-aws-credentials');
    expect(content).toContain('aws lambda update-function-code');
    expect(content).toContain('courses/itm300/aws-lambda');
  });
});
