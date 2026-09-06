# GitHub Actions OIDC federation. Lives in bootstrap, not the root module, so
# the identities CI runs as are never managed by CI itself: a human applies
# this once, and the deploy role has no permission over any IAM role except
# the Lambda execution role.
#
# Two roles with different trust:
#   plan   -> pull_request events only, read-only
#   deploy -> pushes to main only, can apply the root module and publish
#
# An AWS account can only have one OIDC provider per issuer URL. If this
# account already has one for token.actions.githubusercontent.com, import it.

locals {
  name_prefix = "2wm-${var.env}"
  # CI may touch only the root module's state objects (2wm/<env>/...), never
  # this bootstrap module's own state, which lives under 2wm/bootstrap/.
  state_key_prefix = "2wm/${var.env}/"
  account_id       = data.aws_caller_identity.current.account_id
  partition        = "aws"
  # ARNs of the root module's resources, by naming convention (the root module
  # does not exist yet when this is applied).
  table_arn        = "arn:${local.partition}:dynamodb:${var.region}:${local.account_id}:table/${local.name_prefix}"
  web_bucket_arn   = "arn:${local.partition}:s3:::${local.name_prefix}-web"
  content_arn      = "arn:${local.partition}:s3:::${local.name_prefix}-content"
  lambda_arn       = "arn:${local.partition}:lambda:${var.region}:${local.account_id}:function:${local.name_prefix}-api"
  lambda_role_arn  = "arn:${local.partition}:iam::${local.account_id}:role/${local.name_prefix}-lambda"
  log_group_arn    = "arn:${local.partition}:logs:${var.region}:${local.account_id}:log-group:/aws/lambda/${local.name_prefix}-api"
  alarm_arn        = "arn:${local.partition}:cloudwatch:${var.region}:${local.account_id}:alarm:${local.name_prefix}-*"
  cf_function_arn  = "arn:${local.partition}:cloudfront::${local.account_id}:function/${local.name_prefix}-*"
  distribution_arn = "arn:${local.partition}:cloudfront::${local.account_id}:distribution/*"
}

data "tls_certificate" "github" {
  url = "https://token.actions.githubusercontent.com/.well-known/openid-configuration"
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]
}

locals {
  # GitHub's OIDC subject embeds owner and repository ids next to the names
  # (repo:<owner>@<owner_id>/<name>@<repo_id>:<context>) so a renamed or
  # recreated repository cannot inherit trust. Accept that form and the
  # older name-only form.
  github_repo_subjects = [
    "repo:${var.github_repo}",
    "repo:${split("/", var.github_repo)[0]}@${var.github_owner_id}/${split("/", var.github_repo)[1]}@${var.github_repo_id}",
  ]
}

data "aws_iam_policy_document" "assume_from_github" {
  for_each = {
    plan   = "pull_request"
    deploy = "ref:refs/heads/main"
  }

  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [for subject in local.github_repo_subjects : "${subject}:${each.value}"]
    }
  }
}

# ---------------------------------------------------------------------------
# Plan role: read-only. Enough for terraform plan against the root module.
# ---------------------------------------------------------------------------

resource "aws_iam_role" "github_plan" {
  name               = "${local.name_prefix}-github-plan"
  assume_role_policy = data.aws_iam_policy_document.assume_from_github["plan"].json
}

data "aws_iam_policy_document" "github_plan" {
  statement {
    sid       = "StateBucketList"
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.tfstate.arn]
    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values   = ["${local.state_key_prefix}*"]
    }
  }

  statement {
    sid       = "StateRead"
    effect    = "Allow"
    actions   = ["s3:GetObject", "s3:GetObjectVersion"]
    resources = ["${aws_s3_bucket.tfstate.arn}/${local.state_key_prefix}*"]
  }

  statement {
    sid    = "ReadProjectResources"
    effect = "Allow"
    actions = [
      "dynamodb:Describe*",
      "dynamodb:ListTagsOfResource",
      "s3:Get*",
      "s3:List*",
      "lambda:GetFunction*",
      "lambda:GetPolicy",
      "lambda:ListTags",
      "lambda:ListVersionsByFunction",
      "logs:DescribeLogGroups",
      "logs:ListTagsForResource",
      "iam:GetRole",
      "iam:GetRolePolicy",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies",
      "cloudwatch:DescribeAlarms",
    ]
    resources = [
      local.table_arn,
      local.web_bucket_arn,
      local.content_arn,
      local.lambda_arn,
      local.lambda_role_arn,
      local.log_group_arn,
      "${local.log_group_arn}:*",
      local.alarm_arn,
    ]
  }

  # These services do not support resource-level ARNs for read/list calls.
  statement {
    sid    = "ReadUnscopedServices"
    effect = "Allow"
    actions = [
      "apigateway:GET",
      "cloudfront:Get*",
      "cloudfront:List*",
      "cloudfront:DescribeFunction",
      "logs:DescribeLogGroups",
      "iam:GetOpenIDConnectProvider",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_plan" {
  name   = "${local.name_prefix}-github-plan"
  role   = aws_iam_role.github_plan.id
  policy = data.aws_iam_policy_document.github_plan.json
}

# ---------------------------------------------------------------------------
# Deploy role: apply the root module, publish the frontend, update Lambda.
# Cannot touch its own role, the plan role, or the OIDC provider.
# ---------------------------------------------------------------------------

resource "aws_iam_role" "github_deploy" {
  name               = "${local.name_prefix}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.assume_from_github["deploy"].json
}

data "aws_iam_policy_document" "github_deploy" {
  statement {
    sid       = "StateBucketList"
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.tfstate.arn]
    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values   = ["${local.state_key_prefix}*"]
    }
  }

  statement {
    sid       = "StateReadWrite"
    effect    = "Allow"
    actions   = ["s3:GetObject", "s3:GetObjectVersion", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.tfstate.arn}/${local.state_key_prefix}*"]
  }

  statement {
    sid       = "WebBucketSync"
    effect    = "Allow"
    actions   = ["s3:ListBucket", "s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = [local.web_bucket_arn, "${local.web_bucket_arn}/*"]
  }

  statement {
    sid    = "ManageBuckets"
    effect = "Allow"
    actions = [
      "s3:CreateBucket",
      "s3:DeleteBucket",
      "s3:Get*",
      "s3:List*",
      "s3:PutBucket*",
      "s3:DeleteBucketPolicy",
      "s3:PutEncryptionConfiguration",
      "s3:PutLifecycleConfiguration",
      "s3:PutAccelerateConfiguration",
      "s3:PutReplicationConfiguration",
    ]
    resources = [local.web_bucket_arn, local.content_arn]
  }

  statement {
    sid    = "ManageDynamoDBTable"
    effect = "Allow"
    actions = [
      "dynamodb:Describe*",
      "dynamodb:CreateTable",
      "dynamodb:UpdateTable",
      "dynamodb:DeleteTable",
      "dynamodb:TagResource",
      "dynamodb:UntagResource",
      "dynamodb:ListTagsOfResource",
      "dynamodb:UpdateTimeToLive",
      "dynamodb:UpdateContinuousBackups",
    ]
    resources = [local.table_arn]
  }

  statement {
    sid    = "ManageLambdaFunction"
    effect = "Allow"
    actions = [
      "lambda:CreateFunction",
      "lambda:DeleteFunction",
      "lambda:GetFunction*",
      "lambda:UpdateFunctionConfiguration",
      "lambda:UpdateFunctionCode",
      "lambda:PublishVersion",
      "lambda:TagResource",
      "lambda:UntagResource",
      "lambda:ListTags",
      "lambda:ListVersionsByFunction",
      "lambda:AddPermission",
      "lambda:RemovePermission",
      "lambda:GetPolicy",
    ]
    resources = [local.lambda_arn]
  }

  statement {
    sid    = "ManageLambdaExecutionRole"
    effect = "Allow"
    actions = [
      "iam:GetRole",
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:PutRolePolicy",
      "iam:GetRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies",
      "iam:ListInstanceProfilesForRole",
      "iam:UpdateAssumeRolePolicy",
      "iam:PassRole",
    ]
    resources = [local.lambda_role_arn]
  }

  statement {
    sid    = "ManageLogGroup"
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:DeleteLogGroup",
      "logs:DescribeLogGroups",
      "logs:PutRetentionPolicy",
      "logs:TagResource",
      "logs:UntagResource",
      "logs:ListTagsForResource",
    ]
    resources = [local.log_group_arn, "${local.log_group_arn}:*"]
  }

  statement {
    sid    = "ManageAlarm"
    effect = "Allow"
    actions = [
      "cloudwatch:DescribeAlarms",
      "cloudwatch:PutMetricAlarm",
      "cloudwatch:DeleteAlarms",
      "cloudwatch:TagResource",
      "cloudwatch:UntagResource",
      "cloudwatch:ListTagsForResource",
    ]
    resources = [local.alarm_arn]
  }

  statement {
    sid       = "CloudFrontInvalidation"
    effect    = "Allow"
    actions   = ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"]
    resources = [local.distribution_arn]
  }

  statement {
    sid    = "ManageCloudFrontFunction"
    effect = "Allow"
    actions = [
      "cloudfront:CreateFunction",
      "cloudfront:UpdateFunction",
      "cloudfront:DeleteFunction",
      "cloudfront:PublishFunction",
      "cloudfront:DescribeFunction",
      "cloudfront:GetFunction",
    ]
    resources = [local.cf_function_arn]
  }

  # API Gateway v2 and CloudFront distributions/OACs do not support
  # resource-level ARNs for create and list calls.
  statement {
    sid    = "ManageUnscopedServices"
    effect = "Allow"
    actions = [
      "apigateway:GET",
      "apigateway:POST",
      "apigateway:PUT",
      "apigateway:PATCH",
      "apigateway:DELETE",
      "apigateway:TagResource",
      "apigateway:UntagResource",
      "logs:DescribeLogGroups",
      "cloudfront:ListFunctions",
      "cloudfront:GetDistribution",
      "cloudfront:CreateDistribution",
      "cloudfront:UpdateDistribution",
      "cloudfront:DeleteDistribution",
      "cloudfront:ListDistributions",
      "cloudfront:TagResource",
      "cloudfront:UntagResource",
      "cloudfront:ListTagsForResource",
      "cloudfront:CreateOriginAccessControl",
      "cloudfront:GetOriginAccessControl",
      "cloudfront:UpdateOriginAccessControl",
      "cloudfront:DeleteOriginAccessControl",
      "cloudfront:ListCachePolicies",
      "cloudfront:GetCachePolicy",
      "cloudfront:GetOriginRequestPolicy",
      "cloudfront:ListOriginRequestPolicies",
    ]
    resources = ["*"]
  }

  # Belt and braces: even if a statement above were ever widened, this role
  # can never alter the CI identities or the federation it depends on.
  statement {
    sid    = "DenyTouchingCiIdentities"
    effect = "Deny"
    actions = [
      "iam:*Role*",
      "iam:*OpenIDConnectProvider*",
    ]
    resources = [
      aws_iam_role.github_deploy.arn,
      aws_iam_role.github_plan.arn,
      aws_iam_openid_connect_provider.github.arn,
    ]
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name   = "${local.name_prefix}-github-deploy"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_deploy.json
}
