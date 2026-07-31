import { getServiceById, getBrandVariant } from "@/assets/data/services";

/**
 * The subset of a subscription (or any UI item built from one) that the logo
 * system reads. Consumers that don't have a full `Subscription` (e.g. savings
 * breakdown items) can pass objects that carry these fields.
 */
export interface LogoFields {
  serviceId?: string;
  brandVariant?: string;
  logoIcon?: string;
  logoImageUri?: string;
  logoUrl?: string;
  website?: string;
}

/**
 * Resolves the bundled brand asset for a subscription's selected variant.
 * Returns undefined when the service is unknown or ships no bundled variants
 * (the caller then falls back to the favicon / monogram).
 */
export function brandVariantSource(
  fields: LogoFields | null | undefined,
): string | undefined {
  if (!fields?.serviceId) return undefined;
  const service = getServiceById(fields.serviceId);
  const variant = getBrandVariant(service, fields.brandVariant);
  return variant?.source;
}

/**
 * Resolves the effective logo source (string passed to LogoCircle) from the
 * independent source fields. Single shared precedence for every surface:
 *   1. custom Lucide icon      -> "icon:<Name>"
 *   2. custom image URI        -> the persisted URI
 *   3. selected brand variant  -> bundled "local:brand:<name>" asset
 *   4. discovered favicon      -> legacy logoUrl (Google favicon fallback)
 *
 * No source left behind: a custom override never destroys the selected brand
 * variant (that is restored by "Use Brand Logo"), and the brand variant never
 * hides the favicon that was previously resolved.
 */
export function resolveLogoSrc(
  fields: LogoFields | null | undefined,
): string | undefined {
  if (!fields) return undefined;
  if (fields.logoIcon) return `icon:${fields.logoIcon}`;
  if (fields.logoImageUri) return fields.logoImageUri;
  const brandSource = brandVariantSource(fields);
  if (brandSource) return brandSource;
  return fields.logoUrl || undefined;
}
