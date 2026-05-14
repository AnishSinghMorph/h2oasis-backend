import { EmailClient } from "@azure/communication-email";
import { AzureKeyCredential } from "@azure/core-auth";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

const getAzureEmailClient = (): EmailClient => {
  const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
  if (connectionString) {
    return new EmailClient(connectionString);
  }

  const endpoint = process.env.AZURE_COMMUNICATION_SERVICE_ENDPOINT;
  const accessKey = process.env.AZURE_COMMUNICATION_ACCESS_KEY;

  if (!endpoint || !accessKey) {
    throw new Error(
      "Azure email is not configured. Set AZURE_COMMUNICATION_CONNECTION_STRING or both AZURE_COMMUNICATION_SERVICE_ENDPOINT and AZURE_COMMUNICATION_ACCESS_KEY.",
    );
  }

  return new EmailClient(endpoint, new AzureKeyCredential(accessKey));
};

export const sendEmail = async ({
  to,
  subject,
  html,
}: SendEmailParams): Promise<void> => {
  const senderAddress = process.env.AZURE_EMAIL_FROM;
  if (!senderAddress) {
    throw new Error("AZURE_EMAIL_FROM environment variable is not set.");
  }

  const emailClient = getAzureEmailClient();

  try {
    const poller = await emailClient.beginSend({
      senderAddress,
      content: {
        subject,
        html,
      },
      recipients: {
        to: [{ address: to }],
      },
    });

    await poller.pollUntilDone();
    console.log(`✅ Email sent to ${to}`);
  } catch (error) {
    console.error("❌ Error sending email:", error);
    throw new Error("Failed to send email");
  }
};
