variable "env" {
  description = "Environment name. Used throughout as the 2wm-<env> naming prefix."
  type        = string
  default     = "dev"
}

variable "region" {
  description = "AWS region for all resources."
  type        = string
  default     = "ca-central-1"
}

variable "github_repo" {
  description = "GitHub repo (owner/name) trusted by the OIDC deploy role."
  type        = string
  default     = "pkulkark/2waymirror"
}

variable "domain_name" {
  description = <<-EOT
    Custom domain the site is served on, for example "example.com". Empty
    string (the default) skips ACM and Route53 entirely: the distribution
    keeps its default *.cloudfront.net hostname and the CloudFront default
    certificate. Setting it creates a DNS-validated ACM certificate in
    us-east-1, adds the name as a CloudFront alias, and points A/AAAA alias
    records at the distribution. The hosted zone must already exist in this
    account (see infra/README.md, "Custom domain").
  EOT
  type        = string
  default     = ""
}

variable "hosted_zone_name" {
  description = <<-EOT
    Name of the Route53 public hosted zone that holds the records for
    domain_name. Empty string (the default) means "same as domain_name",
    which is right for an apex deployment. Set it when domain_name is a
    subdomain served from a parent zone, for example domain_name
    "app.example.com" in hosted zone "example.com". Ignored when
    domain_name is empty.
  EOT
  type        = string
  default     = ""
}

variable "lambda_zip_path" {
  description = <<-EOT
    Path to the built Lambda deployment package (see docs/architecture.md,
    "Lambda packaging"). Defaults to the backend's build output. If the file
    is absent, a placeholder stub package is used instead so plan/apply
    still work before the backend has been built; the CI/CD pipeline always
    builds and applies the real package before deploying to an env that
    serves traffic.
  EOT
  type        = string
  default     = "../backend/build/lambda.zip"
}


variable "allow_stub_lambda" {
  description = <<-EOT
    Bootstrap-only escape hatch. When true and lambda_zip_path does not exist,
    a stub handler that answers 503 is deployed so the rest of the stack can be
    created before the first real build. Defaults to false so a missing build
    artifact fails the apply instead of silently deploying a dead function.
  EOT
  type        = bool
  default     = false
}
