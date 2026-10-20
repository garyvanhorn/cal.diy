import { APP_NAME, WEBAPP_URL } from "@calcom/lib/constants";
import logger from "@calcom/lib/logger";

import { FEISHU_HOST } from "../common";
import { getAppAccessToken } from "./AppAccessToken";

const log = logger.getSubLogger({ prefix: [`[[FeishuTenantCredential]`] });

const msg = {
  en_us: {
    title: `Welcome to ${APP_NAME}!`,
    content: [
      [
        {
          tag: "text",
          text: `${APP_NAME} is a scheduling platform.`,
        },
      ],
      [
        {
          tag: "text",
          text: "It lets you share a booking link so anyone can book time on your calendar.",
        },
      ],
      [
        {
          tag: "text",
          text: "",
        },
      ],
      [
        {
          tag: "text",
          text: "Get started",
        },
      ],
      [
        {
          tag: "text",
          text: `1. Sign in at ${WEBAPP_URL}.`,
        },
      ],
      [
        {
          tag: "text",
          text: `2. Then go to "Integrations" in ${APP_NAME} -> install `,
        },
        {
          tag: "a",
          text: '"Feishu Calendar"',
          href: "https://www.larksuite.com/hc/articles/057527702350",
        },
        {
          tag: "text",
          text: " -> sign-in via Feishu",
        },
      ],
      [
        {
          tag: "text",
          text: "3. Done. Create your Event Types and share your booking links with external participants!",
        },
      ],
      [
        {
          tag: "text",
          text: "",
        },
      ],
      [
        {
          tag: "text",
          text: "Do not hesitate to reach out to our agents if you need any assistance.",
        },
      ],
      [
        {
          tag: "a",
          text: "Get Help",
          href: "https://applink.larksuite.com/client/helpdesk/open?id=6650327445582905610",
        },
      ],
    ],
  },
};

async function getTenantAccessTokenByTenantKey(tenantKey: string): Promise<string> {
  try {
    const appAccessToken = await getAppAccessToken();
    const resp = await fetch(`https://${FEISHU_HOST}/open-apis/auth/v3/tenant_access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_access_token: appAccessToken,
        tenant_key: tenantKey,
      }),
    });
    const data = await resp.json();
    return data.tenant_access_token;
  } catch (error) {
    log.error(error);
    throw error;
  }
}

export async function sendPostMsg(
  tenantKey: string,
  senderOpenId: string,
  message: string = JSON.stringify(msg)
): Promise<{ code: number; msg: string }> {
  const tenantAccessToken = await getTenantAccessTokenByTenantKey(tenantKey);

  const response = await fetch(`https://${FEISHU_HOST}/open-apis/im/v1/messages?receive_id_type=open_id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tenantAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      receive_id: senderOpenId,
      content: message,
      msg_type: "post",
    }),
  });

  const responseBody = await response.json();
  log.debug("send message success", responseBody);
  return responseBody;
}
