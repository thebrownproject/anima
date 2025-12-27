"use client";

import { useState, useCallback } from "react";
import * as Icons from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AiActivityPanel } from "./ai-activity-panel";
import { useAgentStream } from "@/hooks/use-agent-stream";
import { cn } from "@/lib/utils";

interface AiChatBarProps {
  documentId: string;
}

export function AiChatBar({ documentId }: AiChatBarProps) {
  const [message, setMessage] = useState("");
  const { status, events, error, submit, reset } = useAgentStream(documentId);

  const isDisabled = status === "streaming";

  const handleSubmit = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed || isDisabled) return;

    submit(trimmed);
    setMessage("");
  }, [message, isDisabled, submit]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isDisabled) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative">
      {/* Activity Panel - floats above input, centered, fixed width */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-[480px] z-10">
        <AiActivityPanel
          status={status}
          events={events}
          error={error}
          onClose={reset}
        />
      </div>

      {/* Floating Chat Input */}
      <div
        className={cn(
          "group flex items-center pl-[30px] pr-3.5 py-3",
          "bg-sidebar border rounded-xl shadow-md",
          "transition-colors duration-150",
          "hover:border-muted-foreground/30",
          "focus-within:border-muted-foreground/30",
          isDisabled && "opacity-50"
        )}
      >
        <Icons.Stack
          className={cn(
            "size-4 transition-colors shrink-0",
            message
              ? "text-foreground"
              : "text-muted-foreground group-hover:text-foreground group-focus-within:text-foreground"
          )}
        />
        <Tooltip delayDuration={500} open={!message ? undefined : false}>
          <TooltipTrigger asChild>
            <Input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="How can I help you today?"
              aria-label="AI chat input"
              disabled={isDisabled}
              className="flex-1 border-none !bg-transparent shadow-none focus-visible:ring-0 !text-base text-foreground placeholder:text-muted-foreground -ml-1"
            />
          </TooltipTrigger>
          <TooltipContent
            side="top"
            sideOffset={8}
            className="text-center max-w-[280px]"
          >
            Ask your AI agent to update extractions or answer questions about
            this document
          </TooltipContent>
        </Tooltip>
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              onClick={handleSubmit}
              disabled={isDisabled || !message.trim()}
              className="size-8 rounded-full shrink-0"
              aria-label="Send message"
            >
              <Icons.ArrowUp className="size-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Send message</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
