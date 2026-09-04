# infra

Terraform for the whole runtime topology: DynamoDB, S3 (web + content), Lambda, API Gateway, CloudFront, CloudWatch, and the GitHub OIDC deploy role. Pay-per-use only, per ADR-0001: no VPC, no RDS, no load balancer, no NAT.

```
infra/
  bootstrap/   Terraform state bucket. Applied once by hand, local state.
  *.tf         Everything else, applied per env with var.env.
```

See `docs/architecture.md` for the resources this creates and `docs/adr/0004-terraform.md` for why Terraform.

## Bootstrap (once per AWS account)

`infra/bootstrap` creates the S3 bucket that holds Terraform state for the root module. It has no remote backend of its own (state stays local) since it exists to create the bucket the root module depends on.

```sh
cd infra/bootstrap
terraform init
terraform apply
terraform output bucket_name
```

Keep `infra/bootstrap/terraform.tfstate` somewhere safe; it is not itself in S3. Note the bucket name from the output, it is used below.

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

The Lambda deployment package comes from `var.lambda_zip_path` (default `../backend/build/lambda.zip`, see `docs/architecture.md`'s "Lambda packaging" section for how CI builds it). If that file does not exist, Terraform packages a placeholder stub handler instead so `plan`/`apply` still work, for example on a first bootstrap before the backend has been built anywhere. Real environments always get the real package from CI before serving traffic.

`var.domain_name` is accepted but must stay `""` for v0 (a variable validation enforces this); a custom domain needs ACM and Route53 wiring that is not built yet.

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
