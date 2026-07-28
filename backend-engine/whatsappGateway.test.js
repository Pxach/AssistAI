import { jest } from '@jest/globals';

// ──────────────────────────────────────────────────────────────────────────────
// MOCKS — all registered before any import of the modules under test
// ──────────────────────────────────────────────────────────────────────────────

// configService mock — returns env-like values for known keys
jest.unstable_mockModule('./src/services/configService.js', () => ({
  getConfig: jest.fn(async (key) => {
    const fakeEnv = {
      GEMINI_API_KEY: 'test-gemini-key',
      GOOGLE_REVIEW_URL: 'https://g.page/r/TEST_REVIEW',
      TALLY_FORM_URL:    'https://tally.so/r/TEST_FORM',
      CALENDAR_ID:       'test@calendar.google.com',
      GOOGLE_CLIENT_EMAIL: 'bot@test.iam.gserviceaccount.com',
      GOOGLE_PRIVATE_KEY:  '-----BEGIN PRIVATE KEY-----\nFAKE\n-----END PRIVATE KEY-----\n',
      DASHBOARD_API_URL:   'http://mock-dashboard.test',
    };
    return fakeEnv[key];
  }),
  getKnowledgeBase: jest.fn(async () => 'Mock knowledge base: open 9 to 5.'),
}));

// Baileys mock
const mockEv = { on: jest.fn() };
const mockSock = {
  ev: mockEv,
  user: { id: '1234567890@s.whatsapp.net' },
  sendMessage: jest.fn(),
};
jest.unstable_mockModule('@whiskeysockets/baileys', () => ({
  makeWASocket: jest.fn(() => mockSock),
  useMultiFileAuthState: jest.fn(() => ({ state: {}, saveCreds: jest.fn() })),
  DisconnectReason: { loggedOut: 0 },
}));

// Pino mock
jest.unstable_mockModule('pino', () => ({ default: () => ({ level: 'silent' }) }));

// feedbackEligibility mock
jest.unstable_mockModule('./src/services/feedbackEligibility.js', () => ({
  checkFeedbackEligibility: jest.fn(() => Promise.resolve(true)),
}));

// chatController mock
jest.unstable_mockModule('./src/controllers/chatController.js', () => ({
  processUserMessage: jest.fn(),
}));

// sessionSyncService mock — intercepts all HTTP PATCH calls
const mockPatchSessionStatus = jest.fn(() => Promise.resolve());
jest.unstable_mockModule('./src/services/sessionSyncService.js', () => ({
  patchSessionStatus: mockPatchSessionStatus,
}));

// ──────────────────────────────────────────────────────────────────────────────
// IMPORT MODULES UNDER TEST  (after all mocks are registered)
// ──────────────────────────────────────────────────────────────────────────────
const { connectToWhatsApp, armFeedbackFlag } = await import('./src/services/whatsappGateway.js');
const { handleFeedback }   = await import('./src/handlers/feedbackHandler.js');
const { sendFeedbackRequests } = await import('./src/services/reminderService.js');
const { getConfig, getKnowledgeBase } = await import('./src/services/configService.js');

// Helper: fresh io mock
function makeMockIo() {
  return { to: jest.fn().mockReturnThis(), emit: jest.fn() };
}

// ──────────────────────────────────────────────────────────────────────────────
// TESTS
// ──────────────────────────────────────────────────────────────────────────────

describe('configService', () => {
  it('getConfig returns the mocked value', async () => {
    const key = await getConfig('GEMINI_API_KEY');
    expect(key).toBe('test-gemini-key');
  });

  it('getKnowledgeBase returns the mocked knowledge base string', async () => {
    const kb = await getKnowledgeBase();
    expect(typeof kb).toBe('string');
    expect(kb.length).toBeGreaterThan(0);
  });
});

describe('feedbackHandler.js (async + dynamic URLs)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('appends phone number to Tally Form URL for critical sentiment (average)', async () => {
    const result = await handleFeedback('2', 'fr', '212600000000');
    expect(result.isDone).toBe(true);
    expect(result.sentiment).toBe('average');
    expect(result.linkType).toBe('tally_form');
    // URL comes from mocked getConfig → 'https://tally.so/r/TEST_FORM'
    expect(result.reply).toContain('https://tally.so/r/TEST_FORM?phone=212600000000');
  });

  it('appends phone number to Tally Form URL for critical sentiment (bad)', async () => {
    const result = await handleFeedback('3', 'en', '212611111111');
    expect(result.isDone).toBe(true);
    expect(result.sentiment).toBe('bad');
    expect(result.linkType).toBe('tally_form');
    expect(result.reply).toContain('https://tally.so/r/TEST_FORM?phone=212611111111');
  });

  it('uses Google Review URL for positive sentiment (good)', async () => {
    const result = await handleFeedback('1', 'fr', '212600000000');
    expect(result.isDone).toBe(true);
    expect(result.sentiment).toBe('good');
    expect(result.linkType).toBe('google_review');
    expect(result.reply).toContain('https://g.page/r/TEST_REVIEW');
    expect(result.reply).not.toContain('phone=');
  });
});

describe('whatsappGateway.js — Socket.io emissions', () => {
  beforeEach(() => {
    mockEv.on.mockClear();
    mockSock.sendMessage.mockClear();
  });

  it('emits whatsapp:qr when QR code is generated', async () => {
    const mockIo = makeMockIo();
    await connectToWhatsApp(mockIo, 'test-session');
    const connCb = mockEv.on.mock.calls.find(c => c[0] === 'connection.update')[1];
    await connCb({ qr: 'test-qr-string' });
    expect(mockIo.to).toHaveBeenCalledWith('test-session');
    expect(mockIo.emit).toHaveBeenCalledWith('whatsapp:qr', expect.objectContaining({
      qrCode: expect.stringContaining('data:image/png;base64,')
    }));
  });

  it('emits whatsapp:status_change on connection open', async () => {
    const mockIo = makeMockIo();
    await connectToWhatsApp(mockIo, 'test-session');
    const connCb = mockEv.on.mock.calls.find(c => c[0] === 'connection.update')[1];
    await connCb({ connection: 'open' });
    expect(mockIo.emit).toHaveBeenCalledWith('whatsapp:status_change', {
      status: 'CONNECTED', phoneNumber: '1234567890'
    });
  });

  it('emits whatsapp:feedback_initiated on positive rating', async () => {
    const mockIo = makeMockIo();
    await connectToWhatsApp(mockIo, 'test-session');
    const msgCb = mockEv.on.mock.calls.find(c => c[0] === 'messages.upsert')[1];
    // Re-arm the whitelisted JID each test — armFeedbackFlag resets waitingForFeedback to true
    const jid = '212766014551@s.whatsapp.net';
    armFeedbackFlag(jid, 'fr');
    await msgCb({ type: 'notify', messages: [{ key: { remoteJid: jid, fromMe: false }, message: { conversation: '1' } }] });
    expect(mockIo.emit).toHaveBeenLastCalledWith('whatsapp:feedback_initiated', {
      phoneNumber: '212766014551', sentiment: 'good', linkType: 'google_review'
    });
  });

  it('emits whatsapp:feedback_initiated on critical rating (average)', async () => {
    const mockIo = makeMockIo();
    await connectToWhatsApp(mockIo, 'test-session');
    const msgCb = mockEv.on.mock.calls.find(c => c[0] === 'messages.upsert')[1];
    // Re-arm the whitelisted JID each test — armFeedbackFlag resets waitingForFeedback to true
    const jid = '212766014551@s.whatsapp.net';
    armFeedbackFlag(jid, 'fr');
    await msgCb({ type: 'notify', messages: [{ key: { remoteJid: jid, fromMe: false }, message: { conversation: '2' } }] });
    expect(mockIo.emit).toHaveBeenLastCalledWith('whatsapp:feedback_initiated', {
      phoneNumber: '212766014551', sentiment: 'average', linkType: 'tally_form'
    });
    expect(mockSock.sendMessage).toHaveBeenCalledWith(jid, expect.objectContaining({
      text: expect.stringContaining('phone=212766014551')
    }));
  });
});

describe('whatsappGateway.js — HTTP PATCH session sync', () => {
  beforeEach(() => {
    mockEv.on.mockClear();
    mockPatchSessionStatus.mockClear();
  });

  it('calls patchSessionStatus with PAIRING on QR generation', async () => {
    const mockIo = makeMockIo();
    await connectToWhatsApp(mockIo, 'test-session');
    const connCb = mockEv.on.mock.calls.find(c => c[0] === 'connection.update')[1];
    await connCb({ qr: 'test-qr-string' });
    expect(mockPatchSessionStatus).toHaveBeenCalledWith(expect.objectContaining({
      sessionKey: 'test-session',
      status: 'PAIRING',
      phoneNumber: null,
      qrCode: expect.stringContaining('data:image/png;base64,'),
    }));
  });

  it('calls patchSessionStatus with CONNECTED on connection open', async () => {
    const mockIo = makeMockIo();
    await connectToWhatsApp(mockIo, 'test-session');
    const connCb = mockEv.on.mock.calls.find(c => c[0] === 'connection.update')[1];
    await connCb({ connection: 'open' });
    expect(mockPatchSessionStatus).toHaveBeenCalledWith(expect.objectContaining({
      sessionKey: 'test-session',
      status: 'CONNECTED',
      phoneNumber: '1234567890',
      qrCode: null,
    }));
  });

  it('calls patchSessionStatus with DISCONNECTED on connection close', async () => {
    const mockIo = makeMockIo();
    await connectToWhatsApp(mockIo, 'test-session');
    const connCb = mockEv.on.mock.calls.find(c => c[0] === 'connection.update')[1];
    // Simulate a non-logout close (shouldReconnect = false path — no Boom error)
    await connCb({ connection: 'close', lastDisconnect: { error: null } });
    expect(mockPatchSessionStatus).toHaveBeenCalledWith(expect.objectContaining({
      status: 'DISCONNECTED',
      phoneNumber: null,
      qrCode: null,
    }));
  });
});


describe('reminderService.js — Eligibility Check', () => {
  let checkFeedbackEligibility;

  beforeAll(async () => {
    const mod = await import('./src/services/feedbackEligibility.js');
    checkFeedbackEligibility = mod.checkFeedbackEligibility;
  });

  beforeEach(() => jest.clearAllMocks());

  it('sends feedback request when eligible', async () => {
    checkFeedbackEligibility.mockResolvedValueOnce(true);
    await sendFeedbackRequests(mockSock);
    expect(checkFeedbackEligibility).toHaveBeenCalledWith('212766014551');
    expect(mockSock.sendMessage).toHaveBeenCalled();
  });

  it('skips feedback request when ineligible', async () => {
    checkFeedbackEligibility.mockResolvedValueOnce(false);
    await sendFeedbackRequests(mockSock);
    expect(checkFeedbackEligibility).toHaveBeenCalledWith('212766014551');
    expect(mockSock.sendMessage).not.toHaveBeenCalled();
  });
});
