import { ServiceNowSdkStatusSchema } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { serviceNowSdk } from "../../integrations/ServiceNowSdk.ts";
import * as DesktopIpc from "../DesktopIpc.ts";
import * as Channels from "../channels.ts";

export const checkServiceNowSdk = DesktopIpc.makeIpcMethod({
  channel: Channels.CHECK_SERVICENOW_SDK_CHANNEL,
  payload: Schema.Void,
  result: ServiceNowSdkStatusSchema,
  handler: Effect.fn("desktop.ipc.checkServiceNowSdk")(function* () {
    return yield* (yield* serviceNowSdk).check;
  }),
});

export const installServiceNowSdk = DesktopIpc.makeIpcMethod({
  channel: Channels.INSTALL_SERVICENOW_SDK_CHANNEL,
  payload: Schema.Void,
  result: ServiceNowSdkStatusSchema,
  handler: Effect.fn("desktop.ipc.installServiceNowSdk")(function* () {
    return yield* (yield* serviceNowSdk).install;
  }),
});
