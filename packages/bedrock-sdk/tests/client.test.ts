// Mock the client to allow for a more integration-style test
// We're mocking specific parts of the AnthropicBedrock client to avoid
// dependencies while still testing the integration behavior

// Mock specific parts of the client
jest.mock('../src/core/auth', () => ({
  getAuthHeaders: jest.fn().mockResolvedValue({}),
}));

// Create a mock fetch function
const mockFetch = jest.fn().mockImplementation(() => {
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve({}),
    text: () => Promise.resolve('{}'),
  });
});

// Store original fetch function
const originalFetch = global.fetch;

describe('Bedrock model ARN URL encoding integration test', () => {
  beforeEach(() => {
    // Replace global fetch with our mock
    global.fetch = mockFetch;
    // Clear mock history
    mockFetch.mockClear();
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  test('properly encodes model ARNs with slashes in URL path', async () => {
    // Import the client - do this inside the test to ensure mocks are set up first
    const { AnthropicBedrock } = require('../src');

    // Create client instance
    const client = new AnthropicBedrock({
      awsRegion: 'us-east-1',
      baseURL: 'http://localhost:4010',
    });

    // Model ARN with slashes that needs encoding
    const modelArn =
      'arn:aws:bedrock:us-east-2:1234:inference-profile/us.anthropic.claude-3-7-sonnet-20250219-v1:0';

    // Make a request to trigger the URL construction with the ARN
    try {
      await client.messages.create({
        model: modelArn,
        max_tokens: 1024,
        messages: [{ content: 'Test message', role: 'user' }],
      });
    } catch (e) {
      // We expect errors due to mocking - we're just interested in the URL construction
    }

    // Verify that fetch was called
    expect(mockFetch).toHaveBeenCalled();

    // Get the URL that was passed to fetch
    const fetchUrl = mockFetch.mock.calls[0][0];

    // Expected URL with properly encoded ARN (slash encoded as %2F)
    const expectedUrl =
      'http://localhost:4010/model/arn:aws:bedrock:us-east-2:1234:inference-profile%2Fus.anthropic.claude-3-7-sonnet-20250219-v1:0/invoke';

    // Verify the exact URL matches what we expect
    expect(fetchUrl).toBe(expectedUrl);
  });

  test('properly constructs URL path for normal model names', async () => {
    // Import the client - do this inside the test to ensure mocks are set up first
    const { AnthropicBedrock } = require('../src');

    // Create client instance
    const client = new AnthropicBedrock({
      awsRegion: 'us-east-1',
      baseURL: 'http://localhost:4010',
    });

    // Regular model name (still contains characters that need encoding)
    const modelName = 'anthropic.claude-3-5-sonnet-20241022-v2:0';

    // Make a request to trigger the URL construction
    try {
      await client.messages.create({
        model: modelName,
        max_tokens: 1024,
        messages: [{ content: 'Test message', role: 'user' }],
      });
    } catch (e) {
      // We expect errors due to mocking - we're just interested in the URL construction
    }

    // Verify that fetch was called
    expect(mockFetch).toHaveBeenCalled();

    // Get the URL that was passed to fetch
    const fetchUrl = mockFetch.mock.calls[0][0];

    // Expected URL with properly encoded model name
    const expectedUrl = 'http://localhost:4010/model/anthropic.claude-3-5-sonnet-20241022-v2:0/invoke';

    // Verify the exact URL matches what we expect
    expect(fetchUrl).toBe(expectedUrl);
  });
});
