terraform {
  required_version = ">= 1.10.0" # use_lockfile (S3 native locking) needs 1.10+

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.6"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  # Partial config: init with -backend-config=backend.hcl (see
  # backend.hcl.example). No bucket/key/region here so the same code works
  # for any env.
  backend "s3" {}
}
