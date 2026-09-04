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

  # Local state on purpose: this module creates the S3 bucket the rest of
  # infra/ stores its state in, so it cannot depend on that bucket existing
  # yet. Applied once by hand, then left alone.
}
