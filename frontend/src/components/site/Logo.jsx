import React from "react";
import { Link } from "react-router-dom";

// Replace this shared PNG to update the header and footer logo together.
export function Logo({ to = "/", size = "md", testId = "site-logo" }) {
  const sizeClasses = size === "sm"
    ? "h-9 max-w-[6.75rem]"
    : "h-[2.375rem] max-w-[7.125rem] sm:h-12 sm:max-w-36";
  const inner = (
    <img
      src="/assets/brand/logo-mark.png"
      alt="YuktiCart"
      width="144"
      height="48"
      data-testid={`${testId}-image`}
      className={`block w-auto object-contain ${sizeClasses}`}
    />
  );
  return to ? (
    <Link to={to} data-testid={testId} className="focus-ring inline-flex shrink-0 items-center rounded-md">
      {inner}
    </Link>
  ) : inner;
}
