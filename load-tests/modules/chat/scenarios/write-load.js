/**
 * write-load.js — Concurrent write load test for Chat/Messages API
 *
 * Executor: constant-vus, 5 VUs, 30s
 * Simulates high-frequency message sending from multiple VUs to different
 * chat rooms concurrently. Each VU targets a different chat room from the
 * seeded fixtures to spread write load across partitions.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('chat-fixtures', function () {
  return [JSON.parse(open('../fixtures/chat-fixtures.json'))];
})[0];

const fixtures = { ...baseFixtures, ...moduleFixtures };

const BASE_URL = resolveBaseUrl(__ENV.BASE_URL);

export const writeLoadScenario = {
  executor: 'constant-vus',
  vus: 5,
  duration: '30s',
  exec: 'runWriteLoad',
};

export function runWriteLoad() {
  const vuIndex = __VU - 1;
  const headers = {
    ...getAuthHeaders(fixtures, 'brother', vuIndex),
    'Content-Type': 'application/json',
  };

  // Each VU targets a different chat room to spread write load
  const chatRooms = fixtures.chatRooms || [];
  const chatRoom = chatRooms[vuIndex % chatRooms.length];

  // Fallback: create or get a chat if no seeded chat rooms available
  let chatId = chatRoom ? chatRoom.chatId : null;

  if (!chatId) {
    const otherUser = fixtures.brotherUsers[(vuIndex + 1) % fixtures.brotherUsers.length];
    const createRes = http.post(
      `${BASE_URL}/api/v1/chats/${otherUser.id}`,
      null,
      { headers, tags: { name: 'POST /chats/:otherUserId' } },
    );
    check(createRes, {
      'create-or-get-chat 2xx': r => r.status >= 200 && r.status < 300,
    });
    try {
      chatId = JSON.parse(createRes.body).data?._id;
    } catch (_) {}
  }

  if (!chatId) {
    console.log(`[write-load] VU ${__VU} ⚠ Could not resolve chatId — skipping iteration`);
    sleep(1);
    return;
  }

  // ── Step 1: Send a text message ─────────────────────────────────────────────
  const sendRes = http.post(
    `${BASE_URL}/api/v1/messages`,
    JSON.stringify({ chatId, text: `write-load msg VU${__VU} ${Date.now()}` }),
    { headers, tags: { name: 'POST /messages' } },
  );
  check(sendRes, {
    'send message 2xx': r => r.status >= 200 && r.status < 300,
  });

  // ── Step 2: Send another message (high-frequency simulation) ────────────────
  const sendRes2 = http.post(
    `${BASE_URL}/api/v1/messages`,
    JSON.stringify({ chatId, text: `write-load follow-up VU${__VU} ${Date.now()}` }),
    { headers, tags: { name: 'POST /messages' } },
  );
  check(sendRes2, {
    'send follow-up message 2xx': r => r.status >= 200 && r.status < 300,
  });

  // ── Step 3: Mark chat as read (write operation) ─────────────────────────────
  const markRes = http.post(
    `${BASE_URL}/api/v1/messages/chat/${chatId}/read`,
    null,
    { headers, tags: { name: 'POST /messages/chat/:chatId/read' } },
  );
  check(markRes, {
    'mark-chat-as-read 2xx': r => r.status >= 200 && r.status < 300,
  });

  sleep(0.5);
}
