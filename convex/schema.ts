import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { vEntryId } from "@convex-dev/rag";

export default defineSchema({
    messages: defineTable({
        role: v.union(v.literal("user"), v.literal("assistant")),
        sessionId: v.string(),
        text: v.string(),
        timestamp: v.number(),
        reference: v.optional(v.any())
    }).index("bySessionId", ["sessionId"]),

    documents: defineTable({
        entryId: vEntryId,
        filename: v.string(),
        storageId: v.id("_storage"),
        category: v.optional(v.string()),
        isActive: v.boolean(),
        validTill: v.optional(v.number()),
        createdAt: v.number(),
    })
        .index("by_entryId", ["entryId"])
        .index("by_isActive", ["isActive"])
        .index("by_category", ["category"])
    ,
    users: defineTable({
        kind:v.literal("anonymous")
    })

})