# infra

Terraform for the whole runtime topology: DynamoDB, S3 (web + content), Lambda, API Gateway, CloudFront, CloudWatch, SES (submission notifications, off by default), and the GitHub OIDC deploy role. Pay-per-use only, per ADR-0001: no VPC, no RDS, no load balancer, no NAT.

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

A human applies it; CI cannot. It creates the state bucket, so the very first apply has to run with local state, after which the state is moved into that bucket under its own key so nothing important lives only on one laptop.

First time in a fresh account. The S3 backend cannot be used before the bucket exists, and `terraform init -backend=false` does not switch to local state, so a local backend is swapped in through an override file for the first apply only:

```sh
cd infra/bootstrap
cp backend_local_override.tf.example backend_local_override.tf   # local state, just for this apply
terraform init
terraform apply
rm backend_local_override.tf
cp backend.hcl.example backend.hcl        # fill in the bucket name from the output
terraform init -migrate-state -backend-config=backend.hcl
rm terraform.tfstate terraform.tfstate.backup
```

`backend_local_override.tf` is gitignored; if it is ever left in place, Terraform will silently use local state, so delete it as soon as the migration is done.

Every time after that:

```sh
cd infra/bootstrap
terraform init -backend-config=backend.hcl
terraform apply
```

From the outputs, set these GitHub repository variables: `TF_BACKEND_BUCKET` (`bucket_name`), `AWS_PLAN_ROLE_ARN` (`plan_role_arn`), `AWS_DEPLOY_ROLE_ARN` (`deploy_role_arn`). The CI roles can read and write only the root module's state objects; the bootstrap state is out of their reach.

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

`var.domain_name` is empty by default, which keeps the site on the CloudFront hostname. See "Custom domain" below for turning it on.

## Custom domain

The custom domain is one variable. Empty (the default) means no ACM certificate, no Route53 records, no CloudFront aliases, and `terraform plan` shows no diff against a stack deployed without it.

Prerequisites:

- Register the domain, and have its **public hosted zone in Route53 in this account**. Registering through Route53 creates the zone for you. If the domain is registered elsewhere, create the hosted zone by hand and point the registrar's NS records at the four nameservers the zone lists; DNS validation and the alias records both need the zone to be authoritative before they can work.
- Terraform looks the zone up, it does not create it, so destroying this stack cannot take the zone or its delegation with it.
- The CI roles need ACM and Route53 permissions, which `infra/bootstrap` grants. If bootstrap was applied before those statements existed, re-apply it (by hand, as always) before CI plans or applies with a domain set, or the run fails with AccessDenied.

Turn it on:

```sh
terraform apply -var env=dev -var domain_name=example.com
```

or set the `DOMAIN_NAME` repository variable, which CI passes through as `TF_VAR_domain_name` to both plan and apply. Locally, `export TF_VAR_domain_name=example.com` does the same thing without repeating `-var` on every command.

For a subdomain served from a parent zone, also set `hosted_zone_name` (repository variable `HOSTED_ZONE_NAME`) to the zone that holds the records, for example `domain_name=app.example.com` with `hosted_zone_name=example.com`. It defaults to `domain_name`, which is what an apex deployment wants.

What the apply does: issues a DNS-validated ACM certificate in **us-east-1** (CloudFront accepts certificates from that region only, whatever region the rest of the stack is in), writes the validation CNAMEs into the zone, waits for ACM to issue, then adds the name as a CloudFront alias and points A and AAAA alias records at the distribution. Validation usually takes a few minutes and the apply blocks until it finishes; the distribution update that follows takes several more. The `site_url` output is the custom domain once it is set, and the CloudFront hostname otherwise.

To roll back, unset the variable (delete the `DOMAIN_NAME` repository variable, or `unset TF_VAR_domain_name`) and apply. The distribution goes back to its default hostname and certificate, and the certificate and records are destroyed. The hosted zone and the registration are untouched.

## Submission notifications

When a company submits or edits its answers, the API emails them to the candidate through SES (ADR-0009). Like the custom domain, it is one variable: `var.notify_email`, empty by default, which creates no SES resources at all and leaves `TWM_NOTIFY_EMAIL` and `TWM_NOTIFY_FROM` empty on the Lambda so the handler never calls SES.

Prerequisites:

- A custom domain, since the sender is `no-reply@<domain_name>` and SES verifies it through DNS records in the same hosted zone. `notify_email` on its own, with no `domain_name`, fails the plan on a precondition rather than quietly deploying a stack that sends nothing.
- The CI roles need the SES permissions that `infra/bootstrap` grants. Bootstrap is applied **by hand, never by CI**, so if it was applied before those statements existed, re-apply it before CI plans or applies with `NOTIFY_EMAIL` set, or the run fails with AccessDenied.

Turn it on by setting the `NOTIFY_EMAIL` repository variable, which CI passes through as `TF_VAR_notify_email` to both plan and apply, or locally:

```sh
terraform apply -var env=dev -var domain_name=example.com -var notify_email=you@example.com
```

The address is never committed: it lives in the repository variable and in the state, not in the repo.

What the apply does: creates an SES domain identity for `domain_name`, enables DKIM and writes the three DKIM CNAMEs into the hosted zone, creates an email identity for `notify_email`, and grants the Lambda `ses:SendEmail` on the domain identity and the recipient identity (SES checks both, the latter while the account is in the sandbox), under a condition that pins every recipient to `notify_email`. The two halves are enforced separately because that is how SES reads them: the resource is the identity mail is sent *as*, and only a condition can say who it may go *to*. The Lambda also gains `TWM_PUBLIC_BASE_URL` (the `site_url`), so the session links in the mail match the links that were sent out.

**One manual step.** Creating the email identity makes SES send a verification request to `notify_email`; the link in it has to be clicked once. Until then, notifications are attempted and rejected, which is logged and never affects a submission. SES stays in **sandbox mode**, and that is sufficient here: sandbox only forbids sending to unverified destinations, and the single destination is the candidate's own verified address. No production access request is needed.

To roll back, unset `NOTIFY_EMAIL` and apply. The identities and DKIM records are destroyed, and the Lambda goes back to sending nothing. The domain and the hosted zone are untouched.

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
