# ADR-0008: Custom domain via ACM in us-east-1 and Route 53 alias records

Date: 2026-09-14
Status: Accepted

## Context

The site is served from CloudFront on its generated `*.cloudfront.net` hostname. That hostname works, but it is what gets pasted into an email to a company, so it is part of the first impression, and it is not portable: it changes if the distribution is ever replaced, which would break links that were already sent. A custom domain fixes both. CloudFront will only serve one over HTTPS with a certificate it can read, and it accepts ACM certificates from `us-east-1` only, whatever region the rest of the stack runs in (here `ca-central-1`). Whatever is chosen has to stay off by default, since the stack is applied by CI today with no domain configured and that apply must keep planning clean.

## Options considered

1. **CloudFront default hostname only.** No certificate, no DNS, nothing to keep valid. Rejected because the generated hostname is tied to the distribution rather than to the project: replacing the distribution invalidates every link already sent, and a session link is the product.
2. **An external DNS provider (registrar DNS, Cloudflare) with a certificate imported into ACM.** Attractive if DNS already lived elsewhere, and Cloudflare's free tier is generous. Rejected because DNS validation, renewal, and the apex alias would then straddle two systems: ACM renews automatically only while it can see its validation records, and an apex `CNAME` is not valid DNS, so an external provider means either a provider-specific flattening feature or a redirect. Route 53 alias records solve the apex case natively and keep DNS in the same account and the same Terraform run as the distribution.
3. **Route 53 with the hosted zone managed by Terraform.** Consistent, everything in one place. Rejected because the zone's nameservers are the delegation target the registrar points at: destroying and recreating the zone issues a new set, which breaks the domain until the registrar is updated by hand. A `terraform destroy` on a dev stack should not be able to take the domain down.
4. **Route 53 with a pre-existing hosted zone, looked up by name.** Chosen. The zone is created once by registration or by hand and read with a data source, so Terraform can write records into it but can never delete it.

## Decision

A single variable, `var.domain_name`, switches the custom domain on. When it is set, Terraform issues a DNS-validated ACM certificate in `us-east-1` through a provider alias, writes the validation records into a pre-existing Route 53 hosted zone found by name, waits for issuance with `aws_acm_certificate_validation`, and then attaches the name to the distribution as an alias with `sni-only` and a `TLSv1.2_2021` minimum, plus A and AAAA alias records. When it is empty, the default, none of those resources exist and the distribution keeps the CloudFront default certificate. `var.hosted_zone_name` covers the case of a subdomain served from a parent zone.

## Consequences

The domain becomes a repository variable rather than a code change, and rolling back is unsetting it. The certificate renews itself as long as the validation records stay in the zone, which they do because Terraform owns them. The costs: a second provider alias in the root module for one region's worth of resources; an apply that blocks for minutes on ACM validation and then again on the distribution update; and a manual prerequisite that Terraform cannot check for, since the hosted zone must exist and be delegated before the first apply, and a missing zone surfaces as a data-source lookup failure rather than something friendlier. Moving DNS off Route 53 later would mean revisiting this, because the apex alias record has no portable equivalent.
