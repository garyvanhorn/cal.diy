import { appKeysSchemas } from "@calcom/app-store/apps.keys-schemas.generated";

// app-store-cli keys this map by app id, which is the dir name except for stripepayment ("stripe").
// Keep in sync with getAppId in packages/app-store-cli/src/build.ts.
export function getAppKeysSchema(dirName: string) {
  const appId = dirName === "stripepayment" ? "stripe" : dirName;
  return appKeysSchemas[appId as keyof typeof appKeysSchemas];
}
