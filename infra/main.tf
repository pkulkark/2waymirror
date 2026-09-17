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

  # The public entry point. Exported as an output and handed to the Lambda,
  # which builds the session links it puts in notification emails from it.
  #
  # This reads as a dependency loop (the function's environment refers to the
  # distribution, which fronts the API in front of the function) and is not
  # one, because the graph runs function -> distribution -> aws_apigatewayv2_api,
  # and that API resource refers to nothing. It is the integration, a separate
  # resource, that points back at the function. Giving aws_apigatewayv2_api.main
  # any reference to the Lambda would close the loop and break the plan with a
  # cycle, so keep the function's details in the integration where they are.
  site_url = local.use_custom_domain ? "https://${var.domain_name}" : "https://${aws_cloudfront_distribution.main.domain_name}"

  # Submission notifications need a sender SES can verify, and that sender is
  # no-reply@<domain_name>, so they ride along with the custom domain: with no
  # domain configured there is nothing to send from and the switch stays off.
  notify_enabled = local.use_custom_domain && length(var.notify_email) > 0
}
