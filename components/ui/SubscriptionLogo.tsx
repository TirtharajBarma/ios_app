import React, { memo } from "react";
import LogoCircle, { type LogoCircleProps } from "./LogoCircle";
import { resolveLogoSrc, type LogoFields } from "@/utils/logo";

export interface SubscriptionLogoProps
  extends Omit<LogoCircleProps, "source"> {
  /** The subscription (or a UI item built from one) to resolve the logo from. */
  fields: LogoFields | null | undefined;
}

/**
 * Single shared entry point for rendering a subscription's logo.
 *
 * Resolves source through utils/logo and renders via LogoCircle so every
 * surface (preview, home cards, upcoming, details, savings, ...) shows
 * exactly the same result. The monogram fallback lives inside LogoCircle
 * and only appears when no source resolves at all.
 */
function SubscriptionLogo({
  fields,
  name,
  color,
  size = "md",
  website,
  ...rest
}: SubscriptionLogoProps) {
  return (
    <LogoCircle
      source={resolveLogoSrc(fields)}
      name={name}
      color={color}
      size={size}
      website={fields?.website ?? website}
      {...rest}
    />
  );
}

export default memo(SubscriptionLogo);
