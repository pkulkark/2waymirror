# infra

Terraform for the whole runtime topology: DynamoDB, S3 (web + content), Lambda, API Gateway, CloudFront, CloudWatch, and the GitHub OIDC deploy role. Pay-per-use only, per ADR-0001: no VPC, no RDS, no load balancer, no NAT.

```
infra/
  bootstrap/   Terraform state bucket. Applied once by hand, local state.
  *.tf         Everything else, applied per env with var.env.
```

See `docs/architecture.md` for the resources this creates and `docs/adr/0004-terraform.md` for why Terraform.

## Bootstrap (once per AWS account)

`infra/bootstrap` creates the things that must exist before CI can run and that CI must never be able to change:

- the S3 bucket that holds Terraform state for the root module;
- the GitHub OIDC provider;
- two CI roles: a read-only **plan** role trusted only by pull request workflows, and a **deploy** role trusted only by workflows on `main`. The deploy role can manage the root module's resources and the Lambda execution role, and is explicitly denied any action on the CI roles or the OIDC provider.

It has no remote backend of its own (state stays local) since it creates the bucket the root module depends on. A human applies it once and re-applies it only when the CI identities change.

```sh
cd infra/bootstrap
terraform init
terraform apply
terraform output
```

Keep `infra/bootstrap/terraform.tfstate` somewhere safe; it is not itself in S3. From the outputs, set these GitHub repository variables: `TF_BACKEND_BUCKET` (`bucket_name`), `AWS_PLAN_ROLE_ARN` (`plan_role_arn`), `AWS_DEPLOY_ROLE_ARN` (`deploy_role_arn`).

## Init the root module

Copy the backend config example and fill in the bucket name from bootstrap:

```sh
cd infra
cp backend.hcl.example backend.hcl
# edit backend.hcl: bucket = "<bucket_name from bootstrap>", key = "2wm/<env>/terraform.tfstate"
terraform init -backend-config=backend.hcl
```

State locking uses S3's native `use_lockfile` conditional-write locking (Terraform >= 1.10), not a DynamoDB lock table. `backend.hcl` is gitignored since it is machine/account specific; `backend.hcl.example` is the template.

## Plan and apply

```sh
terraform plan -var env=dev
terraform apply -var env=dev
```

`var.env` defaults to `dev`. To use a different state file per env, change `key` in `backend.hcl` and re-run `terraform init -backend-config=backend.hcl -reconfigure`.

The Lambda deployment package comes from `var.lambda_zip_path` (default `../backend/build/lambda.zip`). Build it first:

```sh
../backend/scripts/build_lambda.sh
```

If the file is missing, `apply` fails with a message saying so. The only exception is `-var allow_stub_lambda=true`, a bootstrap-only opt-in that deploys a stub handler answering 503 so the rest of the stack can be created before the first real build. It defaults to off so a missing artifact can never become a silently dead deployment.

`var.domain_name` is accepted but must stay `""` for v0 (a variable validation enforces this); a custom domain needs ACM and Route53 wiring that is not built yet.

## Client-side routing

CloudFront serves the React build from S3. A small CloudFront Function on the web behavior rewrites any request whose last path segment has no file extension (for example `/s/<token>`) to `/index.html`. It is attached to the web behavior only, so `/api/*` responses, including 404 and 410, reach the client exactly as the API sent them. Requests for missing assets still fail as they should.

## Checks

```sh
terraform fmt -recursive
terraform init -backend=false   # per directory: infra/ and infra/bootstrap/
terraform validate              # per directory
tflint                          # if installed
```

`.terraform.lock.hcl` is committed for both `infra/` and `infra/bootstrap/`, one per directory, so provider versions are reproducible across machines and CI.

## LocalStack limits (issue #86)

A LocalStack-backed local run of this stack is a sanity check on resource wiring, not a substitute for a real AWS `dev` environment. Known gaps to keep in mind:

- **IAM is not enforced** on the LocalStack free tier: the least-privilege policies here plan and apply against LocalStack without actually being checked, so a role that is too broad (or too narrow) will not show up there.
- **CloudFront, ACM, and Route53** are Pro-only or only partially emulated, so the CDN behaviors, custom error responses, and OAC wiring cannot be exercised end to end locally.
- **GitHub OIDC federation is untestable** locally; there is no way to exchange a real GitHub Actions token for LocalStack credentials.
- Lambda cold-start behavior differs from real Lambda and should not be used to reason about latency.

A real `dev` stage in AWS remains the source of truth for IAM correctness and everything at the edge (CloudFront/ACM/Route53/OIDC). Use LocalStack to catch wiring mistakes (wrong resource references, missing env vars, route misconfiguration) cheaply before an AWS apply, not to validate security or edge behavior.
