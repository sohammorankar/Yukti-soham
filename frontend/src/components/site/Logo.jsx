import React from "react";
import { Link } from "react-router-dom";

// Replace this shared PNG to update the header and footer logo together.
export function Logo({ to = "/", size = "md", testId = "site-logo" }) {
  const sizeClasses = size === "sm"
    ? "h-8 max-w-24"
    : "h-8 max-w-24 sm:h-10 sm:max-w-[7.5rem]";
  const inner = (
    <img
      src="/assets/brand/logo-mark.png"
      alt="YuktiCart"
      width="120"
      height="40"
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
