# RC IT Services — rcitcs.com Cutover Status

## Status

`PENDING FINAL PUBLIC-DOMAIN CUTOVER`

The requested public production domain is `rcitcs.com` with `www.rcitcs.com` normalized to the apex domain. The website is currently deployed through the verified Cloudflare Worker named `rc-it-consulting-services` in the active RC IT Services Cloudflare account.

The verified production Worker endpoint is:

`https://rc-it-consulting-services.rcitcservices.workers.dev`

The separate private administration surface uses its dedicated admin hostname architecture and is not the canonical origin for public website SEO.

## Safety position before custom-domain cutover

Until `rcitcs.com` is explicitly verified as the public website production origin, the SEO canonical origin, sitemap entries, robots sitemap reference and production route verification must remain on the verified Workers endpoint above. Canonicals must not advertise an unverified future domain.

The retired Worker hostname `https://rcitcservices.frsmkgit.workers.dev` is no longer the active production deployment and must not be emitted by public canonical URLs, sitemap output, robots output, application trust allowlists or release verification.

## Required final infrastructure resolution

When the public-domain cutover phase is executed, `rcitcs.com` and `www.rcitcs.com` must be attached to the verified production Worker in the correct Cloudflare account/zone, with DNS and TLS verified before `PUBLIC_ORIGIN` is changed.

The preferred final model remains a Worker Custom Domain because the Worker is the website origin. After live verification:

- `rcitcs.com` becomes the public canonical origin;
- `www.rcitcs.com` normalizes to the apex;
- the Workers endpoint remains an infrastructure endpoint rather than the advertised canonical site;
- canonical tags, sitemap entries, robots sitemap reference and production smoke checks are changed together in one controlled cutover.

## Email boundary

The intended inbound destination remains `rcitcservices@gmail.com`. Cloudflare Email Routing aliases remain planned for `info@rcitcs.com`, `contact@rcitcs.com`, `support@rcitcs.com`, `career@rcitcs.com` and `legal@rcitcs.com`. Email Routing requires destination verification and zone-level routing configuration and must not be marked configured until that work is independently verified.
