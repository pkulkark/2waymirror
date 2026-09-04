output "bucket_name" {
  description = "Name of the Terraform state bucket. Use this in infra/backend.hcl."
  value       = aws_s3_bucket.tfstate.bucket
}

output "bucket_arn" {
  value = aws_s3_bucket.tfstate.arn
}

output "region" {
  value = var.region
}
