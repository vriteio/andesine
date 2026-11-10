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

interface SpendingAlertProps {
  workspaceName?: string;
  /** In percent. */
  threshold?: number;
  spendingLimit?: string;
  estimatedSpend?: string;
  billingLink?: string;
}

const SpendingAlert: React.FC<SpendingAlertProps> = ({
  workspaceName = "My Workspace",
  threshold = 80,
  spendingLimit = "$100.00",
  estimatedSpend = "$80.00",
  billingLink = `${PUBLIC_APP_URL}/settings/billing`
}) => (
  <Html>
    <EmailHead />
    <Preview>
      {workspaceName} reached {`${threshold}%`} of its monthly spending limit
    </Preview>
    <Tailwind>
      <Body className="email-body bg-white text-gray-800 my-auto mx-auto font-sans">
        <Container className="email-container bg-white mx-auto w-[560px]">
          <EmailHeader>
            {threshold >= 100 ? "Spending limit reached" : "Spending limit almost reached"}
          </EmailHeader>
          <Text className="text-[20px] leading-[28px]">
            The usage charges of <strong>{workspaceName}</strong> this month are about{" "}
            <strong>{estimatedSpend}</strong>, {threshold}% of its {spendingLimit} spending limit.
          </Text>
          <Text className="text-[20px] leading-[28px]">
            {threshold >= 100
              ? "API calls and AI features are stopped until the next month. Raise or remove the limit to use them now."
              : "When the charges reach the limit, API calls and AI features stop until the next month."}
          </Text>
          <Section className="text-center mt-[12px] mb-[24px]">
            <Button
              href={billingLink}
              className="email-button inline-block bg-gray-900 text-white text-[16px] font-medium py-[12px] rounded-[8px] w-[560px]"
            >
              Open billing settings
            </Button>
          </Section>
          <EmailFooter />
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

// @ts-expect-error: React Email reads PreviewProps metadata that is absent from React.FC.
SpendingAlert.PreviewProps = {
  workspaceName: "Acme Corp",
  threshold: 80,
  spendingLimit: "$100.00",
  estimatedSpend: "$80.00",
  billingLink: `${PUBLIC_APP_URL}/settings/billing`
};

export { SpendingAlert };
export type { SpendingAlertProps };
export default SpendingAlert;
