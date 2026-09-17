# Submission notifications: the SES identities the API sends through when a
# company submits its answers, plus the DKIM records that keep that mail out
# of spam folders. Everything here is created only when var.notify_email is
# set and a custom domain is configured; with the default empty value the
# whole file plans to nothing and the API sends nothing.

# The sending identity. Verified through DNS in the same zone the site uses,
# which is why this is gated on the custom domain rather than on
# var.notify_email alone: no domain, no address to send from.
resource "aws_ses_domain_identity" "main" {
  count = local.notify_enabled ? 1 : 0

  domain = var.domain_name
}

resource "aws_ses_domain_dkim" "main" {
  count = local.notify_enabled ? 1 : 0

  domain = aws_ses_domain_identity.main[0].domain
}

# SES returns exactly three DKIM tokens, so this is a fixed count rather than
# a for_each over a value that is unknown until apply. Signed mail is not
# optional in practice: an unsigned no-reply@ is what receivers treat as spam.
resource "aws_route53_record" "ses_dkim" {
  count = local.notify_enabled ? 3 : 0

  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = "${aws_ses_domain_dkim.main[0].dkim_tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  records = ["${aws_ses_domain_dkim.main[0].dkim_tokens[count.index]}.dkim.amazonses.com"]
  ttl     = 600

  # SES reissues the same tokens for an identity that already exists;
  # overwrite instead of failing the apply on an already-present record.
  allow_overwrite = true
}

# The recipient. Creating this makes SES send a verification link to the
# address, which has to be clicked once before any notification arrives:
# sandbox SES refuses to deliver to an unverified destination. Since the only
# recipient is the candidate, sandbox is all this needs (see infra/README.md,
# "Submission notifications").
resource "aws_ses_email_identity" "notify" {
  count = local.notify_enabled ? 1 : 0

  email = var.notify_email
}
