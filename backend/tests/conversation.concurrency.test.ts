import assert from "node:assert/strict";
import test from "node:test";
import { ChatStep, ConversationChannel, ConversationStatus, MessageRole } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import { ConversationRepository } from "../src/chat/repositories/conversation.repository.js";
import { ConversationVersionConflictError } from "../src/chat/repositories/conversation.repository.js";
import { LeadRepository } from "../src/chat/repositories/lead.repository.js";
import { MessageRepository } from "../src/chat/repositories/message.repository.js";
import { ConversationService } from "../src/chat/services/conversation.service.js";
import { stubMethod } from "./adversarial/helpers.js";

type ConversationState = {
  id: string;
  channel: ConversationChannel;
  contactId: string | null;
  customerName: string;
  step: ChatStep;
  status: ConversationStatus;
  version: number;
  collectedData: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

function createService() {
  return new ConversationService({
    getActivePromptBundle: async () => null,
    searchFaqByKeywords: async () => [],
    groqJsonCompletion: async () => null,
    groqTextCompletion: async () => "",
  });
}

function stubConversationReads(conversationState: () => ConversationState, committedMessages: Array<{ role: MessageRole; content: string }>) {
  stubMethod(ConversationRepository.prototype, "findById", (async () => ({
    ...conversationState(),
    collectedData: { ...(conversationState().collectedData as Record<string, unknown>) },
  })) as ConversationRepository["findById"]);

  stubMethod(MessageRepository.prototype, "findRecentMessages", (async () =>
    committedMessages.map((message, index) => ({
      id: `msg-${index + 1}`,
      conversationId: conversationState().id,
      role: message.role,
      content: message.content,
      metadata: null,
      createdAt: new Date(),
    })).reverse()
  ) as MessageRepository["findRecentMessages"]);

  stubMethod(MessageRepository.prototype, "findMessagesByConversationId", (async () =>
    committedMessages.map((message, index) => ({
      id: `msg-all-${index + 1}`,
      conversationId: conversationState().id,
      role: message.role,
      content: message.content,
      metadata: null,
      createdAt: new Date(),
    }))
  ) as MessageRepository["findMessagesByConversationId"]);
}

function stubProcessMessage(service: ConversationService, observedSteps: ChatStep[]) {
  (service as ConversationService & {
    processMessage: ConversationService["processMessage"];
  }).processMessage = (async (input) => {
    observedSteps.push(input.currentStep);

    if (input.currentStep === ChatStep.CITY) {
      return {
        reply: "I still need your city before I can move ahead.",
        nextStep: ChatStep.CITY,
        collectedData: input.collectedData,
        recommendProducts: [],
        isMoreImages: false,
        isBrowseOnly: false,
        quickReplies: [],
        handover: false,
        triggerType: null,
        promptVersionId: null,
        promptVersionLabel: null,
      };
    }

    return {
      reply: "Got it. What area would you like to cover?",
      nextStep: ChatStep.AREA,
      collectedData: {
        ...input.collectedData,
        budget: "Flexible",
      },
      recommendProducts: [],
      isMoreImages: false,
      isBrowseOnly: false,
      quickReplies: ["small", "medium", "large"],
      handover: false,
      triggerType: null,
      promptVersionId: null,
      promptVersionLabel: null,
    };
  }) as ConversationService["processMessage"];
}

test("processChat retries with the latest version after a write conflict and commits only once", async () => {
  const service = createService();

  let conversationState: ConversationState = {
    id: "conv-1",
    channel: ConversationChannel.WEB,
    contactId: null,
    customerName: "Aman",
    step: ChatStep.CITY,
    status: ConversationStatus.ACTIVE,
    version: 0,
    collectedData: {
      name: "Aman",
      productType: "Wall Panels (H-UHPC)",
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const committedMessages: Array<{ role: MessageRole; content: string }> = [];
  let stagedMessages: Array<{ role: MessageRole; content: string }> | null = null;
  let updateAttempts = 0;
  const observedSteps: ChatStep[] = [];

  stubMethod(prisma, "$transaction", (async <T>(callback: (tx: object) => Promise<T>) => {
    stagedMessages = [];
    try {
      const result = await callback({});
      committedMessages.push(...stagedMessages);
      stagedMessages = null;
      return result;
    } catch (error) {
      stagedMessages = null;
      throw error;
    }
  }) as typeof prisma.$transaction);

  stubConversationReads(() => conversationState, committedMessages);

  stubMethod(MessageRepository.prototype, "createMessage", (async (params: {
    conversationId: string;
    role: MessageRole;
    content: string;
  }) => {
    stagedMessages?.push({ role: params.role, content: params.content });
    return {
      id: `created-${stagedMessages?.length ?? 0}`,
      conversationId: params.conversationId,
      role: params.role,
      content: params.content,
      metadata: null,
      createdAt: new Date(),
    };
  }) as MessageRepository["createMessage"]);

  stubMethod(LeadRepository.prototype, "upsertPreparedLead", (async () => null) as unknown as LeadRepository["upsertPreparedLead"]);
  stubMethod(LeadRepository.prototype, "findByConversationId", (async () => null) as LeadRepository["findByConversationId"]);

  stubMethod(ConversationRepository.prototype, "updateConversation", (async (params: {
    id: string;
    customerName: string;
    step: ChatStep;
    status: ConversationStatus;
    collectedData: Record<string, unknown>;
    expectedVersion: number;
  }) => {
    updateAttempts += 1;

    if (updateAttempts === 1) {
      conversationState = {
        ...conversationState,
        step: ChatStep.BUDGET,
        version: 1,
        collectedData: {
          ...(conversationState.collectedData as Record<string, unknown>),
          city: "Pune",
        },
      };
      throw new ConversationVersionConflictError(params.id, params.expectedVersion);
    }

    assert.equal(params.expectedVersion, 1);
    conversationState = {
      ...conversationState,
      customerName: params.customerName,
      step: params.step,
      status: params.status,
      version: params.expectedVersion + 1,
      collectedData: { ...params.collectedData },
    };
    return {
      ...conversationState,
      collectedData: { ...(conversationState.collectedData as Record<string, unknown>) },
    };
  }) as ConversationRepository["updateConversation"]);

  stubProcessMessage(service, observedSteps);

  const result = await service.processChat({
    conversationId: conversationState.id,
    message: "My budget is flexible",
  });

  assert.deepEqual(observedSteps, [ChatStep.CITY, ChatStep.BUDGET]);
  assert.equal(updateAttempts, 2);
  assert.equal(result.nextStep, ChatStep.AREA);
  assert.equal((result.collectedData as Record<string, unknown>).city, "Pune");
  assert.equal((result.collectedData as Record<string, unknown>).budget, "Flexible");
  assert.equal(conversationState.version, 2);
  assert.equal(committedMessages.length, 2);
});

test("processChat retries on Prisma P2028 with a fresh conversation snapshot", async () => {
  const service = createService();

  let conversationState: ConversationState = {
    id: "conv-2",
    channel: ConversationChannel.WEB,
    contactId: null,
    customerName: "Aman",
    step: ChatStep.CITY,
    status: ConversationStatus.ACTIVE,
    version: 0,
    collectedData: {
      name: "Aman",
      productType: "Wall Panels (H-UHPC)",
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const committedMessages: Array<{ role: MessageRole; content: string }> = [];
  let stagedMessages: Array<{ role: MessageRole; content: string }> | null = null;
  let transactionAttempts = 0;
  const observedSteps: ChatStep[] = [];

  stubMethod(prisma, "$transaction", (async <T>(callback: (tx: object) => Promise<T>) => {
    transactionAttempts += 1;

    if (transactionAttempts === 1) {
      conversationState = {
        ...conversationState,
        step: ChatStep.BUDGET,
        version: 1,
        collectedData: {
          ...(conversationState.collectedData as Record<string, unknown>),
          city: "Pune",
        },
      };

      const error = Object.assign(new Error("Transaction not found"), { code: "P2028" });
      throw error;
    }

    stagedMessages = [];
    try {
      const result = await callback({});
      committedMessages.push(...stagedMessages);
      stagedMessages = null;
      return result;
    } catch (error) {
      stagedMessages = null;
      throw error;
    }
  }) as typeof prisma.$transaction);

  stubConversationReads(() => conversationState, committedMessages);

  stubMethod(MessageRepository.prototype, "createMessage", (async (params: {
    conversationId: string;
    role: MessageRole;
    content: string;
  }) => {
    stagedMessages?.push({ role: params.role, content: params.content });
    return {
      id: `created-${stagedMessages?.length ?? 0}`,
      conversationId: params.conversationId,
      role: params.role,
      content: params.content,
      metadata: null,
      createdAt: new Date(),
    };
  }) as MessageRepository["createMessage"]);

  stubMethod(LeadRepository.prototype, "upsertPreparedLead", (async () => null) as unknown as LeadRepository["upsertPreparedLead"]);
  stubMethod(LeadRepository.prototype, "findByConversationId", (async () => null) as LeadRepository["findByConversationId"]);

  stubMethod(ConversationRepository.prototype, "updateConversation", (async (params: {
    id: string;
    customerName: string;
    step: ChatStep;
    status: ConversationStatus;
    collectedData: Record<string, unknown>;
    expectedVersion: number;
  }) => {
    assert.equal(params.expectedVersion, 1);
    conversationState = {
      ...conversationState,
      customerName: params.customerName,
      step: params.step,
      status: params.status,
      version: params.expectedVersion + 1,
      collectedData: { ...params.collectedData },
    };
    return {
      ...conversationState,
      collectedData: { ...(conversationState.collectedData as Record<string, unknown>) },
    };
  }) as ConversationRepository["updateConversation"]);

  stubProcessMessage(service, observedSteps);

  const result = await service.processChat({
    conversationId: conversationState.id,
    message: "My budget is flexible",
  });

  assert.deepEqual(observedSteps, [ChatStep.CITY, ChatStep.BUDGET]);
  assert.equal(transactionAttempts, 2);
  assert.equal(result.nextStep, ChatStep.AREA);
  assert.equal((result.collectedData as Record<string, unknown>).city, "Pune");
  assert.equal((result.collectedData as Record<string, unknown>).budget, "Flexible");
  assert.equal(conversationState.version, 2);
  assert.equal(committedMessages.length, 2);
});

test("processChat routes handover conversations through post-handoff mode instead of repeating the original lock message", async () => {
  const service = createService();

  const conversationState: ConversationState = {
    id: "conv-handover",
    channel: ConversationChannel.WEB,
    contactId: null,
    customerName: "Aman",
    step: ChatStep.COMPLETED,
    status: ConversationStatus.HANDOVER,
    version: 3,
    collectedData: {
      name: "Aman",
      productType: "Wall Panels (H-UHPC)",
      city: "Delhi",
      budget: "Flexible",
      areaSqft: "250",
      roomType: "Living Room",
      handoffCompleted: true,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const committedMessages: Array<{ role: MessageRole; content: string }> = [
    { role: MessageRole.ASSISTANT, content: "Kabir from our team will take it from here. He'll contact you shortly." },
  ];
  const stagedMessages: Array<{ role: MessageRole; content: string }> = [];
  let observedPostHandoffMode = false;
  let observedStatus: ConversationStatus | null = null;
  let observedStep: ChatStep | null = null;

  stubMethod(prisma, "$transaction", (async <T>(callback: (tx: object) => Promise<T>) => {
    return callback({});
  }) as typeof prisma.$transaction);

  stubConversationReads(() => conversationState, committedMessages);

  stubMethod(MessageRepository.prototype, "createMessage", (async (params: {
    conversationId: string;
    role: MessageRole;
    content: string;
  }) => {
    stagedMessages.push({ role: params.role, content: params.content });
    return {
      id: `created-${stagedMessages.length}`,
      conversationId: params.conversationId,
      role: params.role,
      content: params.content,
      metadata: null,
      createdAt: new Date(),
    };
  }) as MessageRepository["createMessage"]);

  stubMethod(LeadRepository.prototype, "upsertPreparedLead", (async () => null) as unknown as LeadRepository["upsertPreparedLead"]);
  stubMethod(LeadRepository.prototype, "findByConversationId", (async () => null) as LeadRepository["findByConversationId"]);
  stubMethod(ConversationRepository.prototype, "updateConversation", (async (params: {
    id: string;
    customerName: string;
    step: ChatStep;
    status: ConversationStatus;
    collectedData: Record<string, unknown>;
    expectedVersion: number;
  }) => {
    observedStatus = params.status;
    observedStep = params.step;
    return {
      ...conversationState,
      customerName: params.customerName,
      step: params.step,
      status: params.status,
      version: params.expectedVersion + 1,
      collectedData: { ...params.collectedData },
    };
  }) as ConversationRepository["updateConversation"]);

  (service as ConversationService & {
    processMessage: ConversationService["processMessage"];
  }).processMessage = (async (input) => {
    observedPostHandoffMode = input.postHandoffMode === true;
    assert.equal(input.currentStep, ChatStep.COMPLETED);
    assert.match(input.history[input.history.length - 1] ?? "", /take it from here/i);

    return {
      reply: "Kabir will contact you soon.",
      nextStep: ChatStep.COMPLETED,
      collectedData: {
        ...input.collectedData,
        handoffCompleted: true,
      },
      recommendProducts: [],
      isMoreImages: false,
      isBrowseOnly: false,
      quickReplies: [],
      handover: false,
      triggerType: null,
      promptVersionId: null,
      promptVersionLabel: null,
    };
  }) as ConversationService["processMessage"];

  const result = await service.processChat({
    conversationId: conversationState.id,
    message: "Okay please do that",
  });

  assert.equal(observedPostHandoffMode, true);
  assert.equal(result.nextStep, ChatStep.COMPLETED);
  assert.equal(result.handover, true);
  assert.match(result.replyText, /contact you soon/i);
  assert.equal(observedStatus, ConversationStatus.HANDOVER);
  assert.equal(observedStep, ChatStep.COMPLETED);
  assert.deepEqual(stagedMessages, [
    { role: MessageRole.USER, content: "Okay please do that" },
    { role: MessageRole.ASSISTANT, content: "Kabir will contact you soon." },
  ]);
});

test("processChat keeps product requests working after handover while preserving HANDOVER status", async () => {
  const service = createService();

  const conversationState: ConversationState = {
    id: "conv-handover-products",
    channel: ConversationChannel.WEB,
    contactId: null,
    customerName: "Aman",
    step: ChatStep.COMPLETED,
    status: ConversationStatus.HANDOVER,
    version: 4,
    collectedData: {
      name: "Aman",
      productType: "Wall Panels (H-UHPC)",
      city: "Delhi",
      budget: "Flexible",
      areaSqft: "250",
      roomType: "Living Room",
      handoffCompleted: true,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const committedMessages: Array<{ role: MessageRole; content: string }> = [
    { role: MessageRole.ASSISTANT, content: "Kabir from our team will take it from here. He'll contact you shortly." },
  ];
  const stagedMessages: Array<{ role: MessageRole; content: string }> = [];
  let observedStatus: ConversationStatus | null = null;

  stubMethod(prisma, "$transaction", (async <T>(callback: (tx: object) => Promise<T>) => {
    return callback({});
  }) as typeof prisma.$transaction);

  stubConversationReads(() => conversationState, committedMessages);

  stubMethod(MessageRepository.prototype, "createMessage", (async (params: {
    conversationId: string;
    role: MessageRole;
    content: string;
  }) => {
    stagedMessages.push({ role: params.role, content: params.content });
    return {
      id: `created-${stagedMessages.length}`,
      conversationId: params.conversationId,
      role: params.role,
      content: params.content,
      metadata: null,
      createdAt: new Date(),
    };
  }) as MessageRepository["createMessage"]);

  stubMethod(LeadRepository.prototype, "upsertPreparedLead", (async () => null) as unknown as LeadRepository["upsertPreparedLead"]);
  stubMethod(LeadRepository.prototype, "findByConversationId", (async () => null) as LeadRepository["findByConversationId"]);
  stubMethod(ConversationRepository.prototype, "updateConversation", (async (params: {
    id: string;
    customerName: string;
    step: ChatStep;
    status: ConversationStatus;
    collectedData: Record<string, unknown>;
    expectedVersion: number;
  }) => {
    observedStatus = params.status;
    return {
      ...conversationState,
      customerName: params.customerName,
      step: params.step,
      status: params.status,
      version: params.expectedVersion + 1,
      collectedData: { ...params.collectedData },
    };
  }) as ConversationRepository["updateConversation"]);

  (service as ConversationService & {
    processMessage: ConversationService["processMessage"];
  }).processMessage = (async (input) => {
    assert.equal(input.postHandoffMode, true);
    return {
      reply: "Here are some wall panel options.\nKabir will also guide you in detail when he connects.",
      nextStep: ChatStep.COMPLETED,
      collectedData: {
        ...input.collectedData,
        handoffCompleted: true,
      },
      recommendProducts: [
        {
          id: "furrow",
          name: "Furrow",
          category: "Wall Panels (H-UHPC)",
          priceRange: "Rs 400+/sqft",
          dimensions: "Panel based",
          imageUrl: "furrow-main.webp",
        } as any,
      ],
      isMoreImages: false,
      isBrowseOnly: false,
      quickReplies: [],
      handover: false,
      triggerType: null,
      promptVersionId: null,
      promptVersionLabel: null,
    };
  }) as ConversationService["processMessage"];

  const result = await service.processChat({
    conversationId: conversationState.id,
    message: "show me wall panels",
  });

  assert.equal(result.handover, true);
  assert.equal(observedStatus, ConversationStatus.HANDOVER);
  assert.match(result.replyText, /wall panel options/i);
  assert.match(result.replyText, /Kabir/i);
  assert.equal(result.recommend_products.length, 1);
  assert.deepEqual(stagedMessages, [
    { role: MessageRole.USER, content: "show me wall panels" },
    { role: MessageRole.ASSISTANT, content: "Here are some wall panel options.\nKabir will also guide you in detail when he connects." },
  ]);
});
