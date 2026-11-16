import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { prisma, signInAs, TENANT } from "@/test/helpers";
import {
  deleteMessage,
  editMessage,
  getMessages,
  markRead,
  openDirectConversation,
  sendMessage,
  toggleReaction,
} from "@/lib/chat-message-actions";

/** A channel of this tenant without user-group restrictions. */
function openChannel() {
  prisma.channel.findFirst.mockResolvedValue({ userGroups: [], chatServer: { userGroups: [] } });
  prisma.userGroupMember.findMany.mockResolvedValue([]);
}

function loaded(over: Record<string, unknown> = {}) {
  return {
    id: "m1",
    channelId: "c1",
    directConversationId: null,
    userId: "user-1",
    content: "hello",
    createdAt: new Date("2026-11-16T10:00:00.000Z"),
    editedAt: null,
    deletedAt: null,
    attachments: null,
    mentions: null,
    user: { id: "user-1", name: "Alice", email: "alice@example.com", profiles: [] },
    replyTo: null,
    reactions: [],
    ...over,
  };
}

/** Message row as seen by requireMessage. */
function existingMessage(over: Record<string, unknown> = {}) {
  prisma.message.findFirst.mockResolvedValue({
    id: "m1",
    userId: "user-2",
    channelId: "c1",
    directConversationId: null,
    deletedAt: null,
    attachments: null,
    ...over,
  });
}

describe("chat room access", () => {
  it("rejects channels of another tenant", async () => {
    signInAs("member");
    prisma.channel.findFirst.mockResolvedValue(null);

    await expect(sendMessage("channel:of-tenant-b", { content: "hi" })).rejects.toThrow(/not found/i);
    expect(prisma.channel.findFirst.mock.calls[0][0].where).toMatchObject({
      id: "of-tenant-b",
      chatServer: { tenantId: TENANT },
    });
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it("rejects group-restricted channels for members outside the group", async () => {
    signInAs("member");
    prisma.channel.findFirst.mockResolvedValue({ userGroups: [{ id: "g-staff" }], chatServer: { userGroups: [] } });
    prisma.userGroupMember.findMany.mockResolvedValue([]);

    await expect(getMessages("channel:c1")).rejects.toThrow(/not found/i);
    expect(prisma.message.findMany).not.toHaveBeenCalled();
  });

  it("lets admins read any channel of the tenant (moderation)", async () => {
    signInAs("admin");
    prisma.channel.findFirst.mockResolvedValue({ userGroups: [{ id: "g-staff" }], chatServer: { userGroups: [] } });
    prisma.message.findMany.mockResolvedValue([]);
    prisma.chatReadState.findMany.mockResolvedValue([]);

    const page = await getMessages("channel:c1");
    expect(page.messages).toEqual([]);
    expect(prisma.message.findMany.mock.calls[0][0].where).toMatchObject({ tenantId: TENANT, channelId: "c1" });
  });

  it("only lets participants into a DM", async () => {
    signInAs("member");
    prisma.directConversation.findFirst.mockResolvedValue(null);

    await expect(getMessages("dm:someone-elses")).rejects.toThrow(/not found/i);
    expect(prisma.directConversation.findFirst.mock.calls[0][0].where).toEqual({
      id: "someone-elses",
      tenantId: TENANT,
      OR: [{ user1Id: "user-1" }, { user2Id: "user-1" }],
    });
  });

  it("rejects malformed room keys", async () => {
    signInAs("member");
    await expect(getMessages("course:abc")).rejects.toThrow(/not found/i);
    await expect(getMessages("channel:../../x")).rejects.toThrow(/not found/i);
  });

  it("refuses to open a DM with a non-member", async () => {
    signInAs("member");
    await expect(openDirectConversation("outsider")).rejects.toThrow(/not a member/i);
    expect(prisma.directConversation.create).not.toHaveBeenCalled();
  });
});

describe("sending messages", () => {
  it("stores tenantId, filters mentions to room members and marks own message read", async () => {
    signInAs("member");
    openChannel();
    prisma.membership.findMany.mockResolvedValue([
      { userId: "user-1", role: "member" },
      { userId: "user-2", role: "member" },
    ]);
    prisma.message.create.mockResolvedValue({ id: "m1", createdAt: new Date() });
    prisma.message.findFirstOrThrow.mockResolvedValue(loaded({ mentions: ["user-2"] }));
    prisma.user.findMany.mockResolvedValue([{ id: "user-2", name: "Bob", email: "bob@example.com" }]);

    const dto = await sendMessage("channel:c1", { content: "hi <@user-2> and <@outsider>" });

    const data = prisma.message.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ tenantId: TENANT, channelId: "c1", userId: "user-1" });
    expect(data.mentions).toEqual(["user-2"]);
    expect(dto.mentions).toEqual([{ id: "user-2", name: "Bob" }]);
    expect(prisma.chatReadState.upsert).toHaveBeenCalled();
  });

  it("rejects replies to messages outside the room or deleted", async () => {
    signInAs("member");
    openChannel();
    prisma.message.findFirst.mockResolvedValue(null);

    await expect(sendMessage("channel:c1", { content: "re", replyToId: "other-room-msg" })).rejects.toThrow(/replied/i);
    expect(prisma.message.findFirst.mock.calls[0][0].where).toMatchObject({
      id: "other-room-msg",
      tenantId: TENANT,
      channelId: "c1",
      deletedAt: null,
    });
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it("rejects empty and oversized messages", async () => {
    signInAs("member");
    openChannel();
    await expect(sendMessage("channel:c1", { content: "   " })).rejects.toThrow(/empty/i);
    await expect(sendMessage("channel:c1", { content: "x".repeat(4001) })).rejects.toThrow(/at most/i);
  });

  it("rejects attachments uploaded by someone else", async () => {
    signInAs("member");
    openChannel();
    const foreign = {
      name: "secret.pdf",
      mimeType: "application/pdf",
      size: 10,
      storagePath: `${TENANT}/chat/1700000000000-deadbeef-user-2-secret.pdf`,
    };
    await expect(sendMessage("channel:c1", { content: "", attachments: [foreign] })).rejects.toThrow(/invalid attachment/i);
    await expect(
      sendMessage("channel:c1", {
        content: "",
        attachments: [{ ...foreign, storagePath: `tenant-b/chat/1700000000000-deadbeef-user-1-x.pdf` }],
      }),
    ).rejects.toThrow(/invalid attachment/i);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });
});

describe("editing and deleting", () => {
  it("only the author can edit", async () => {
    signInAs("admin");
    openChannel();
    existingMessage({ userId: "user-2" });

    await expect(editMessage("m1", "changed")).rejects.toThrow(/own messages/i);
    expect(prisma.message.update).not.toHaveBeenCalled();
  });

  it("deleted messages can't be edited or reacted to", async () => {
    signInAs("member");
    openChannel();
    existingMessage({ userId: "user-1", deletedAt: new Date() });

    await expect(editMessage("m1", "changed")).rejects.toThrow(/deleted/i);
    await expect(toggleReaction("m1", "👍")).rejects.toThrow(/deleted/i);
    expect(prisma.message.update).not.toHaveBeenCalled();
    expect(prisma.messageReaction.create).not.toHaveBeenCalled();
  });

  it("members can't delete other people's messages", async () => {
    signInAs("member");
    openChannel();
    existingMessage({ userId: "user-2" });

    await expect(deleteMessage("m1")).rejects.toThrow(/own messages/i);
    expect(prisma.message.update).not.toHaveBeenCalled();
  });

  it("admins can moderate: soft delete hides content", async () => {
    signInAs("admin");
    openChannel();
    existingMessage({ userId: "user-2" });
    prisma.message.findFirstOrThrow.mockResolvedValue(
      loaded({ userId: "user-2", content: "", deletedAt: new Date(), reactions: [{ userId: "user-1", emoji: "👍" }] }),
    );

    const dto = await deleteMessage("m1");
    const update = prisma.message.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: "m1" });
    expect(update.data).toMatchObject({ content: "", deletedById: "user-1" });
    expect(update.data.deletedAt).toBeInstanceOf(Date);
    expect(prisma.messageReaction.deleteMany).toHaveBeenCalledWith({ where: { messageId: "m1" } });
    expect(dto).toMatchObject({ deleted: true, content: null, reactions: [], attachments: [] });
  });

  it("messages from another tenant are not found", async () => {
    signInAs("admin");
    prisma.message.findFirst.mockResolvedValue(null);
    await expect(deleteMessage("foreign")).rejects.toThrow(/not found/i);
    expect(prisma.message.findFirst.mock.calls[0][0].where).toEqual({ id: "foreign", tenantId: TENANT });
  });
});

describe("reactions and read state", () => {
  it("only accepts a single emoji", async () => {
    signInAs("member");
    openChannel();
    existingMessage({ userId: "user-2" });

    for (const bad of ["abc", "👍👍", "<script>", " 👍", ""]) {
      await expect(toggleReaction("m1", bad)).rejects.toThrow(/invalid reaction/i);
    }
    prisma.messageReaction.findMany.mockResolvedValue([{ userId: "user-1", emoji: "👍🏽" }]);
    const res = await toggleReaction("m1", "👍🏽");
    expect(res.reactions).toEqual([{ emoji: "👍🏽", count: 1, userIds: ["user-1"], mine: true }]);
  });

  it("markRead never moves the read position backwards", async () => {
    signInAs("member");
    openChannel();
    prisma.message.findFirst.mockResolvedValue({ createdAt: new Date("2026-11-16T09:00:00.000Z") });
    prisma.chatReadState.findUnique.mockResolvedValue({ lastReadAt: new Date("2026-11-16T10:00:00.000Z") });

    await markRead("channel:c1", "older");
    expect(prisma.message.findFirst.mock.calls[0][0].where).toMatchObject({ id: "older", tenantId: TENANT, channelId: "c1" });
    expect(prisma.chatReadState.upsert).not.toHaveBeenCalled();
  });
});

describe("file serving", () => {
  it("/api/uploads refuses chat attachments (they need the access-checked route)", async () => {
    signInAs("member");
    const { GET } = await import("@/app/api/uploads/[...path]/route");
    const res = await GET(new NextRequest(`http://localhost/api/uploads/${TENANT}/chat/x.png`), {
      params: Promise.resolve({ path: [TENANT, "chat", "x.png"] }),
    });
    expect(res.status).toBe(403);
  });

  it("chat attachments of inaccessible rooms are not served", async () => {
    signInAs("member");
    prisma.message.findFirst.mockResolvedValue({
      channelId: "restricted",
      directConversationId: null,
      attachments: [{ name: "a.png", mimeType: "image/png", size: 1, storagePath: `${TENANT}/chat/a.png` }],
    });
    prisma.channel.findFirst.mockResolvedValue({ userGroups: [{ id: "g-staff" }], chatServer: { userGroups: [] } });
    prisma.userGroupMember.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/chat/attachments/[messageId]/[index]/route");
    const res = await GET(new Request("http://localhost/api/chat/attachments/m1/0"), {
      params: Promise.resolve({ messageId: "m1", index: "0" }),
    });
    expect(res.status).toBe(404);
  });
});
