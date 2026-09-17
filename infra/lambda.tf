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

  # Submission notifications, pinned at both ends: the resource is the domain
  # identity, which is what SES authorizes a send against (the sender), and the
  # recipient is pinned separately by condition, since a resource list cannot
  # constrain who mail goes to. Naming the recipient identity as a resource
  # would instead widen this: it would let the function send *as* that address.
  # The statement is absent entirely when notifications are off, since there is
  # then no identity ARN to name and a statement with an empty resource list is
  # not a valid policy.
  dynamic "statement" {
    for_each = local.notify_enabled ? [1] : []

    content {
      sid       = "SendSubmissionNotifications"
      effect    = "Allow"
      actions   = ["ses:SendEmail"]
      resources = [aws_ses_domain_identity.main[0].arn]

      condition {
        test     = "ForAllValues:StringEquals"
        variable = "ses:Recipients"
        values   = [var.notify_email]
      }
    }
  }
}

resource "aws_iam_role_policy" "lambda" {
  name   = "${local.name_prefix}-lambda"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda_permissions.json
}

resource "aws_lambda_function" "api" {
  lifecycle {
    precondition {
      condition     = local.lambda_zip_exists || var.allow_stub_lambda
      error_message = "No Lambda artifact at ${var.lambda_zip_path}. Run backend/scripts/build_lambda.sh first, or set allow_stub_lambda = true for a bootstrap-only stub deployment."
    }

    # notify_email on its own plans cleanly and then silently sends nothing:
    # local.notify_enabled needs the domain too, because the sender is
    # no-reply@<domain_name> and SES has nothing to verify without it. Fail the
    # plan instead of shipping notifications that look configured and are off.
    precondition {
      condition     = length(var.notify_email) == 0 || local.use_custom_domain
      error_message = "notify_email is set but domain_name is empty. Submission notifications send as no-reply@<domain_name>, so they need the custom domain; set domain_name, or clear notify_email to turn notifications off."
    }
  }

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
      # The session links written into notification emails have to match the
      # links that were sent to the company, so this is the site's own URL.
      TWM_PUBLIC_BASE_URL = local.site_url
      # Both empty unless notifications are switched on, which is what the
      # handler checks before it calls SES at all.
      TWM_NOTIFY_EMAIL = local.notify_enabled ? var.notify_email : ""
      TWM_NOTIFY_FROM  = local.notify_enabled ? "no-reply@${var.domain_name}" : ""
      # AWS_REGION is a reserved Lambda runtime env var: it is set
      # automatically to this function's region and cannot be assigned here.
    }
  }

  depends_on = [aws_cloudwatch_log_group.lambda, aws_iam_role_policy.lambda]
}
