// convex/example.ts
import { components } from "./_generated/api";
import { RAG } from "@convex-dev/rag";
// Any AI SDK model that supports embeddings will work.
import { openai } from "@ai-sdk/openai";
import { action, internalAction } from "./_generated/server";
import { v } from "convex/values"
import { internal } from "./_generated/api";



export const rag = new RAG(components.rag, {
    textEmbeddingModel: openai.embedding("text-embedding-3-small"),
    embeddingDimension: 1536, // Needs to match your embedding model
});

export const add = action({
    args: { namespace: v.string(), text: v.string() },
    handler: async (ctx, { namespace, text }) => {
        const response = await rag.add(ctx, {
            namespace,
            text,
        });
        console.log(response);
        return response;
    },
});

// export const search = action({
//     args: { query: v.string() },
//     handler: async (ctx, { query }) => {
//         const ragResult = await rag.search(ctx, {
//             namespace: "all-users",
//             query,
//             limit: 5,
//             vectorScoreThreshold: 0.3,
//             chunkContext: { before: 2, after: 1 },
//         });
//         return ragResult.entries.map((e) => e.text);
//     },
// });


// This is now handled by document.storeFile - keeping for backward compatibility if needed