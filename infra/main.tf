provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project = "2waymirror"
      Env     = var.env
    }
  }
}

# CloudFront only accepts ACM certificates issued in us-east-1, whatever
# region the rest of the stack lives in. Only the certificate and its
# validation use this alias; everything else stays in var.region.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

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

  # hosted_zone_name defaults to domain_name, which is what an apex
  # deployment wants; a subdomain sets it to the parent zone.
  hosted_zone_name = length(var.hosted_zone_name) > 0 ? var.hosted_zone_name : var.domain_name
}
