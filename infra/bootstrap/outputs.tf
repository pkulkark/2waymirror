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

output "plan_role_arn" {
  description = "Role for pull request plans (read-only). Set as repository variable AWS_PLAN_ROLE_ARN."
  value       = aws_iam_role.github_plan.arn
}

output "deploy_role_arn" {
  description = "Role for deploys from main. Set as repository variable AWS_DEPLOY_ROLE_ARN."
  value       = aws_iam_role.github_deploy.arn
}
