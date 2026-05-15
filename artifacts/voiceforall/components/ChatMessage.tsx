import React from "react";
import { StyleSheet, Text, View } from "react-native";

export type MessageRole = "user" | "assistant" | "system";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  inputMode?: "text" | "voice" | "sign";
}

interface Props {
  message: Message;
  patientName?: string;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getModeIcon(mode?: string) {
  if (mode === "voice") return " 🎤";
  if (mode === "sign") return " 🤟";
  return "";
}

// Render bold text (**text**) within a string
function renderContent(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <Text key={i} style={styles.bold}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return <Text key={i}>{part}</Text>;
  });
}

export default function ChatMessage({ message, patientName }: Props) {
  const isUser = message.role === "user";

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAI]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Text style={styles.avatarEmoji}>🤝</Text>
        </View>
      )}

      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
        {!isUser && <Text style={styles.senderName}>VoiceForAll AI</Text>}
        {isUser && message.inputMode && message.inputMode !== "text" && (
          <Text style={styles.modeLabel}>{getModeIcon(message.inputMode)}</Text>
        )}

        <Text style={[styles.content, isUser ? styles.contentUser : styles.contentAI]}>
          {renderContent(message.content)}
        </Text>

        <Text style={[styles.timestamp, isUser ? styles.timestampUser : styles.timestampAI]}>
          {formatTime(message.timestamp)}
          {isUser ? getModeIcon(message.inputMode) : ""}
        </Text>
      </View>

      {isUser && (
        <View style={[styles.avatar, styles.avatarUser]}>
          <Text style={styles.avatarEmoji}>
            {patientName ? patientName.charAt(0).toUpperCase() : "U"}
          </Text>
        </View>
      )}
    </View>
  );
}

export function TypingIndicator() {
  return (
    <View style={[styles.row, styles.rowAI]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarEmoji}>🤝</Text>
      </View>
      <View style={[styles.bubble, styles.bubbleAI, styles.typingBubble]}>
        <View style={styles.dots}>
          <View style={[styles.dot, styles.dot1]} />
          <View style={[styles.dot, styles.dot2]} />
          <View style={[styles.dot, styles.dot3]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginVertical: 4,
    paddingHorizontal: 12,
    gap: 8,
  },
  rowUser: { justifyContent: "flex-end" },
  rowAI: { justifyContent: "flex-start" },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E6F9F6",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarUser: { backgroundColor: "#1A3A5C" },
  avatarEmoji: { fontSize: 16 },
  bubble: {
    maxWidth: "75%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  bubbleAI: {
    backgroundColor: "#ffffff",
    borderBottomLeftRadius: 4,
    shadowColor: "#1A3A5C",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  bubbleUser: {
    backgroundColor: "#1A3A5C",
    borderBottomRightRadius: 4,
  },
  typingBubble: {
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  senderName: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#2BBFA4",
    marginBottom: 2,
  },
  modeLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.6)",
    marginBottom: 2,
  },
  content: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  contentAI: { color: "#1A3A5C" },
  contentUser: { color: "#ffffff" },
  bold: { fontFamily: "Inter_700Bold" },
  timestamp: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    alignSelf: "flex-end",
  },
  timestampAI: { color: "#9CA3AF" },
  timestampUser: { color: "rgba(255,255,255,0.5)" },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2BBFA4",
    opacity: 0.4,
  },
  dot1: {},
  dot2: { opacity: 0.7 },
  dot3: { opacity: 1 },
});
