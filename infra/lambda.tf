locals {
  lambda_zip_exists  = fileexists(var.lambda_zip_path)
  lambda_zip_path    = local.lambda_zip_exists ? var.lambda_zip_path : data.archive_file.lambda_stub.output_path
  lambda_source_hash = local.lambda_zip_exists ? filebase64sha256(var.lambda_zip_path) : data.archive_file.lambda_stub.output_base64sha256
}

data "archive_file" "lambda_stub" {
  type        = "zip"
  source_dir  = "${path.module}/lambda_stub"
  output_path = "${path.module}/.build/lambda_stub.zip"
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.name_prefix}-api"
  retention_in_days = 30
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${local.name_prefix}-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

# Least privilege: DynamoDB CRUD on this table only, read on the content
# bucket only, and logs to this function's own log group only.
data "aws_iam_policy_document" "lambda_permissions" {
  statement {
    sid    = "TableCrud"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
    ]
    resources = [aws_dynamodb_table.main.arn]
  }

  statement {
    sid       = "ContentBucketRead"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.content.arn}/*"]
  }

  statement {
    sid       = "ContentBucketList"
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.content.arn]
  }

  statement {
    sid    = "Logs"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["${aws_cloudwatch_log_group.lambda.arn}:*"]
  }
}

resource "aws_iam_role_policy" "lambda" {
  name   = "${local.name_prefix}-lambda"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda_permissions.json
}

resource "aws_lambda_function" "api" {
  function_name = "${local.name_prefix}-api"
  role          = aws_iam_role.lambda.arn
  handler       = "twowaymirror.handler.handler"
  runtime       = "python3.13"
  architectures = ["arm64"]
  timeout       = 10
  memory_size   = 256

  filename         = local.lambda_zip_path
  source_code_hash = local.lambda_source_hash

  environment {
    variables = {
      TWM_TABLE_NAME     = aws_dynamodb_table.main.name
      TWM_TENANT         = "default"
      TWM_CONTENT_SOURCE = "s3://${aws_s3_bucket.content.bucket}"
      # AWS_REGION is a reserved Lambda runtime env var: it is set
      # automatically to this function's region and cannot be assigned here.
    }
  }

  depends_on = [aws_cloudwatch_log_group.lambda, aws_iam_role_policy.lambda]
}
