# Custom domain: ACM certificate in us-east-1 plus Route53 alias records.
# Everything here is created only when var.domain_name is set; with the
# default empty value the whole file plans to nothing and the distribution
# keeps its default CloudFront hostname and certificate.

# The zone is created by Route53 domain registration or by hand, and is
# looked up rather than managed here. Terraform not owning it means a
# destroy of this stack (or a re-registration of the domain) cannot take
# the zone and its NS delegation with it.
data "aws_route53_zone" "main" {
  count = local.use_custom_domain ? 1 : 0

  name         = local.hosted_zone_name
  private_zone = false
}

resource "aws_acm_certificate" "main" {
  count    = local.use_custom_domain ? 1 : 0
  provider = aws.us_east_1

  domain_name       = var.domain_name
  validation_method = "DNS"

  # The certificate is referenced by the distribution, so a replacement has
  # to exist before the old one goes away.
  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${local.name_prefix}-cert"
  }
}

# One CNAME per name on the certificate. ACM returns a set here, so this is
# keyed by domain name rather than by list position.
resource "aws_route53_record" "cert_validation" {
  for_each = local.use_custom_domain ? {
    for option in aws_acm_certificate.main[0].domain_validation_options :
    option.domain_name => {
      name   = option.resource_record_name
      record = option.resource_record_value
      type   = option.resource_record_type
    }
  } : {}

  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60

  # ACM re-issues with the same validation record; overwrite instead of
  # failing the apply on an already-present record.
  allow_overwrite = true
}

# Blocks until ACM sees the CNAMEs and issues the certificate. CloudFront
# reads the certificate through this resource, so the distribution is never
# updated with a certificate that is still pending validation.
resource "aws_acm_certificate_validation" "main" {
  count    = local.use_custom_domain ? 1 : 0
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.main[0].arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# Alias records, not CNAMEs: an alias works at a zone apex and costs
# nothing to resolve. IPv6 needs its own record because the distribution
# has is_ipv6_enabled = true.
resource "aws_route53_record" "a" {
  count = local.use_custom_domain ? 1 : 0

  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "aaaa" {
  count = local.use_custom_domain ? 1 : 0

  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = var.domain_name
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }
}
