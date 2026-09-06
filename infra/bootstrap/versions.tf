terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  # This module creates the state bucket, so its very first apply runs with
  # local state. After that, the state is migrated into the bucket it created
  # (terraform init -migrate-state -backend-config=backend.hcl) so nothing
  # important lives only on one laptop. See README.
  backend "s3" {}
}
