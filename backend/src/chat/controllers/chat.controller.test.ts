import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import { sendMessage } from "./chat.controller.js";

function createMockResponse() {
  const state: {
    statusCode: number;
    body: unknown;
  } = {
    statusCode: 200,
    body: null,
  };

  const response = {
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      state.body = payload;
      return this;
    },
  } as Partial<Response> as Response;

  return { response, state };
}

test("sendMessage returns 400 for invalid payloads", async () => {
  const request = {
    body: {
      bootstrap: "yes",
      channel: "WEB",
    },
  } as Partial<Request> as Request;
  const { response, state } = createMockResponse();

  await sendMessage(request, response);

  assert.equal(state.statusCode, 400);
  assert.deepEqual(state.body && typeof state.body === "object" ? (state.body as { error?: string }).error : null, "Invalid request");
  assert.ok(Array.isArray((state.body as { details?: unknown[] }).details));
});
