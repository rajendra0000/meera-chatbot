CREATE TABLE "Product" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "priceRange" TEXT NOT NULL,
  "dimensions" TEXT NOT NULL,
  "unitDesc" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "bestFor" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "Showroom" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "contact" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "PromptVersion" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "type" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Conversation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "channel" TEXT NOT NULL DEFAULT 'WEB',
  "contactId" TEXT,
  "customerName" TEXT,
  "step" TEXT NOT NULL DEFAULT 'GREET',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "collectedData" JSONB,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "Message" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Lead" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "name" TEXT,
  "score" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'COLD',
  "productInterest" TEXT,
  "customerType" TEXT,
  "investmentRange" TEXT,
  "areaSqft" INTEGER,
  "timeline" TEXT,
  "triggerType" TEXT,
  "showroomCity" TEXT,
  "wantsCallback" BOOLEAN NOT NULL DEFAULT false,
  "wantsSample" BOOLEAN NOT NULL DEFAULT false,
  "estimatedOrderValue" INTEGER,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Lead_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "LeadScore" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "leadId" TEXT NOT NULL,
  "budget" INTEGER NOT NULL DEFAULT 0,
  "space" INTEGER NOT NULL DEFAULT 0,
  "productInterest" INTEGER NOT NULL DEFAULT 0,
  "timeline" INTEGER NOT NULL DEFAULT 0,
  "engagement" INTEGER NOT NULL DEFAULT 0,
  "total" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "LeadScore_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Lead_conversationId_key" ON "Lead"("conversationId");
CREATE UNIQUE INDEX "LeadScore_leadId_key" ON "LeadScore"("leadId");
