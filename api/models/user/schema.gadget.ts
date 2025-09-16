import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "user" model, go to https://ts-webapp.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "DataModel-AppAuth-User",
  fields: {
    email: {
      type: "email",
      validations: { required: true, unique: true },
      storageKey: "7_tUfBuLLDkS",
    },
    emailVerificationToken: {
      type: "string",
      storageKey: "I1W7em_OHzfc",
    },
    emailVerificationTokenExpiration: {
      type: "dateTime",
      includeTime: true,
      storageKey: "uheovh4EKpkz",
    },
    emailVerified: {
      type: "boolean",
      default: false,
      storageKey: "RrEgCZKYNvih",
    },
    firstName: { type: "string", storageKey: "2dCccW0vmSt4" },
    googleImageUrl: { type: "url", storageKey: "3km2RFdZ0e-e" },
    googleProfileId: { type: "string", storageKey: "7cB0n7KLw6Fl" },
    lastName: { type: "string", storageKey: "ieTUugt1XA0_" },
    lastSignedIn: {
      type: "dateTime",
      includeTime: true,
      storageKey: "OyiklZ3RPdx3",
    },
    password: {
      type: "password",
      validations: { strongPassword: true },
      storageKey: "fb1W-zfQMUIn",
    },
    profilePicture: {
      type: "file",
      allowPublicAccess: true,
      storageKey: "To0T5idj-rLj",
    },
    resetPasswordToken: {
      type: "string",
      storageKey: "vsHKDw6SMAZd",
    },
    resetPasswordTokenExpiration: {
      type: "dateTime",
      includeTime: true,
      storageKey: "NP7wdvFYy-to",
    },
    roles: {
      type: "roleList",
      default: ["unauthenticated"],
      storageKey: "5KXm3SN3-22a",
    },
  },
};
