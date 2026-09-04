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
    Custom domain name for CloudFront. Empty string (the default) skips
    ACM/Route53 and the distribution and API Gateway use their default AWS
    hostnames. Custom domain support (ACM certificate, Route53 records,
    CloudFront aliases) is not built yet; leave this empty for v0.
  EOT
  type        = string
  default     = ""

  validation {
    condition     = var.domain_name == ""
    error_message = "Custom domain support (ACM + Route53) is not implemented yet. Leave domain_name empty for v0."
  }
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

variable "state_bucket_name" {
  description = <<-EOT
    Name of the Terraform state bucket created by infra/bootstrap. Needed
    here only to scope the GitHub deploy role's IAM policy to that bucket's
    ARN. Must match whatever infra/bootstrap actually created; defaults to
    the same account-id-derived name bootstrap uses by default.
  EOT
  type        = string
  default     = null
}
