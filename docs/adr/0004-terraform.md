# ADR-0004: Terraform over AWS CDK or SAM

Date: 2026-09-03
Status: Accepted

## Context

The app needs its infrastructure defined as code: Lambda, API Gateway, DynamoDB, and the supporting pieces from earlier decisions. A tool has to be chosen to define, plan, and apply that infrastructure.

## Options considered

1. **AWS CDK.** Python native, so the whole stack stays in one language, and it bundles Lambda packages automatically. Rejected as the choice here not because it is a bad option, but because the deciding factor was plan and apply clarity rather than staying entirely in Python. It was judged a legitimate alternative and would not be argued against.
2. **AWS SAM.** The simplest option for a pure Lambda app. Not chosen; Terraform's readable plan output and independence from CloudFormation weighed more heavily.
3. **Terraform.** Chosen for readable plan output before apply, no dependency on CloudFormation's slow deploys and occasionally stuck rollbacks, state that is not tied to one cloud's control plane, and the widest ecosystem of examples and modules.

## Decision

Terraform is used to define and apply all infrastructure. Python 3.13 on arm64 for the Lambda runtime, as decided in ADR-0003.

## Consequences

Plans can be reviewed before every apply, and infrastructure state is not locked to AWS's own tooling. The cost is an explicit build step to produce the Lambda zip before Terraform can reference it, and state storage to set up (an S3 backend with locking) that CDK or SAM would have handled implicitly. The author is also learning Terraform on this project, so early iterations will be slower than with a more familiar tool.
