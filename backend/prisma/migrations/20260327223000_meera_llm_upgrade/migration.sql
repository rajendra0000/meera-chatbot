PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Lead" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "name" TEXT,
  "score" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'COLD',
  "productInterest" TEXT,
  "customerType" TEXT,
  "investmentRange" TEXT,
  "areaSqft" TEXT,
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

INSERT INTO "new_Lead" (
  "id","conversationId","name","score","status","productInterest","customerType","investmentRange","areaSqft","timeline","triggerType","showroomCity","wantsCallback","wantsSample","estimatedOrderValue","createdAt","updatedAt"
)
SELECT
  "id","conversationId","name","score","status","productInterest","customerType","investmentRange",
  CASE WHEN "areaSqft" IS NULL THEN NULL ELSE CAST("areaSqft" AS TEXT) END,
  "timeline","triggerType","showroomCity","wantsCallback","wantsSample","estimatedOrderValue","createdAt","updatedAt"
FROM "Lead";

DROP TABLE "Lead";
ALTER TABLE "new_Lead" RENAME TO "Lead";
CREATE UNIQUE INDEX "Lead_conversationId_key" ON "Lead"("conversationId");

UPDATE "PromptVersion"
SET "content" = REPLACE("content", "You are Meera from Hey Concrete.", "You are Meera from Hey Concrete, an interior consultant for premium wall solutions.")
WHERE "type" = 'SYSTEM' AND "isActive" = 1;

PRAGMA foreign_keys=ON;
