variable "region" {
  description = "AWS region for the state bucket."
  type        = string
  default     = "ca-central-1"
}

variable "bucket_name" {
  description = <<-EOT
    Name of the S3 bucket to create for Terraform state. S3 bucket names are
    globally unique across all AWS accounts, so the default derives a name
    from this account's ID. Override only if that name is already taken or
    you want a different one; infra/backend.hcl.example assumes the default.
  EOT
  type        = string
  default     = null
}

variable "env" {
  description = "Environment the CI roles may deploy. Must match var.env of the root module."
  type        = string
  default     = "dev"
}

variable "github_repo" {
  description = "GitHub repository (owner/name) allowed to assume the CI roles."
  type        = string
  default     = "pkulkark/2waymirror"
}

variable "github_owner_id" {
  description = <<-EOT
    Numeric id of the GitHub owner (gh api users/<owner> --jq .id). GitHub's
    OIDC subject now carries owner and repository ids alongside the names, so
    a trust policy that matches on names alone no longer matches.
  EOT
  type        = string
  default     = "13742492"
}

variable "github_repo_id" {
  description = "Numeric id of the GitHub repository (gh api repos/<owner>/<name> --jq .id)."
  type        = string
  default     = "1356302345"
}
