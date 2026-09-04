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
