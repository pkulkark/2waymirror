"""Placeholder Lambda handler.

Terraform packages this stub as the Lambda deployment package only when
var.lambda_zip_path (the real backend build, see docs/architecture.md,
"Lambda packaging") does not exist on disk. That keeps `terraform plan` and
`terraform apply` working before the backend has been built, for example on
a first bootstrap of an environment. The CI/CD pipeline always builds the
real package and applies it before an environment serves real traffic; this
stub is never meant to run against live sessions.
"""


def handler(event, context):
    return {
        "statusCode": 503,
        "body": "2WayMirror: placeholder Lambda package, the real build has not been deployed yet.",
    }
