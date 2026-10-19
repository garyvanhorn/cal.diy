import { APP_NAME } from "@calcom/lib/constants";
import classNames from "@calcom/ui/classNames";

export function Logo({
  small,
  icon,
  inline = true,
  className,
  src = "/api/logo",
}: {
  small?: boolean;
  icon?: boolean;
  inline?: boolean;
  className?: string;
  src?: string;
}) {
  return (
    <h3 className={classNames("logo", inline && "inline", className)}>
      <strong>
        {icon ? (
          <img className="mx-auto w-9" alt={APP_NAME} title={APP_NAME} src={`${src}?type=icon`} />
        ) : (
          // The wordmark is multi-colour, so dark mode swaps in a light variant instead of CSS-inverting it.
          <>
            <img
              className={classNames(small ? "h-4 w-auto" : "h-5 w-auto", "dark:hidden")}
              alt={APP_NAME}
              title={APP_NAME}
              src={src}
            />
            <img
              className={classNames(small ? "h-4 w-auto" : "h-5 w-auto", "hidden dark:inline")}
              alt={APP_NAME}
              title={APP_NAME}
              src={`${src}?type=logo-dark`}
            />
          </>
        )}
      </strong>
    </h3>
  );
}
