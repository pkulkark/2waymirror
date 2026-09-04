output "cloudfront_domain" {
  description = "CloudFront distribution's default hostname (fronts both the SPA and /api/*)."
  value       = aws_cloudfront_distribution.main.domain_name
}

output "api_endpoint" {
  description = "API Gateway HTTP API's default endpoint (not the public entry point; use cloudfront_domain for that)."
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "web_bucket" {
  value = aws_s3_bucket.web.bucket
}

output "content_bucket" {
  value = aws_s3_bucket.content.bucket
}

output "table_name" {
  value = aws_dynamodb_table.main.name
}

output "lambda_name" {
  value = aws_lambda_function.api.function_name
}


output "distribution_id" {
  description = "CloudFront distribution ID, for CloudFront invalidation calls in CI."
  value       = aws_cloudfront_distribution.main.id
}
