import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "invite" model, go to https://ts-webapp.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "DataModel-internal-tool-invite",
  fields: {
    email: {
      type: "string",
      validations: { required: true, unique: true },
      storageKey: "ciLQXKjRk8jm",
    },
    inviteToken: { type: "string", storageKey: "PM58Xp23E1TW" },
  },
};
