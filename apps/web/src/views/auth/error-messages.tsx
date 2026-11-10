import { JSX } from "solid-js";

const errorMessages: Record<string, JSX.Element> = {
  invalidEmail: "Incorrect email address",
  invalidCredentials: "Invalid credentials",
  emailNotVerified: "Email not verified",
  magicLinkAlreadySent: "Wait 1 min before requesting a new magic link",
  totpTokenInvalid: "Invalid 2FA code",
  resourceNotFound: "User not found",
  alreadyExists: "User already exists",
  useEmailSignIn: "This GitHub account is not linked. Sign in with your email",
  signUpsClosed: (
    <>
      Vrite Cloud no longer takes new accounts.
      <br />
      Vrite continues as{" "}
      <a href="https://andesine.app" class="underline">
        Andesine
      </a>
      .
    </>
  ),
  disposableEmail: (
    <>
      Disposable email addresses are not allowed.
      <br />
      If you believe this is a mistake, please contact us at{" "}
      <a href="mailto:hello@vrite.io" class="underline">
        support@vrite.io
      </a>
      .
    </>
  )
};
const getErrorMessage = (reason: string): JSX.Element => {
  return errorMessages[reason] || "Error";
};

export { getErrorMessage };
