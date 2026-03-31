import { z } from "zod";
import { ConversationChannel } from "@prisma/client";

export const channelSchema = z.nativeEnum(ConversationChannel);
