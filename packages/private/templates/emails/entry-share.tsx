/** @jsxImportSource react */

import {
  Body,
  Button,
  Container,
  Html,
  Preview,
  Section,
  Tailwind,
  Text
} from "@react-email/components";
import * as React from "react";
import { PUBLIC_APP_URL } from "../src/constants";
import { EmailFooter } from "../src/email-footer";
import { EmailHeader } from "../src/email-header";
import { EmailHead } from "../src/email-head";

interface EntryShareProps {
  entryName?: string;
  sharerName?: string;
  access?: "view" | "comment";
  shareLink?: string;
}

const EntryShare: React.FC<EntryShareProps> = ({
  entryName = "Getting started",
  sharerName = "Someone",
  access = "comment",
  shareLink = `${PUBLIC_APP_URL}/share/shr_example`
}) => (
  <Html>
    <EmailHead />
    <Preview>
      {sharerName} shared {entryName} with you on Andesine
    </Preview>
    <Tailwind>
      <Body className="email-body bg-white text-gray-800 my-auto mx-auto font-sans">
        <Container className="email-container bg-white mx-auto w-[560px]">
          <EmailHeader>{entryName}</EmailHeader>
          <Text className="text-[20px] leading-[28px]">
            {sharerName} shared <strong>{entryName}</strong> with you in Andesine. You can{" "}
            {access === "comment" ? "read it, comment and suggest changes" : "read it"}. Sign in
            with this email address to open it:
          </Text>
          <Section className="text-center mt-[12px] mb-[24px]">
            <Button
              href={shareLink}
              className="email-button inline-block bg-gray-900 text-white text-[16px] font-medium py-[12px] rounded-[8px] w-[560px]"
            >
              Open
            </Button>
          </Section>
          <Text className="text-[20px] leading-[28px]">
            If you weren&apos;t expecting this, you can ignore this email.
          </Text>
          <EmailFooter />
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

// @ts-expect-error: React Email reads PreviewProps metadata that is absent from React.FC.
EntryShare.PreviewProps = {
  entryName: "Release notes",
  sharerName: "John Doe",
  access: "comment",
  shareLink: `${PUBLIC_APP_URL}/share/shr_example`
};

export { EntryShare };
export type { EntryShareProps };
export default EntryShare;
