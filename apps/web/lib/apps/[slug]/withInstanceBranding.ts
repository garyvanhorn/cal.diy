import { COMPANY_NAME, SUPPORT_MAIL_ADDRESS, WEBSITE_URL } from "@calcom/lib/constants";

// App metadata in packages/app-store is shared with upstream Cal.diy, so the bundled apps still
// name Cal.com as publisher and contact. White-labeled instances must show their own brand on the
// app page; mapping at read time keeps the upstream app-store files untouched and easy to merge.
const UPSTREAM_PUBLISHERS = new Set(["Cal.com, Inc.", "Cal.com, Inc", "Cal.com", "Cal.diy"]);
const UPSTREAM_EMAILS = new Set(["help@cal.com", "support@cal.com"]);
const UPSTREAM_URL_REGEX = /^https:\/\/(www\.)?cal\.(com|diy)(\/.*)?$/;

type BrandableAppMeta = {
  publisher?: string;
  email?: string;
  url?: string;
};

export function withInstanceBranding<T extends BrandableAppMeta>(appMeta: T): T {
  return {
    ...appMeta,
    publisher:
      appMeta.publisher && UPSTREAM_PUBLISHERS.has(appMeta.publisher) ? COMPANY_NAME : appMeta.publisher,
    email: appMeta.email && UPSTREAM_EMAILS.has(appMeta.email) ? SUPPORT_MAIL_ADDRESS : appMeta.email,
    url: appMeta.url && UPSTREAM_URL_REGEX.test(appMeta.url) ? WEBSITE_URL : appMeta.url,
  };
}
