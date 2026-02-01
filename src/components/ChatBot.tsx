"use client";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send, MessageCircle } from "lucide-react";
import toast, { Toaster } from 'react-hot-toast';
import { cn } from "@/lib/utils";
import { isRateLimitError } from "@convex-dev/rate-limiter";
import { api } from "convex/_generated/api";
import { getOrCreateSessionId } from "@/lib/session";
import {

  optimisticallySendMessage,
  toUIMessages,
  useSmoothText,
  useThreadMessages,
  useUIMessages,
  type UIMessage,

} from "@convex-dev/agent/react";
import { useAction, useMutation } from "convex/react";


import Markdown from "@/lib/markdown";
import { string } from "zod/v4";
interface ChatBotProps {
  isOpen: boolean;
  onClose: () => void;
}



export default function ChatBot() {
  // const createThread = useMutation(api.agent.createThread);
  const createThread = useAction(api.agent.createNewThread);
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const sendMessageTOAgent = useMutation(api.agent.sendMessageToAgent).withOptimisticUpdate(optimisticallySendMessage(api.agent.listThreadMessages));
  const [open, setOpen] = useState(true);
  const [mounted, setMounted] = useState(false);




  async function handleSendMessage() {
    if (!inputValue.trim()) return;
    // const sessionId = getOrCreateSessionId();

    let currentThreadId = threadId;
    if (!currentThreadId) {
      const id = await createThread();
      setThreadId(id);
      currentThreadId = id;
    }

    // Start loading state, call the action and wait for server-side streaming to finish.
    setIsLoading(true);
    try {
      await sendMessageTOAgent({
        prompt: inputValue,
        threadId: currentThreadId,
        // sessionId,
      });
      setInputValue("");
    } catch (e) {
      if (isRateLimitError(e)) {
        toast.error("You have exceeded the message limit");
        setRateLimited(true);
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  function onClose() {
    setOpen(false);

    window.parent.postMessage(
      { type: "CHAT_CLOSE" },
      "*"
    );

    console.log("CHAT_CLOSE message sent");
  }

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      // parent origin (ASP.NET)
      if (event.origin !== "https://localhost:44356") return;

      if (event.data?.type === "CHAT_OPEN") {
        setOpen(true);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);
  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  };
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  if (!open) return null;

  return (
    <div className="fixed inset-0  flex items-end sm:items-center justify-center p-4 z-50 " suppressHydrationWarning>
      <Toaster />
      <div className="bg-white h-100 rounded-2xl shadow-2xl w-full sm:w-96 max-h-[90vh] sm:max-h-150 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
        <div className="bg-linear-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageCircle className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-semibold">College Assistant</h2>
              <p className="text-blue-100 text-sm">Always here to help</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-blue-800 rounded-lg p-2 transition-colors"
            aria-label="Close chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 min-h-0  overflow-y-auto p-4 space-y-4 bg-slate-50">
          {/* 
    <MyComponent threadId={threadId}/> */}
          {threadId && (
            <MyComponent
              threadId={threadId}
              onMessagesChange={scrollToBottom}
              setIsLoading={setIsLoading}
            />
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white text-slate-800 border border-slate-200 px-4 py-3 rounded-xl rounded-bl-none">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                  <div
                    className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  />
                  <div
                    className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.4s" }}
                  />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-slate-200 bg-white p-4 space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your question..."
                className="flex-1 rounded-full border-slate-300 focus:ring-blue-500"
                disabled={isLoading || rateLimited}
              />
              {rateLimited && (
                <p className="text-sm text-red-500 mt-1">You have exceeded the message limit</p>
              )}
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={isLoading || rateLimited || !inputValue.trim()}
              className="rounded-full bg-blue-600 hover:bg-blue-700 text-white p-2 h-10 w-10 flex items-center justify-center"
              size="icon"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}

function MyComponent({
  threadId,
  onMessagesChange,
  setIsLoading,
}: {
  threadId: string;
  onMessagesChange: () => void;
  setIsLoading: (v: boolean) => void;
}) {

  const messages = useUIMessages(
    api.agent.listThreadMessages,
    { threadId },
    { initialNumItems: 10, stream: true }
  );

  useEffect(() => {
    console.log(`Messages`, messages.results)
  }, [messages.results]);

  useEffect(() => {
    const assistantStartedStreaming = messages.results.some(
      (m) =>
        m.role === "assistant" &&
        m.status === "streaming" &&
        (m.text?.length ?? 0) > 0
    );

    if (assistantStartedStreaming) {
      setIsLoading(false);
    }
  }, [messages.results, setIsLoading]);


  return (
    <div className="space-y-4">
      {messages.results
        .filter((m) => {

          if (!m.parts) return true;
          return m.parts.some((part) => part.type === "text");
        })
        .map((m) => (
          <MessageRow key={m.key} message={m} />
        ))}
    </div>
  );
}






function MessageRow({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  const [visibleText] = useSmoothText(message.text ?? " ", {
    // This tells the hook that it's ok to start streaming immediately.
    // If this was always passed as true, messages that are already done would
    // also stream in.
    // IF this was always passed as false (default), then the streaming message
    // wouldn't start streaming until the second chunk was received.
    startStreaming: message.status === "streaming",
  });

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <MessageBubble
        text={visibleText}
        role={message.role}
        streaming={message.status === "streaming"}
      />
    </div>
  );
}




function MessageBubble({
  text,
  role,
  streaming,
}: {
  text: string;
  role: "user" | "assistant" | "system";
  streaming?: boolean;
}) {

  return (
    <div
      className={cn(
        "max-w-[80%] px-4 py-3 rounded-xl text-sm leading-relaxed",
        role === "user"
          ? "bg-blue-600 text-white rounded-br-none"
          : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
      )}
    >
      <Markdown text={text || "..."} />
    </div>
  );
}

