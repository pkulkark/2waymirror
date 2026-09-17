# Architecture Decision Records

One file per decision, numbered, never edited after acceptance (superseded instead). Each records the context, the options considered, the decision, and its consequences, so the reasoning is on record and not just the result.

| ADR | Decision |
|---|---|
| [0001](0001-serverless-always-deployed-sessions-on-trigger.md) | Serverless, always deployed, sessions provisioned on trigger |
| [0002](0002-dynamodb-single-table.md) | DynamoDB single table over a relational database |
| [0003](0003-lambda-fastapi.md) | Lambda with FastAPI over Cloud Run, Django, or raw handlers |
| [0004](0004-terraform.md) | Terraform over AWS CDK or SAM |
| [0005](0005-react-spa-api-gated-content.md) | React + TypeScript SPA on S3 + CloudFront, content served only through the API |
| [0006](0006-authenticity-practices.md) | Authenticity practices for an AI-assisted build |
| [0007](0007-private-content-sample-candidate.md) | Real content in a private repo and private S3 bucket; public repo ships a sample candidate |
| [0008](0008-custom-domain-acm-route53.md) | Custom domain via ACM in us-east-1 and Route 53 alias records |
| [0009](0009-submission-notifications-ses.md) | Submission notifications from the API handler through SES |

Template: [0000-template.md](0000-template.md)
