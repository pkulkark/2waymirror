# AWS-managed policies; using the well-known managed ones instead of
# defining custom cache/origin-request policies for behavior this common.
data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  comment             = "${local.name_prefix} web + api"
  price_class         = "PriceClass_100"

  # Empty when no custom domain is configured, which leaves the
  # distribution answering on its default *.cloudfront.net hostname only.
  aliases = local.use_custom_domain ? [var.domain_name] : []

  origin {
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_id                = "s3-web"
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  origin {
    # aws_apigatewayv2_api.api_endpoint is a full https:// URL; CloudFront
    # wants a bare hostname for a custom origin.
    domain_name = replace(aws_apigatewayv2_api.main.api_endpoint, "https://", "")
    origin_id   = "api-gateway"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-web"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id

    # Client-side routes (for example /s/<token>) are rewritten to /index.html
    # here, on the web behavior only. /api/* is untouched so API status codes
    # and JSON bodies reach the client as sent.
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_rewrite.arn
    }
  }

  ordered_cache_behavior {
    path_pattern             = "/api/*"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    target_origin_id         = "api-gateway"
    viewer_protocol_policy   = "redirect-to-https"
    compress                 = true
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # With no custom domain this is the CloudFront default certificate, which
  # only covers the *.cloudfront.net hostname. With one, it is the ACM
  # certificate read through the validation resource, so the distribution
  # is never pointed at a certificate ACM has not issued yet.
  dynamic "viewer_certificate" {
    for_each = local.use_custom_domain ? [1] : []

    content {
      acm_certificate_arn      = aws_acm_certificate_validation.main[0].certificate_arn
      ssl_support_method       = "sni-only"
      minimum_protocol_version = "TLSv1.2_2021"
    }
  }

  dynamic "viewer_certificate" {
    for_each = local.use_custom_domain ? [] : [1]

    content {
      cloudfront_default_certificate = true
    }
  }
}

resource "aws_cloudfront_function" "spa_rewrite" {
  name    = "${local.name_prefix}-spa-rewrite"
  runtime = "cloudfront-js-2.0"
  comment = "Serve index.html for client-side routes; leave asset requests alone"
  publish = true
  code    = file("${path.module}/cloudfront_functions/spa_rewrite.js")
}
