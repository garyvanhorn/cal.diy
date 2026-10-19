"use client";

import { getWebhookVersionLabel, WEBHOOK_VERSION_OPTIONS } from "@calcom/features/webhooks/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@coss/ui/components/select";
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "@coss/ui/components/tooltip";
import type { UseFormReturn } from "react-hook-form";
import type { WebhookFormValues } from "./WebhookForm";

const webhookVersionItems = WEBHOOK_VERSION_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
}));

export function WebhookVersionCTA({ formMethods }: { formMethods: UseFormReturn<WebhookFormValues> }) {
  const { t } = useLocale();
  const version = formMethods.watch("version");
  const selectedVersionItem =
    webhookVersionItems.find((item) => item.value === version) ?? webhookVersionItems[0];

  return (
    <div className="flex items-center gap-1 self-center">
      <TooltipProvider delay={0}>
        <Tooltip>
          <TooltipTrigger
            render={
              <div className="inline-flex">
                <Select
                  aria-label={t("webhook_version")}
                  value={selectedVersionItem}
                  onValueChange={(newValue) => {
                    if (newValue) {
                      formMethods.setValue("version", newValue.value, { shouldDirty: true });
                    }
                  }}
                  items={webhookVersionItems}>
                  <SelectTrigger size="sm" className="min-w-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopup>
                    {webhookVersionItems.map((item) => (
                      <SelectItem key={item.value} value={item}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>
            }
          />
          <TooltipPopup>{t("webhook_version")}</TooltipPopup>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
