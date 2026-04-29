import { components } from "./_generated/api";
import { Agent, createTool, vStreamArgs, syncStreams } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { rag } from "./rag";
import { action, internalAction, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { RateLimiter, HOUR } from "@convex-dev/rate-limiter";
import { internal } from "./_generated/api";
import { listUIMessages } from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";

const searchContext = createTool({
    description: "Search for context related to this user prompt",
    args: z.object({ query: z.string().describe("Describe the context you're looking for") }),
    handler: async (ctx, { query }) => {
        const context = await rag.search(ctx, {
            namespace: "all-users",
            query,
            limit: 5,
            vectorScoreThreshold: 0.3,
            chunkContext: { before: 2, after: 1 },  
        });
        return context.text;
    },
});

const getAboutCollege = createTool({
    description: "Search for any  information about VPM RZ Shah College including College Profile, Vision and Mission ,Goals and Objectives,Contact Details ,Address ,Principal Message,Managing Committee, College Development Committee, And Non Teaching Staff.etc.",
    args: z.object({ query: z.string().describe("Describe the information you're looking for about the college") }),
    handler: async (ctx, { query }) => {
        const context = await rag.search(ctx, { 
            namespace: "about-VPM",
            query,
            limit: 5,
            vectorScoreThreshold: 0.3,
            chunkContext: { before: 2, after: 1 },  
        });
        return context.text;
    },
});

const getAdmissionInfo = createTool({
    description: "Get information related to admissions in VPM RZ Shah College such as dates,eligibility,procedures etc.",
    args: z.object({ query: z.string().describe("Describe the admission information you're looking for") }),
    handler: async (ctx, { query }) => {
        const context = await rag.search(ctx, {
            namespace: "Admission",
            query,
            limit: 5,
            vectorScoreThreshold: 0.3,
            chunkContext: { before: 2, after: 1 },  
        });
        return context.text;
    },
});

const getExamInfo = createTool({
    description: "Get information related to exams in VPM RZ Shah College such as exam schedules,timetables,results etc.",
    args: z.object({ query: z.string().describe("Describe the exam information you're looking for") }),
    handler: async (ctx, { query }) => {
        const context = await rag.search(ctx, {
            namespace: "Exams",
            query,
            limit: 5,
            vectorScoreThreshold: 0.3,
            chunkContext: { before: 2, after: 1 },  
        });
        return context.text;
    },
});

const vpmBotTools = {
    searchContext,
    getAboutCollege,
    getAdmissionInfo,
    getExamInfo,
};

export const agent = new Agent(components.agent, {
    name: "College Assistant",
    languageModel: openai.chat("gpt-4o-mini"),
    textEmbeddingModel: openai.embedding("text-embedding-3-small"),
    instructions: `You are the official AI assistant for VPM RZ Shah College.

## Core Rule
ALWAYS use a tool before responding. Never answer from memory. If one tool returns no results, try another tool with a rephrased query.

## Tool Usage (Mandatory)
- Questions about vision, mission, principal, staff, committee, contact, address → getAboutCollege
- Questions about admissions, eligibility, dates, fees, procedures → getAdmissionInfo  
- Questions about exams, timetables, results, schedules → getExamInfo
- Everything else college-related → searchContext
- If unsure which tool → try searchContext first, then the specific tool if needed

## Response Rules
- Answer ONLY what was asked. No extra information.
- Use retrieved context only. No assumptions.
- Use Markdown. Keep it concise.
- If a source link is available, include it.
- If all tools return nothing → say: "This information is not currently available in the college records."
- If the question is not college-related response in slightly friendly manner that how can you assist them with college-related information.
- If they asked for other irrelevant information then politely inform them that you are designed to assist with college-related queries and ask how you can assist them with that.
## Format
- 1–3 sentence answer for simple questions
- Bullet list only if multiple items are needed
- Never add filler phrases like "Great question!" or "I hope this helps"`,

    tools: vpmBotTools,
    maxSteps: 10,
});



const rateLimiter = new RateLimiter(components.rateLimiter, {
    sendMessage: {
        kind: "fixed window",
        rate: 4,
        period: HOUR,
        capacity: 4

    },
    tokenUsagePerUser: {
        kind: "token bucket",
        period: HOUR,
        rate: 2000,
        capacity: 10000,
    },
});


// Send a message and get AI response with rate limiting
export const sendMessageToAgent = mutation({
    args: {
        prompt: v.string(), 
        threadId: v.string(),
        // sessionId: v.string(),
    },
    handler: async (ctx, { prompt, threadId, }) => {
        // Check rate limit

        // await rateLimiter.limit(ctx, "sendMessage", { key: sessionId, throws: true });

        const { messageId } = await agent.saveMessage(ctx, {
            threadId,
            prompt,
            skipEmbeddings: true,
        });

        await ctx.scheduler.runAfter(0, internal.agent.streamAsync, {
            threadId,
            promptMessageId: messageId,
        });
    },
});

export const streamAsync = internalAction({
    args: {
        threadId: v.string(),
        promptMessageId: v.string(),
    },
    handler: async (ctx, { threadId, promptMessageId }) => {
        agent.continueThread(ctx, { threadId });
        const result = await agent.streamText(ctx,
            { threadId },
            { promptMessageId },
            {
                saveStreamDeltas: true,
            },
        );
        await result.consumeStream();
    },
});






export const listThreadMessages = query({
    args: {
        // These arguments are required:
        threadId: v.string(),
        paginationOpts: paginationOptsValidator, // Used to paginate the messages.
        streamArgs: vStreamArgs, // Used to stream messages.
    },
    handler: async (ctx, args) => {
        const paginated = await listUIMessages(ctx, components.agent, {
            threadId: args.threadId,
            paginationOpts: args.paginationOpts,
        });


        const streams = await agent.syncStreams(ctx, {
            threadId: args.threadId,
            streamArgs: args.streamArgs,
        });

        return {
            ...paginated,
            streams,
        };
    },
});


export const createNewThread = action({
    args: {},
    handler: async (ctx) => {
        const { threadId } = await agent.createThread(ctx);
        return threadId;
    },
});
