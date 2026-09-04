provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project = "2waymirror"
      Env     = var.env
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  name_prefix       = "2wm-${var.env}"
  use_custom_domain = length(var.domain_name) > 0
  state_bucket_name = coalesce(var.state_bucket_name, "2wm-terraform-state-${data.aws_caller_identity.current.account_id}")
}
